import express, { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = express.Router();

// Get active shift for the logged-in user
router.get('/active', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const shift = await prisma.shift.findFirst({
            where: { cashierId: req.user!.id, status: 'OPEN' },
        });
        res.json(shift || null);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch active shift' });
    }
});

// Get shift history
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const isSuperAdmin = req.user!.role === 'ADMIN' || req.user!.permissions?.includes('*');
        const shifts = await prisma.shift.findMany({
            where: isSuperAdmin ? undefined : { cashierId: req.user!.id },
            orderBy: { startTime: 'desc' },
            include: { cashier: { select: { name: true, role: true } } },
        });
        res.json(shifts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch shifts' });
    }
});

// Start a shift
router.post('/start', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { startingCash } = req.body;
        
        // Check if there's already an active shift
        const existing = await prisma.shift.findFirst({
            where: { cashierId: req.user!.id, status: 'OPEN' },
        });

        if (existing) {
            return res.status(400).json({ error: 'You already have an open shift' });
        }

        const shift = await prisma.shift.create({
            data: {
                cashierId: req.user!.id,
                branchId: req.user?.branchId || null,
                startingCash: startingCash || 0,
            },
        });
        res.status(201).json(shift);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to start shift' });
    }
});

// End a shift
router.post('/:id/end', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        const { endingCash } = req.body;

        const shift = await prisma.shift.findUnique({ where: { id } });
        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        const isSuperAdmin = req.user!.role === 'ADMIN' || req.user!.permissions?.includes('*');
        if (shift.cashierId !== req.user!.id && !isSuperAdmin) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const updatedShift = await prisma.shift.update({
            where: { id },
            data: {
                status: 'CLOSED',
                endTime: new Date(),
                endingCash: endingCash !== undefined ? endingCash : shift.endingCash,
            },
        });
        res.json(updatedShift);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to end shift' });
    }
});

// Get Shift Reading (X-Reading or Z-Reading)
router.get('/:id/reading', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        const shift = await prisma.shift.findUnique({
            where: { id },
            include: { cashier: { select: { name: true } } }
        });

        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Fetch transactions for this shift
        const transactions = await prisma.transaction.findMany({
            where: {
                cashierId: shift.cashierId,
                createdAt: {
                    gte: shift.startTime,
                    lte: shift.endTime || new Date()
                },
                status: 'COMPLETED'
            }
        });

        let totalCashSales = 0;
        let totalCardSales = 0;
        let totalDiscounts = 0;

        transactions.forEach(txn => {
            if (txn.paymentModeName?.toLowerCase().includes('cash')) {
                totalCashSales += txn.totalAmount;
            } else {
                totalCardSales += txn.totalAmount;
            }
            totalDiscounts += txn.discount;
        });

        const expectedCash = shift.startingCash + totalCashSales;

        res.json({
            shiftId: shift.id,
            cashierName: shift.cashier.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            startingCash: shift.startingCash,
            totalCashSales,
            totalCardSales,
            totalDiscounts,
            expectedCash,
            endingCash: shift.endingCash,
            shortageOverage: shift.endingCash !== null ? shift.endingCash - expectedCash : null
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate reading' });
    }
});

// Helper for authoritative Till balance & activity calculations
async function calculateTillState() {
    const activeShift = await prisma.shift.findFirst({
        where: { status: 'OPEN' },
        include: { cashier: { select: { name: true } } },
        orderBy: { startTime: 'desc' }
    });

    const shiftStart = activeShift?.startTime || new Date(new Date().setHours(0, 0, 0, 0));

    // Sales transactions
    const txns = await prisma.transaction.findMany({
        where: {
            createdAt: { gte: shiftStart },
            status: { in: ['COMPLETED', 'REFUNDED'] }
        },
        include: { items: { include: { returnItems: true } } }
    });

    let cashSales = 0;
    let cashRefunds = 0;
    txns.forEach(t => {
        const isCash = !t.paymentModeName || t.paymentModeName.toLowerCase().includes('cash');
        if (isCash) {
            cashSales += t.totalAmount;
        }
        t.items.forEach(it => {
            (it.returnItems || []).forEach(r => {
                cashRefunds += r.refundAmount;
            });
        });
    });

    // Cash Drawer Events
    const tillLogs = activeShift ? await prisma.cashDrawerEvent.findMany({
        where: { shiftId: activeShift.id },
        orderBy: { timestamp: 'desc' }
    }) : [];

    let totalPayIn = 0;
    let totalPayOut = 0;
    const activities: any[] = [];

    tillLogs.forEach(log => {
        const amount = log.amount || 0;
        if (log.type === 'IN') {
            totalPayIn += amount;
            activities.push({
                id: log.id,
                type: 'IN',
                amount,
                desc: log.reason || 'Pay In',
                time: new Date(log.timestamp).toLocaleTimeString(),
                createdAt: log.timestamp,
                user: activeShift?.cashier.name || 'Staff'
            });
        } else if (log.type === 'OUT') {
            totalPayOut += amount;
            activities.push({
                id: log.id,
                type: 'OUT',
                amount: -amount,
                desc: log.reason || 'Pay Out',
                time: new Date(log.timestamp).toLocaleTimeString(),
                createdAt: log.timestamp,
                user: activeShift?.cashier.name || 'Staff'
            });
        } else if (log.type === 'NO_SALE') {
            activities.push({
                id: log.id,
                type: 'NO_SALE',
                amount: 0,
                desc: log.reason || 'No Sale / Open Drawer',
                time: new Date(log.timestamp).toLocaleTimeString(),
                createdAt: log.timestamp,
                user: activeShift?.cashier.name || 'Staff'
            });
        }
    });

    const openingFloat = activeShift ? activeShift.startingCash : 0;
    const currentBalance = Math.max(0, openingFloat + cashSales - cashRefunds + totalPayIn - totalPayOut);

    return {
        activeShift,
        openingFloat,
        cashSales,
        cashRefunds,
        totalPayIn,
        totalPayOut,
        currentBalance,
        activities
    };
}

// GET current till data, balance, and today's activity
router.get('/till/data', authenticate, async (_req: AuthRequest, res: Response) => {
    try {
        const state = await calculateTillState();
        res.json(state);
    } catch (error) {
        console.error('Failed to get till data:', error);
        res.status(500).json({ error: 'Failed to retrieve till data' });
    }
});

// POST Pay In
router.post('/till/pay-in', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { amount, reason } = req.body;
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: 'Valid positive amount in ₱ is required.' });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Reason is required for Pay In.' });
        }

        const activeShift = await prisma.shift.findFirst({
            where: { cashierId: req.user!.id, status: 'OPEN' }
        });
        if (!activeShift) return res.status(400).json({ error: 'You must have an open shift to perform till actions.' });

        await prisma.cashDrawerEvent.create({
            data: {
                shiftId: activeShift.id,
                type: 'IN',
                amount: numAmount,
                reason: reason.trim()
            }
        });

        // Keep AuditLog for legacy tracking if needed
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'PAY_IN',
                entity: 'CashDrawer',
                details: JSON.stringify({ amount: numAmount, reason: reason.trim() })
            }
        });

        const state = await calculateTillState();
        res.json({ success: true, message: `Pay in of ₱${numAmount.toFixed(2)} recorded.`, currentBalance: state.currentBalance });
    } catch (error) {
        console.error('Pay in error:', error);
        res.status(500).json({ error: 'Failed to process Pay In.' });
    }
});

// POST Pay Out
router.post('/till/pay-out', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { amount, reason } = req.body;
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: 'Valid positive amount in ₱ is required.' });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Reason is required for Pay Out.' });
        }

        const state = await calculateTillState();
        if (numAmount > state.currentBalance) {
            return res.status(400).json({
                error: `Payout of ₱${numAmount.toFixed(2)} exceeds current till balance of ₱${state.currentBalance.toFixed(2)}.`
            });
        }

        const activeShift = await prisma.shift.findFirst({
            where: { cashierId: req.user!.id, status: 'OPEN' }
        });
        if (!activeShift) return res.status(400).json({ error: 'You must have an open shift to perform till actions.' });

        await prisma.cashDrawerEvent.create({
            data: {
                shiftId: activeShift.id,
                type: 'OUT',
                amount: numAmount,
                reason: reason.trim()
            }
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'PAY_OUT',
                entity: 'CashDrawer',
                details: JSON.stringify({ amount: numAmount, reason: reason.trim() })
            }
        });

        const updatedState = await calculateTillState();
        res.json({ success: true, message: `Pay out of ₱${numAmount.toFixed(2)} recorded.`, currentBalance: updatedState.currentBalance });
    } catch (error) {
        console.error('Pay out error:', error);
        res.status(500).json({ error: 'Failed to process Pay Out.' });
    }
});

// POST Open Drawer (No Sale)
router.post('/till/open-drawer', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { reason } = req.body;

        const activeShift = await prisma.shift.findFirst({
            where: { cashierId: req.user!.id, status: 'OPEN' }
        });
        if (!activeShift) return res.status(400).json({ error: 'You must have an open shift to perform till actions.' });

        await prisma.cashDrawerEvent.create({
            data: {
                shiftId: activeShift.id,
                type: 'NO_SALE',
                amount: 0,
                reason: (reason && reason.trim()) || 'No Sale'
            }
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'NO_SALE',
                entity: 'CashDrawer',
                details: JSON.stringify({ amount: 0, reason: (reason && reason.trim()) || 'No Sale' })
            }
        });

        res.json({ success: true, message: 'Drawer opening triggered. No Sale activity logged.' });
    } catch (error) {
        console.error('Open drawer error:', error);
        res.status(500).json({ error: 'Failed to log drawer opening.' });
    }
});

export default router;

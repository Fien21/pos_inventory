import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// GET all payment modes
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const activeOnly = req.query.active === 'true' || req.user!.role === 'CASHIER';
        const where = activeOnly ? { isActive: true } : {};

        const modes = await (prisma as any).paymentMode.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        res.json(modes);
    } catch (error: any) {
        console.error('Get payment modes error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch payment modes.' });
    }
});

// POST create payment mode (ADMIN or STAFF only)
router.post('/', authenticate, authorize('ADMIN', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, description, isActive } = req.body;

        if (!name || !name.trim()) {
            res.status(400).json({ error: 'Name is required.' });
            return;
        }

        // Check uniqueness
        const existing = await (prisma as any).paymentMode.findUnique({
            where: { name: name.trim() },
        });
        if (existing) {
            res.status(400).json({ error: 'A payment mode with this name already exists.' });
            return;
        }

        const mode = await (prisma as any).paymentMode.create({
            data: {
                name: name.trim(),
                description: description || '',
                isActive: isActive !== undefined ? Boolean(isActive) : true,
            },
        });

        res.status(201).json(mode);
    } catch (error: any) {
        console.error('Create payment mode error:', error);
        res.status(500).json({ error: error.message || 'Failed to create payment mode.' });
    }
});

// PUT update payment mode (ADMIN or STAFF only)
router.put('/:id', authenticate, authorize('ADMIN', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const { name, description, isActive } = req.body;

        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID.' });
            return;
        }

        const existingMode = await (prisma as any).paymentMode.findUnique({ where: { id } });
        if (!existingMode) {
            res.status(404).json({ error: 'Payment mode not found.' });
            return;
        }

        const data: any = {};
        if (name !== undefined) {
            if (!name || !name.trim()) {
                res.status(400).json({ error: 'Name cannot be empty.' });
                return;
            }
            // Check uniqueness if name changed
            if (name.trim().toLowerCase() !== existingMode.name.toLowerCase()) {
                const dup = await (prisma as any).paymentMode.findUnique({ where: { name: name.trim() } });
                if (dup) {
                    res.status(400).json({ error: 'A payment mode with this name already exists.' });
                    return;
                }
            }
            data.name = name.trim();
        }

        if (description !== undefined) {
            data.description = description || '';
        }

        if (isActive !== undefined) {
            data.isActive = Boolean(isActive);
        }

        const mode = await (prisma as any).paymentMode.update({
            where: { id },
            data,
        });

        res.json(mode);
    } catch (error: any) {
        console.error('Update payment mode error:', error);
        res.status(500).json({ error: error.message || 'Failed to update payment mode.' });
    }
});

// DELETE payment mode (ADMIN or STAFF only)
router.delete('/:id', authenticate, authorize('ADMIN', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID.' });
            return;
        }

        const existingMode = await (prisma as any).paymentMode.findUnique({ where: { id } });
        if (!existingMode) {
            res.status(404).json({ error: 'Payment mode not found.' });
            return;
        }

        await (prisma as any).paymentMode.delete({ where: { id } });
        res.json({ success: true, message: 'Payment mode deleted successfully.' });
    } catch (error: any) {
        console.error('Delete payment mode error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete payment mode.' });
    }
});

export default router;

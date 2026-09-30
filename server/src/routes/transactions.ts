import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

// POST create transaction (POS checkout)
router.post('/', authenticate, authorize('ADMIN', 'CASHIER'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // Check if system is in maintenance mode
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (settings?.maintenanceMode) {
            res.status(403).json({ error: 'Checkout is disabled. System is under maintenance (Price Check Mode Only).' });
            return;
        }

        const { items, discount, paymentModeId, amountTendered, changeAmount } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Transaction must have at least one item.' });
            return;
        }

        // Calculate total and validate stock
        let totalAmount = 0;
        let totalTaxAmount = 0;
        let totalCost = 0;
        const itemsData: Array<{
            productId: number;
            quantity: number;
            price: number;
            subtotal: number;
            taxAmount: number;
            serialNumbers: string[];
        }> = [];

        for (const item of items) {
            const product = (await prisma.product.findUnique({
                where: { id: item.productId },
                include: { stockItems: true } as any
            })) as any;

            if (!product) {
                res.status(400).json({ error: `Product ID ${item.productId} not found.` });
                return;
            }

            if (product.stockQty < item.quantity) {
                res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.stockQty}` });
                return;
            }

            // Determine serial numbers to sell
            const snsToSell: string[] = item.serialNumbers || [];
            if (snsToSell.length > 0) {
                const availableSns = (product.stockItems || []).filter(
                    (s: any) => s.status === 'AVAILABLE' && snsToSell.includes(s.serialNumber)
                );
                if (availableSns.length !== snsToSell.length) {
                    res.status(400).json({
                        error: `One or more serial numbers for "${product.name}" are not available.`,
                    });
                    return;
                }
            } else {
                // Auto-pick first available
                const availableSns = (product.stockItems || []).filter((s: any) => s.status === 'AVAILABLE');
                if (availableSns.length < item.quantity) {
                    res.status(400).json({ error: `Insufficient serialized stock for ${product.name}.` });
                    return;
                }
                snsToSell.push(...availableSns.slice(0, item.quantity).map((s: any) => s.serialNumber));
            }

            // Calculate price & margin tax
            const unitRetail = product.retailPrice > 0 ? product.retailPrice : product.price;
            const taxRate = product.taxRate;

            let unitTax = 0;
            let unitSellingPrice = unitRetail;

            if (taxRate > 0) {
                if (product.taxInclusive) {
                    // VAT Inclusive: tax is part of the total price
                    const netBase = unitRetail / (1 + taxRate / 100);
                    unitTax = unitRetail - netBase;
                    unitSellingPrice = unitRetail;
                } else {
                    // VAT Exclusive: tax is added on top of base retail price
                    unitTax = unitRetail * (taxRate / 100);
                    unitSellingPrice = unitRetail + unitTax;
                }
            }

            const itemSubtotal = unitSellingPrice * item.quantity;
            const itemTaxTotal = unitTax * item.quantity;
            const itemCostTotal = (product.costPrice || 0) * item.quantity;

            totalAmount += itemSubtotal;
            totalTaxAmount += itemTaxTotal;
            totalCost += itemCostTotal;

            itemsData.push({
                productId: product.id,
                quantity: item.quantity,
                price: unitSellingPrice,
                subtotal: itemSubtotal,
                taxAmount: itemTaxTotal,
                serialNumbers: snsToSell,
            });
        }

        const discountAmount = discount || 0;
        totalAmount = totalAmount - discountAmount;

        // Resolve payment mode name
        let resolvedPaymentModeName: string | null = null;
        if (paymentModeId) {
            const pm = await (prisma as any).paymentMode.findUnique({
                where: { id: Number(paymentModeId) }
            });
            if (pm) {
                resolvedPaymentModeName = pm.name;
            }
        }

        // Create transaction and deduct stock in a transaction
        const transaction = await prisma.$transaction(async (tx: any) => {
            const txn = await tx.transaction.create({
                data: {
                    cashierId: req.user!.id,
                    totalAmount,
                    taxAmount: totalTaxAmount,
                    discount: discountAmount,
                    paymentModeId: paymentModeId ? Number(paymentModeId) : null,
                    paymentModeName: resolvedPaymentModeName,
                    amountTendered: amountTendered !== undefined ? Number(amountTendered) : null,
                    changeAmount: changeAmount !== undefined ? Number(changeAmount) : null,
                    items: {
                        create: itemsData.map((i) => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            price: i.price,
                            subtotal: i.subtotal,
                            taxAmount: i.taxAmount,
                        })),
                    },
                } as any,
                include: {
                    items: { include: { product: true, stockItems: true } as any },
                    cashier: { select: { name: true, role: true } },
                    paymentMode: true,
                } as any,
            });

            // Mark stock items as SOLD and link to their transaction items
            for (const item of (txn.items || [])) {
                const matchedItemData = itemsData.find((id) => id.productId === item.productId);
                if (matchedItemData && matchedItemData.serialNumbers.length > 0) {
                    await tx.stockItem.updateMany({
                        where: {
                            serialNumber: { in: matchedItemData.serialNumbers },
                        },
                        data: {
                            status: 'SOLD',
                            transactionItemId: item.id,
                        },
                    });
                }
            }

            // Deduct stock qty on products
            for (const item of itemsData) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stockQty: { decrement: item.quantity } },
                });
            }

            // Re-fetch to get updated relations (like newly linked stockItems)
            const finalTxn = await tx.transaction.findUnique({
                where: { id: txn.id },
                include: {
                    items: { include: { product: true, stockItems: true } as any },
                    cashier: { select: { name: true, role: true } },
                    paymentMode: true,
                } as any,
            });
            return finalTxn;
        });

        const profit = transaction.totalAmount - totalCost;
        await logAudit(req.user!.id, 'TRANSACTION_CREATE', 'Transaction', transaction.id, { totalAmount: transaction.totalAmount, profit });

        res.status(201).json(transaction);
    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({ error: 'Failed to create transaction.' });
    }
});

// GET all transactions
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { startDate, endDate, cashierId } = req.query;
        const where: any = {};

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(String(startDate)),
                lte: new Date(String(endDate)),
            };
        }

        if (cashierId) {
            where.cashierId = Number(cashierId);
        }

        // Non-admin cashiers can only see their own transactions
        if (req.user!.role === 'CASHIER') {
            where.cashierId = req.user!.id;
        }

        const transactions = await prisma.transaction.findMany({
            where,
            include: {
                items: { include: { product: true, stockItems: true } as any },
                cashier: { select: { name: true, email: true, role: true } },
                paymentMode: true,
            } as any,
            orderBy: { createdAt: 'desc' },
        });
        res.json(transactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions.' });
    }
});

// GET dashboard stats
router.get('/stats/dashboard', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const totalProducts = await prisma.product.count();
        const lowStockProducts = await prisma.product.count({ where: { stockQty: { lte: 10 } } });
        const totalTransactions = await prisma.transaction.count({ where: { status: { not: 'VOIDED' } } });
        const totalCategories = await prisma.category.count();

        // Today's sales
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySales = await prisma.transaction.aggregate({
            where: { createdAt: { gte: today }, status: { not: 'VOIDED' } },
            _sum: { totalAmount: true },
            _count: true,
        });

        // Recent transactions
        const recentTransactions = await prisma.transaction.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                cashier: { select: { name: true } },
                _count: { select: { items: true } },
            },
        });

        res.json({
            totalProducts,
            lowStockProducts,
            totalTransactions,
            totalCategories,
            todaySalesAmount: todaySales._sum.totalAmount || 0,
            todaySalesCount: todaySales._count,
            recentTransactions,
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
    }
});

// GET stats for charts (ADMIN only)
router.get('/stats/charts', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const transactions = await prisma.transaction.findMany({
            where: { createdAt: { gte: sevenDaysAgo }, status: { not: 'VOIDED' } },
            orderBy: { createdAt: 'asc' },
        });

        const salesByDay: { [key: string]: { date: string; amount: number; count: number } } = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const key = d.toISOString().split('T')[0];
            salesByDay[key] = { date: dateStr, amount: 0, count: 0 };
        }

        transactions.forEach(t => {
            const key = new Date(t.createdAt).toISOString().split('T')[0];
            if (salesByDay[key]) {
                salesByDay[key].amount += t.totalAmount;
                salesByDay[key].count += 1;
            }
        });

        const salesOverTime = Object.keys(salesByDay).sort().map(key => salesByDay[key]);

        const categories = await prisma.category.findMany({
            include: {
                products: {
                    select: { stockQty: true }
                }
            }
        });

        const stockByCategory = categories.map(cat => {
            const totalStock = cat.products.reduce((sum, p) => sum + p.stockQty, 0);
            return {
                categoryName: cat.name,
                stockQty: totalStock
            };
        });

        res.json({
            salesOverTime,
            stockByCategory
        });
    } catch (error) {
        console.error('Charts stats error:', error);
        res.status(500).json({ error: 'Failed to fetch charts stats.' });
    }
});

// GET single transaction
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const transaction = await prisma.transaction.findUnique({
            where: { id: Number(req.params.id) },
            include: {
                items: { include: { product: true, stockItems: true } as any },
                cashier: { select: { name: true, email: true, role: true } },
                paymentMode: true,
            } as any,
        });
        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found.' });
            return;
        }
        res.json(transaction);
    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({ error: 'Failed to fetch transaction.' });
    }
});

// POST void transaction
router.post('/:id/void', authenticate, authorize('ADMIN', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: {
                items: { include: { stockItems: true } as any }
            } as any
        }) as any;

        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found.' });
            return;
        }

        if (transaction.status === 'VOIDED') {
            res.status(400).json({ error: 'Transaction is already voided.' });
            return;
        }

        // Revert in a database transaction
        await prisma.$transaction(async (tx: any) => {
            // 1. Update transaction status
            await tx.transaction.update({
                where: { id },
                data: { status: 'VOIDED' }
            });

            // 2. Revert each item's stock qty and stock item statuses
            for (const item of (transaction.items || [])) {
                // Return stockItems back to AVAILABLE and unlink
                await tx.stockItem.updateMany({
                    where: { transactionItemId: item.id },
                    data: {
                        status: 'AVAILABLE',
                        transactionItemId: null
                    }
                });

                // Increment product stockQty
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stockQty: { increment: item.quantity } }
                });
            }
        });

        await logAudit(req.user!.id, 'TRANSACTION_VOID', 'Transaction', id, { totalAmount: transaction.totalAmount });

        res.json({ message: 'Transaction voided successfully.' });
    } catch (error) {
        console.error('Void transaction error:', error);
        res.status(500).json({ error: 'Failed to void transaction.' });
    }
});

export default router;

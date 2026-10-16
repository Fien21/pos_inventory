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

        const { items, discount, discountType, discountValue, customerId, paymentModeId, amountTendered, changeAmount } = req.body;

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
            costPrice: number;
            subtotal: number;
            taxAmount: number;
            serialNumbers: string[];
            isBundle?: boolean;
            bundleItems?: any[];
        }> = [];

        for (const item of items) {
            const product = (await prisma.product.findUnique({
                where: { id: item.productId },
                include: { stockItems: true, bundleItems: true } as any
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
                costPrice: product.costPrice || 0,
                subtotal: itemSubtotal,
                taxAmount: itemTaxTotal,
                serialNumbers: snsToSell,
                isBundle: product.isBundle,
                bundleItems: product.bundleItems,
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
            const activeShift = await tx.shift.findFirst({
                where: { cashierId: req.user!.id, status: 'OPEN' }
            });

            const txn = await tx.transaction.create({
                data: {
                    cashierId: req.user!.id,
                    branchId: req.user?.branchId || null,
                    shiftId: activeShift ? activeShift.id : null,
                    customerId: customerId ? Number(customerId) : null,
                    status: req.body.status || 'COMPLETED',
                    totalAmount,
                    taxAmount: totalTaxAmount,
                    discount: discountAmount,
                    discountType: discountType || null,
                    discountValue: discountValue ? Number(discountValue) : 0,
                    paymentModeId: paymentModeId ? Number(paymentModeId) : null,
                    paymentModeName: req.body.dueDate && req.body.status === 'LAYAWAY' ? `Layaway (Due: ${req.body.dueDate})` : resolvedPaymentModeName,
                    amountTendered: amountTendered !== undefined ? Number(amountTendered) : null,
                    changeAmount: changeAmount !== undefined ? Number(changeAmount) : null,
                    items: {
                        create: itemsData.map((i) => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            price: i.price,
                            costPrice: i.costPrice,
                            subtotal: i.subtotal,
                            taxAmount: i.taxAmount,
                        })),
                    },
                    payments: {
                        create: req.body.payments ? req.body.payments.map((p: any) => ({
                            paymentModeId: p.paymentModeId ? Number(p.paymentModeId) : null,
                            paymentModeName: p.paymentModeName || 'Unknown',
                            amount: Number(p.amount) || 0
                        })) : paymentModeId ? [{
                            paymentModeId: Number(paymentModeId),
                            paymentModeName: resolvedPaymentModeName || 'Unknown',
                            amount: amountTendered !== undefined ? Number(amountTendered) : totalAmount
                        }] : []
                    }
                } as any,
                include: {
                    items: { include: { product: true, stockItems: true, returnItems: true } as any },
                    payments: true,
                    cashier: { select: { name: true, role: true } },
                    paymentMode: true,
                    customer: true,
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

                if (item.isBundle && item.bundleItems && item.bundleItems.length > 0) {
                    for (const bi of item.bundleItems) {
                        const qtyToDeduct = item.quantity * (parseInt(bi.quantity) || 1);
                        await tx.product.update({
                            where: { id: bi.productId },
                            data: { stockQty: { decrement: qtyToDeduct } },
                        });
                    }
                }
            }

            // Handle Customer Ledger if customer is present
            if (customerId) {
                // Earn points (1 point per 100 spent)
                const earnedPoints = Math.floor(totalAmount / 100);
                if (earnedPoints > 0) {
                    await tx.customerLedger.create({
                        data: {
                            customerId: Number(customerId),
                            transactionId: txn.id,
                            type: 'POINTS',
                            amount: earnedPoints,
                            reason: 'Points earned from purchase'
                        }
                    });
                    await tx.customer.update({
                        where: { id: Number(customerId) },
                        data: { loyaltyPoints: { increment: earnedPoints } }
                    });
                }
                
                // If paid with store credit
                const storeCreditPayment = req.body.payments?.find((p: any) => p.paymentModeName === 'Store Credit');
                if (storeCreditPayment) {
                    const scAmount = Number(storeCreditPayment.amount) || 0;
                    await tx.customerLedger.create({
                        data: {
                            customerId: Number(customerId),
                            transactionId: txn.id,
                            type: 'STORE_CREDIT',
                            amount: -scAmount,
                            reason: 'Used store credit for purchase'
                        }
                    });
                    await tx.customer.update({
                        where: { id: Number(customerId) },
                        data: { storeCredit: { decrement: scAmount } }
                    });
                }
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
        const { startDate, endDate, cashierId, status } = req.query;
        const where: any = {};

        if (status) {
            where.status = String(status);
        } else {
            where.status = { not: 'PENDING' };
        }

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(String(startDate)),
                lte: new Date(String(endDate)),
            };
        }

        if (cashierId) {
            where.cashierId = Number(cashierId);
        }

        // If cashier requests transactions, filter to their own unless querying layaways or explicitly viewing store receipts
        if (req.user!.role === 'CASHIER' && status !== 'LAYAWAY' && req.query.all !== 'true') {
            where.cashierId = req.user!.id;
        }

        const transactions = await prisma.transaction.findMany({
            where,
            include: {
                items: { include: { product: true, stockItems: true, returnItems: true } as any },
                cashier: { select: { name: true, email: true, role: true } },
                paymentMode: true,
                customer: true,
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
        const totalTransactions = await prisma.transaction.count({ where: { status: 'COMPLETED' } });
        const totalCategories = await prisma.category.count();

        // Today's sales
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySales = await prisma.transaction.aggregate({
            where: { createdAt: { gte: today }, status: 'COMPLETED' },
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

// GET stats for charts (Dashboard live metrics)
router.get('/stats/charts', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const transactions = await prisma.transaction.findMany({
            where: { createdAt: { gte: sevenDaysAgo }, status: 'COMPLETED' },
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

// GET single transaction (supports numeric ID or formatted receipt number like AP-20261006-00001 or RC-1)
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const rawParam = String(req.params.id).trim();
        const numMatch = rawParam.match(/(\d+)$/);
        const txnId = numMatch ? parseInt(numMatch[1], 10) : parseInt(rawParam, 10);

        if (isNaN(txnId)) {
            res.status(404).json({ error: 'Invalid receipt ID format.' });
            return;
        }

        const transaction = await prisma.transaction.findUnique({
            where: { id: txnId },
            include: {
                items: { include: { product: true, stockItems: true, returnItems: true } as any },
                cashier: { select: { name: true, email: true, role: true } },
                paymentMode: true,
                customer: true,
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
                const p = await tx.product.update({
                    where: { id: item.productId },
                    data: { stockQty: { increment: item.quantity } },
                    include: { bundleItems: true } as any
                });

                if (p.isBundle && p.bundleItems && p.bundleItems.length > 0) {
                    for (const bi of p.bundleItems) {
                        const qtyToIncrement = item.quantity * (parseInt(bi.quantity) || 1);
                        await tx.product.update({
                            where: { id: bi.productId },
                            data: { stockQty: { increment: qtyToIncrement } },
                        });
                    }
                }
            }
        });

        await logAudit(req.user!.id, 'TRANSACTION_VOID', 'Transaction', id, { totalAmount: transaction.totalAmount });

        res.json({ message: 'Transaction voided successfully.' });
    } catch (error) {
        console.error('Void transaction error:', error);
        res.status(500).json({ error: 'Failed to void transaction.' });
    }
});

// POST queue transaction (Draft for Cashier)
router.post('/queue', authenticate, authorize('ADMIN', 'CASHIER', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { items, discount, queueNumber } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Transaction must have at least one item.' });
            return;
        }

        let totalAmount = 0;
        let totalTaxAmount = 0;
        const itemsData: any[] = [];

        for (const item of items) {
            const product = await prisma.product.findUnique({ where: { id: item.productId } });
            if (!product) continue;

            const unitRetail = product.retailPrice > 0 ? product.retailPrice : product.price;
            const taxRate = product.taxRate;
            let unitTax = 0;
            let unitSellingPrice = unitRetail;

            if (taxRate > 0) {
                if (product.taxInclusive) {
                    const netBase = unitRetail / (1 + taxRate / 100);
                    unitTax = unitRetail - netBase;
                    unitSellingPrice = unitRetail;
                } else {
                    unitTax = unitRetail * (taxRate / 100);
                    unitSellingPrice = unitRetail + unitTax;
                }
            }

            const itemSubtotal = unitSellingPrice * item.quantity;
            const itemTaxTotal = unitTax * item.quantity;

            totalAmount += itemSubtotal;
            totalTaxAmount += itemTaxTotal;

            itemsData.push({
                productId: product.id,
                quantity: item.quantity,
                price: unitSellingPrice,
                subtotal: itemSubtotal,
                taxAmount: itemTaxTotal,
            });
        }

        const transaction = await prisma.transaction.create({
            data: {
                cashierId: req.user!.id,
                totalAmount: totalAmount - (discount || 0),
                taxAmount: totalTaxAmount,
                discount: discount || 0,
                status: 'PENDING',
                paymentModeName: queueNumber ? `Queue: ${queueNumber}` : null,
                items: {
                    create: itemsData,
                },
            } as any
        });

        res.status(201).json(transaction);
    } catch (error) {
        console.error('Queue error:', error);
        res.status(500).json({ error: 'Failed to queue transaction.' });
    }
});

// POST pay layaway transaction
router.post('/:id/pay-layaway', authenticate, authorize('ADMIN', 'CASHIER', 'STAFF', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const { paymentModeId, paymentModeName, amount } = req.body;

        const transaction = await prisma.transaction.findUnique({
            where: { id }
        });

        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found.' });
            return;
        }

        if (transaction.status !== 'LAYAWAY') {
            res.status(400).json({ error: 'Transaction is not a layaway.' });
            return;
        }

        if (!amount || Number(amount) <= 0) {
            res.status(400).json({ error: 'Valid payment amount is required.' });
            return;
        }

        const paymentAmount = Number(amount);
        const newAmountTendered = (transaction.amountTendered || 0) + paymentAmount;
        const totalDue = transaction.totalAmount;

        let newStatus = transaction.status;
        let changeAmount = transaction.changeAmount || 0;

        if (newAmountTendered >= totalDue) {
            newStatus = 'COMPLETED';
            changeAmount = newAmountTendered - totalDue;
        }

        const updatedTxn = await prisma.$transaction(async (tx: any) => {
            // 1. Update transaction status and amount tendered
            const txn = await tx.transaction.update({
                where: { id },
                data: { 
                    status: newStatus,
                    amountTendered: newAmountTendered,
                    changeAmount
                }
            });

            // 2. Create the TransactionPayment
            await tx.transactionPayment.create({
                data: {
                    transactionId: id,
                    paymentModeId: paymentModeId ? Number(paymentModeId) : null,
                    paymentModeName: paymentModeName || 'Unknown',
                    amount: paymentAmount
                }
            });

            return txn;
        });

        res.json({ message: 'Payment applied successfully.', transaction: updatedTxn });
    } catch (error) {
        console.error('Pay layaway error:', error);
        res.status(500).json({ error: 'Failed to apply payment to layaway.' });
    }
});

// POST return/refund transaction
router.post('/:id/return', authenticate, authorize('ADMIN', 'CASHIER', 'STAFF', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const rawParam = String(req.params.id).trim();
        const numMatch = rawParam.match(/(\d+)$/);
        const id = numMatch ? parseInt(numMatch[1], 10) : parseInt(rawParam, 10);

        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid transaction receipt ID.' });
            return;
        }

        const { returnItems } = req.body; // Array of { transactionItemId, quantity, reason }

        if (!returnItems || !Array.isArray(returnItems) || returnItems.length === 0) {
            res.status(400).json({ error: 'No items provided for return.' });
            return;
        }

        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found.' });
            return;
        }

        if (transaction.status === 'VOIDED') {
            res.status(400).json({ error: 'Cannot return items from a voided transaction.' });
            return;
        }

        if (transaction.status === 'REFUNDED') {
            res.status(400).json({ error: 'This transaction has already been fully refunded.' });
            return;
        }

        await prisma.$transaction(async (tx: any) => {
            let totalRefund = 0;

            for (const reqItem of returnItems) {
                const txItem = transaction.items.find((i: any) => i.id === reqItem.transactionItemId);
                if (!txItem) {
                    throw new Error(`Transaction item ${reqItem.transactionItemId} not found in this transaction.`);
                }
                
                // Validate return quantity against original quantity minus already returned
                const alreadyReturned = await tx.returnItem.aggregate({
                    where: { transactionItemId: txItem.id },
                    _sum: { quantity: true }
                });
                
                const returnedQty = alreadyReturned._sum.quantity || 0;
                const availableToReturn = txItem.quantity - returnedQty;
                if (reqItem.quantity <= 0 || reqItem.quantity > availableToReturn) {
                    throw new Error(`Return quantity (${reqItem.quantity}) exceeds available refundable quantity (${availableToReturn}) for product.`);
                }

                // Calculate refund amount for this item
                const refundAmount = (txItem.subtotal / txItem.quantity) * reqItem.quantity;
                totalRefund += refundAmount;

                // Create ReturnItem record
                await tx.returnItem.create({
                    data: {
                        transactionItemId: txItem.id,
                        quantity: reqItem.quantity,
                        reason: reqItem.reason || 'Customer Return',
                        refundAmount
                    }
                });

                // Increase stock
                const product = await tx.product.update({
                    where: { id: txItem.productId },
                    data: { stockQty: { increment: reqItem.quantity } },
                    include: { bundleItems: true }
                });

                // If bundle, increase stock for bundle parts
                if (product.isBundle && product.bundleItems) {
                    for (const bi of product.bundleItems) {
                        const qtyToIncrement = reqItem.quantity * (parseInt(bi.quantity) || 1);
                        await tx.product.update({
                            where: { id: bi.productId },
                            data: { stockQty: { increment: qtyToIncrement } },
                        });
                    }
                }
            }

            // Update transaction refundStatus and status
            const allTxItems = await tx.transactionItem.findMany({ where: { transactionId: id } });
            let totalReturnedQty = 0;
            let totalOriginalQty = 0;
            
            for (const i of allTxItems) {
                totalOriginalQty += i.quantity;
                const ret = await tx.returnItem.aggregate({
                    where: { transactionItemId: i.id },
                    _sum: { quantity: true }
                });
                totalReturnedQty += (ret._sum.quantity || 0);
            }

            let newRefundStatus = 'PARTIAL';
            if (totalReturnedQty >= totalOriginalQty) {
                newRefundStatus = 'FULL';
            }

            await tx.transaction.update({
                where: { id },
                data: {
                    refundStatus: newRefundStatus,
                    status: newRefundStatus === 'FULL' ? 'REFUNDED' : transaction.status
                }
            });

            // Adjust cash drawer balance if cash transaction
            const isCash = !transaction.paymentModeName || transaction.paymentModeName.toLowerCase().includes('cash');
            if (isCash && totalRefund > 0) {
                await tx.auditLog.create({
                    data: {
                        userId: req.user!.id,
                        action: 'PAY_OUT',
                        entity: 'CashDrawer',
                        details: JSON.stringify({ amount: totalRefund, reason: `Refund on Receipt AP-${id}` })
                    }
                });
            }
        });

        await logAudit(req.user!.id, 'TRANSACTION_RETURN', 'Transaction', id, { items: returnItems });
        res.json({ message: 'Return processed successfully.' });
    } catch (error: any) {
        console.error('Return transaction error:', error);
        res.status(500).json({ error: error.message || 'Failed to process return.' });
    }
});

// DELETE transaction (mostly for pending queue)
router.delete('/:id', authenticate, authorize('ADMIN', 'CASHIER', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const transaction = await prisma.transaction.findUnique({ where: { id } });
        
        if (!transaction) {
            res.status(404).json({ error: 'Not found' });
            return;
        }

        if (transaction.status !== 'PENDING') {
            res.status(400).json({ error: 'Can only delete pending transactions.' });
            return;
        }

        await prisma.transaction.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({ error: 'Failed to delete transaction.' });
    }
});

// POST bulk sync offline transactions
router.post('/sync-bulk', authenticate, authorize('ADMIN', 'CASHIER', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { transactions } = req.body;
        if (!transactions || !Array.isArray(transactions)) {
            res.status(400).json({ error: 'Invalid payload.' });
            return;
        }

        const results = [];
        for (const txn of transactions) {
            try {
                const { items, paymentModeId, amountTendered, discount, discountType, discountValue, customerId, shiftId, createdAt } = txn;
                
                const processed = await prisma.$transaction(async (tx: any) => {
                    let totalAmount = 0;
                    let totalTaxAmount = 0;
                    const itemsData: any[] = [];

                    for (const item of items) {
                        const product = await tx.product.findUnique({ where: { id: item.productId } });
                        if (!product) throw new Error(`Product ${item.productId} not found`);

                        const unitRetail = product.retailPrice > 0 ? product.retailPrice : product.price;
                        const taxRate = product.taxRate;
                        let unitTax = 0;
                        let unitSellingPrice = unitRetail;

                        if (taxRate > 0) {
                            if (product.taxInclusive) {
                                unitSellingPrice = unitRetail;
                                unitTax = unitRetail - (unitRetail / (1 + (taxRate / 100)));
                            } else {
                                unitTax = unitRetail * (taxRate / 100);
                                unitSellingPrice = unitRetail + unitTax;
                            }
                        }

                        const lineTotal = unitSellingPrice * item.quantity;
                        const lineTax = unitTax * item.quantity;

                        totalAmount += lineTotal;
                        totalTaxAmount += lineTax;

                        itemsData.push({
                            productId: product.id,
                            quantity: item.quantity,
                            price: unitSellingPrice,
                            subtotal: lineTotal,
                            taxAmount: lineTax,
                            specificSns: item.specificSns || []
                        });

                        const qtyToDeduct = item.specificSns && item.specificSns.length > 0 
                            ? item.specificSns.length 
                            : item.quantity;

                        await tx.product.update({
                            where: { id: product.id },
                            data: { stockQty: { decrement: qtyToDeduct } },
                        });
                    }

                    // Apply transaction-level discount
                    let finalTotal = totalAmount;
                    let calculatedDiscount = discount || 0;
                    if (discountType === 'PERCENTAGE' && discountValue) {
                        calculatedDiscount = totalAmount * (discountValue / 100);
                    } else if (discountType === 'FIXED' && discountValue) {
                        calculatedDiscount = discountValue;
                    }
                    finalTotal -= calculatedDiscount;
                    if (finalTotal < 0) finalTotal = 0;

                    const changeAmount = amountTendered ? amountTendered - finalTotal : 0;

                    let paymentModeName = null;
                    if (paymentModeId) {
                        const pm = await tx.paymentMode.findUnique({ where: { id: paymentModeId } });
                        if (pm) paymentModeName = pm.name;
                    }

                    const newTxn = await tx.transaction.create({
                        data: {
                            cashierId: req.user!.id,
                            totalAmount: finalTotal,
                            taxAmount: totalTaxAmount,
                            discount: calculatedDiscount,
                            paymentModeId: paymentModeId || null,
                            paymentModeName,
                            amountTendered: amountTendered || null,
                            changeAmount: changeAmount >= 0 ? changeAmount : 0,
                            customerId: customerId || null,
                            discountType: discountType || null,
                            discountValue: discountValue || null,
                            shiftId: shiftId || null,
                            status: 'COMPLETED',
                            createdAt: createdAt ? new Date(createdAt) : undefined,
                            items: {
                                create: itemsData.map((idat) => ({
                                    productId: idat.productId,
                                    quantity: idat.quantity,
                                    price: idat.price,
                                    subtotal: idat.subtotal,
                                    taxAmount: idat.taxAmount
                                }))
                            }
                        },
                        include: { items: true }
                    });

                    // Update stock items
                    for (let i = 0; i < itemsData.length; i++) {
                        const idat = itemsData[i];
                        const txnItem = newTxn.items.find((ti: any) => ti.productId === idat.productId);
                        if (!txnItem) continue;

                        if (idat.specificSns && idat.specificSns.length > 0) {
                            await tx.stockItem.updateMany({
                                where: { serialNumber: { in: idat.specificSns } },
                                data: { status: 'SOLD', transactionItemId: txnItem.id }
                            });
                        } else {
                            const availableStocks = await tx.stockItem.findMany({
                                where: { productId: idat.productId, status: 'AVAILABLE' },
                                take: idat.quantity
                            });
                            if (availableStocks.length > 0) {
                                await tx.stockItem.updateMany({
                                    where: { id: { in: availableStocks.map((s: any) => s.id) } },
                                    data: { status: 'SOLD', transactionItemId: txnItem.id }
                                });
                            }
                        }
                    }

                    if (customerId && finalTotal > 0) {
                        const pointsEarned = Math.floor(finalTotal / 100);
                        await tx.customer.update({
                            where: { id: customerId },
                            data: { loyaltyPoints: { increment: pointsEarned } }
                        });
                    }

                    return newTxn;
                });
                
                results.push({ id: txn.offlineId, success: true, transactionId: processed.id });
            } catch (err: any) {
                results.push({ id: txn.offlineId, success: false, error: err.message });
            }
        }

        res.json({ success: true, results });
    } catch (error) {
        console.error('Sync bulk error:', error);
        res.status(500).json({ error: 'Failed to sync transactions.' });
    }
});

export default router;

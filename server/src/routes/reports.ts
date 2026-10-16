import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// GET Sales Summary
router.get('/sales-summary', authenticate, authorize('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { startDate, endDate } = req.query;
        const where: any = { status: 'COMPLETED' };

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate as string),
                lte: new Date(endDate as string)
            };
        }

        const transactions = await prisma.transaction.findMany({ 
            where,
            include: { items: true }
        });

        let grossSales = 0;
        let totalDiscount = 0;
        let totalTax = 0;
        let netSales = 0;
        let totalCogs = 0;

        transactions.forEach(txn => {
            grossSales += txn.totalAmount + txn.discount;
            totalDiscount += txn.discount;
            totalTax += txn.taxAmount;
            netSales += txn.totalAmount - txn.taxAmount;
            
            txn.items.forEach((item: any) => {
                totalCogs += (item.costPrice || 0) * item.quantity;
            });
        });

        const grossProfit = netSales - totalCogs;

        res.json({
            grossSales,
            totalDiscount,
            totalTax,
            netSales,
            totalCogs,
            grossProfit,
            transactionCount: transactions.length
        });
    } catch (error: any) {
        console.error('Failed to fetch sales summary:', error);
        res.status(500).json({ error: 'Failed to fetch sales summary' });
    }
});

// GET Sales by Category
router.get('/sales-by-category', authenticate, authorize('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { startDate, endDate } = req.query;
        const where: any = { transaction: { status: 'COMPLETED' } };

        if (startDate && endDate) {
            where.transaction.createdAt = {
                gte: new Date(startDate as string),
                lte: new Date(endDate as string)
            };
        }

        const items = await prisma.transactionItem.findMany({
            where,
            include: {
                product: {
                    include: { category: true }
                }
            }
        });

        const categoryMap: { [key: string]: { name: string, quantity: number, totalAmount: number } } = {};

        items.forEach(item => {
            if (!item.product || !item.product.category) return;
            const catName = item.product.category.name;
            if (!categoryMap[catName]) {
                categoryMap[catName] = { name: catName, quantity: 0, totalAmount: 0 };
            }
            categoryMap[catName].quantity += item.quantity;
            categoryMap[catName].totalAmount += item.subtotal;
        });

        const result = Object.values(categoryMap).sort((a, b) => b.totalAmount - a.totalAmount);
        res.json(result);
    } catch (error: any) {
        console.error('Failed to fetch sales by category:', error);
        res.status(500).json({ error: 'Failed to fetch sales by category' });
    }
});

// GET Sales by Product (Top Selling)
router.get('/top-products', authenticate, authorize('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { startDate, endDate, limit = '10' } = req.query;
        const where: any = { transaction: { status: 'COMPLETED' } };

        if (startDate && endDate) {
            where.transaction.createdAt = {
                gte: new Date(startDate as string),
                lte: new Date(endDate as string)
            };
        }

        const items = await prisma.transactionItem.findMany({
            where,
            include: {
                product: true
            }
        });

        const productMap: { [key: number]: { id: number, name: string, quantity: number, totalAmount: number } } = {};

        items.forEach(item => {
            if (!item.product) return;
            const pId = item.product.id;
            if (!productMap[pId]) {
                productMap[pId] = { id: pId, name: item.product.name, quantity: 0, totalAmount: 0 };
            }
            productMap[pId].quantity += item.quantity;
            productMap[pId].totalAmount += item.subtotal;
        });

        const result = Object.values(productMap)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, Number(limit));

        res.json(result);
    } catch (error: any) {
        console.error('Failed to fetch top products:', error);
        res.status(500).json({ error: 'Failed to fetch top products' });
    }
});

export default router;

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get all purchase orders
router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
        const purchaseOrders = await prisma.purchaseOrder.findMany({
            include: { supplier: true, items: { include: { product: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(purchaseOrders);
    } catch (error) {
        console.error('Fetch purchase orders error:', error);
        res.status(500).json({ error: 'Failed to fetch purchase orders' });
    }
});

// Create a new purchase order
router.post('/', authenticate, async (req: Request, res: Response) => {
    try {
        const { supplierId, referenceNo, invoiceNo, items } = req.body;
        
        let totalAmount = 0;
        const createItems = items.map((item: any) => {
            const totalCost = item.expectedQuantity * item.unitCost;
            totalAmount += totalCost;
            return {
                productId: item.productId,
                expectedQuantity: item.expectedQuantity,
                unitCost: item.unitCost,
                totalCost
            };
        });

        const purchaseOrder = await prisma.purchaseOrder.create({
            data: {
                supplierId,
                branchId: (req as any).user?.branchId || null,
                referenceNo,
                invoiceNo,
                totalAmount,
                items: {
                    create: createItems
                }
            },
            include: { items: true, supplier: true }
        });

        res.status(201).json(purchaseOrder);
    } catch (error) {
        console.error('Create purchase order error:', error);
        res.status(500).json({ error: 'Failed to create purchase order' });
    }
});

// Receive a purchase order
router.post('/:id/receive', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { items } = req.body; // array of { id: purchaseOrderItemId, receivedQuantity: number }
        
        const purchaseOrder = await prisma.purchaseOrder.findUnique({
            where: { id: Number(id) },
            include: { items: true }
        });

        if (!purchaseOrder) {
            return res.status(404).json({ error: 'Purchase order not found' });
        }
        if (purchaseOrder.status === 'RECEIVED') {
            return res.status(400).json({ error: 'Purchase order already received' });
        }

        // Process receiving
        await prisma.$transaction(async (tx) => {
            for (const item of items) {
                const poItem = purchaseOrder.items.find((i: any) => i.id === item.id);
                if (poItem) {
                    await tx.purchaseOrderItem.update({
                        where: { id: item.id },
                        data: { receivedQuantity: item.receivedQuantity }
                    });
                    
                    // Update product stock
                    await tx.product.update({
                        where: { id: poItem.productId },
                        data: { stockQty: { increment: item.receivedQuantity } }
                    });
                }
            }

            await tx.purchaseOrder.update({
                where: { id: Number(id) },
                data: { status: 'RECEIVED', receivedAt: new Date() }
            });
        });

        const updatedPO = await prisma.purchaseOrder.findUnique({
            where: { id: Number(id) },
            include: { items: true, supplier: true }
        });

        res.json(updatedPO);
    } catch (error) {
        console.error('Receive purchase order error:', error);
        res.status(500).json({ error: 'Failed to receive purchase order' });
    }
});

export default router;

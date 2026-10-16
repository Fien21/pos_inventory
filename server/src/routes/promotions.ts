import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET all promotions
router.get('/', authenticate, async (req, res) => {
    try {
        const promotions = await prisma.promotion.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(promotions);
    } catch (error) {
        console.error('Get promotions error:', error);
        res.status(500).json({ error: 'Failed to fetch promotions.' });
    }
});

// POST create promotion
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const { name, description, type, value, targetType, targetId, minQuantity, isActive, startDate, endDate } = req.body;
        
        const existing = await prisma.promotion.findUnique({ where: { name } });
        if (existing) {
            res.status(400).json({ error: 'Promotion with this name already exists.' });
            return;
        }

        const promo = await prisma.promotion.create({
            data: {
                name,
                description,
                type,
                value: Number(value),
                targetType,
                targetId: targetId ? Number(targetId) : null,
                minQuantity: minQuantity ? Number(minQuantity) : null,
                isActive: isActive ?? true,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
            }
        });
        res.status(201).json(promo);
    } catch (error) {
        console.error('Create promotion error:', error);
        res.status(500).json({ error: 'Failed to create promotion.' });
    }
});

// PUT update promotion
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, description, type, value, targetType, targetId, minQuantity, isActive, startDate, endDate } = req.body;

        const promo = await prisma.promotion.update({
            where: { id },
            data: {
                name,
                description,
                type,
                value: Number(value),
                targetType,
                targetId: targetId ? Number(targetId) : null,
                minQuantity: minQuantity ? Number(minQuantity) : null,
                isActive: isActive ?? true,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
            }
        });
        res.json(promo);
    } catch (error) {
        console.error('Update promotion error:', error);
        res.status(500).json({ error: 'Failed to update promotion.' });
    }
});

// DELETE promotion
router.delete('/:id', authenticate, authorize('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        await prisma.promotion.delete({ where: { id } });
        res.json({ message: 'Promotion deleted.' });
    } catch (error) {
        console.error('Delete promotion error:', error);
        res.status(500).json({ error: 'Failed to delete promotion.' });
    }
});

export default router;

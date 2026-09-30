import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// GET all categories
router.get('/', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const categories = await prisma.category.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' },
        });
        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

// POST create category
router.post('/', authenticate, authorize('ADMIN', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Category name is required.' });
            return;
        }
        const category = await prisma.category.create({ data: { name } });
        res.status(201).json(category);
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(400).json({ error: 'Category already exists.' });
            return;
        }
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category.' });
    }
});

// PUT update category
router.put('/:id', authenticate, authorize('ADMIN', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name } = req.body;
        const category = await prisma.category.update({
            where: { id: Number(req.params.id) },
            data: { name },
        });
        res.json(category);
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Failed to update category.' });
    }
});

// DELETE category
router.delete('/:id', authenticate, authorize('ADMIN', 'STAFF'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        await prisma.category.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: 'Category deleted successfully.' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category.' });
    }
});

export default router;

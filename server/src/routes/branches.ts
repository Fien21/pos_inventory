import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET all branches
router.get('/', authenticate, async (req, res) => {
    try {
        const branches = await prisma.branch.findMany({
            orderBy: { id: 'asc' }
        });
        res.json(branches);
    } catch (error) {
        console.error('Get branches error:', error);
        res.status(500).json({ error: 'Failed to fetch branches.' });
    }
});

// POST create branch
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { name, location, isActive } = req.body;
        
        const existing = await prisma.branch.findUnique({ where: { name } });
        if (existing) {
            res.status(400).json({ error: 'Branch with this name already exists.' });
            return;
        }

        const branch = await prisma.branch.create({
            data: {
                name,
                location,
                isActive: isActive ?? true,
            }
        });
        res.status(201).json(branch);
    } catch (error) {
        console.error('Create branch error:', error);
        res.status(500).json({ error: 'Failed to create branch.' });
    }
});

// PUT update branch
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, location, isActive } = req.body;

        const branch = await prisma.branch.update({
            where: { id },
            data: {
                name,
                location,
                isActive: isActive ?? true,
            }
        });
        res.json(branch);
    } catch (error) {
        console.error('Update branch error:', error);
        res.status(500).json({ error: 'Failed to update branch.' });
    }
});

export default router;

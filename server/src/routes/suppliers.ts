import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all suppliers
router.get('/', authenticate, async (req, res) => {
    try {
        const suppliers = await (prisma as any).supplier.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(suppliers);
    } catch (error) {
        console.error('Fetch suppliers error:', error);
        res.status(500).json({ error: 'Failed to fetch suppliers.' });
    }
});

// Create supplier
router.post('/', authenticate, async (req, res) => {
    try {
        const { name, contactPerson, contactNumber, email, address, isActive } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Supplier name is required.' });
        }

        const existing = await (prisma as any).supplier.findUnique({
            where: { name }
        });
        if (existing) {
            return res.status(400).json({ error: 'Supplier name already exists.' });
        }

        const supplier = await (prisma as any).supplier.create({
            data: { 
                name, 
                contactPerson, 
                contactNumber, 
                email, 
                address,
                isActive: isActive !== undefined ? isActive : true
            }
        });
        res.status(201).json(supplier);
    } catch (error) {
        console.error('Create supplier error:', error);
        res.status(500).json({ error: 'Failed to create supplier.' });
    }
});

// Update supplier
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contactPerson, contactNumber, email, address, isActive } = req.body;

        const supplier = await (prisma as any).supplier.update({
            where: { id: Number(id) },
            data: { 
                name, 
                contactPerson, 
                contactNumber, 
                email, 
                address,
                isActive
            }
        });

        res.json(supplier);
    } catch (error) {
        console.error('Update supplier error:', error);
        res.status(500).json({ error: 'Failed to update supplier.' });
    }
});

// Delete supplier
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        await (prisma as any).supplier.delete({
            where: { id: Number(id) }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete supplier error:', error);
        res.status(500).json({ error: 'Failed to delete supplier.' });
    }
});

export default router;

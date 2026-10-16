import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();

// GET all customers
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const customers = await prisma.customer.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(customers);
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customers.' });
    }
});

// GET single customer
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const customer = await prisma.customer.findUnique({
            where: { id: Number(req.params.id) },
            include: { transactions: true, ledgerEntries: { orderBy: { createdAt: 'desc' } } } as any
        });
        if (!customer) {
            res.status(404).json({ error: 'Customer not found.' });
            return;
        }
        res.json(customer);
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Failed to fetch customer.' });
    }
});

// POST create customer
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, email, phone } = req.body;
        
        // Basic check if email exists
        if (email) {
            const existing = await (prisma as any).customer.findUnique({ where: { email } });
            if (existing) {
                res.status(400).json({ error: 'Customer with this email already exists.' });
                return;
            }
        }

        const customer = await prisma.customer.create({
            data: {
                name,
                email: email || null,
                phone: phone || null,
            },
        });
        res.status(201).json(customer);
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({ error: 'Failed to create customer.' });
    }
});

// PUT update customer
router.put('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const { name, email, phone, loyaltyPoints, storeCredit } = req.body;

        const data: any = {};
        if (name !== undefined) data.name = name;
        if (email !== undefined) data.email = email || null;
        if (phone !== undefined) data.phone = phone || null;
        if (loyaltyPoints !== undefined) data.loyaltyPoints = Number(loyaltyPoints);
        if (storeCredit !== undefined) data.storeCredit = Number(storeCredit);

        const customer = await prisma.customer.update({
            where: { id },
            data,
        });
        res.json(customer);
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Failed to update customer.' });
    }
});

// DELETE customer
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        await prisma.customer.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: 'Customer deleted successfully.' });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Failed to delete customer.' });
    }
});

export default router;

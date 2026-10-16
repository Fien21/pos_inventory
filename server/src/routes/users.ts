import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// All user routes require ADMIN role
router.use(authenticate, authorize('ADMIN'));

// GET all users
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true, rfidUid: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// POST create user
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, email, password, role, rfidUid, posPin } = req.body;

        if (!name || !email || !password) {
            res.status(400).json({ error: 'Name, email, and password are required.' });
            return;
        }

        const validRoles = ['ADMIN', 'STAFF', 'CASHIER'];
        if (role && !validRoles.includes(role)) {
            res.status(400).json({ error: 'Invalid role. Must be ADMIN, STAFF, or CASHIER.' });
            return;
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: 'Email already exists.' });
            return;
        }
        
        let finalRfidUid = null;
        if (rfidUid) {
            finalRfidUid = String(rfidUid).trim();
            const existingUid = await prisma.user.findUnique({ where: { rfidUid: finalRfidUid } });
            if (existingUid) {
                res.status(400).json({ error: 'RFID UID is already assigned to another user.' });
                return;
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        let hashedPosPin = null;
        if (posPin) {
            hashedPosPin = await bcrypt.hash(String(posPin), 10);
        }

        const user = await prisma.user.create({
            data: { name, email, password: hashedPassword, role: role || 'CASHIER', rfidUid: finalRfidUid, posPin: hashedPosPin },
            select: { id: true, name: true, email: true, role: true, createdAt: true, rfidUid: true },
        });

        res.status(201).json(user);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user.' });
    }
});

// PUT update user
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const { name, email, password, role, rfidUid, posPin } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { id } });
        if (existingUser?.email === 'IT2026') {
            res.status(403).json({ error: 'System IT account cannot be modified.' });
            return;
        }

        const data: any = {};
        if (name) data.name = name;
        if (email) data.email = email;
        if (role) data.role = role;
        if (password) data.password = await bcrypt.hash(password, 10);
        if (posPin) data.posPin = await bcrypt.hash(String(posPin), 10);
        if (rfidUid !== undefined) {
            const trimmedUid = rfidUid ? String(rfidUid).trim() : null;
            if (trimmedUid) {
                const existingUid = await prisma.user.findUnique({ where: { rfidUid: trimmedUid } });
                if (existingUid && existingUid.id !== id) {
                    res.status(400).json({ error: 'RFID UID is already assigned to another user.' });
                    return;
                }
            }
            data.rfidUid = trimmedUid;
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            select: { id: true, name: true, email: true, role: true, createdAt: true, rfidUid: true },
        });

        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user.' });
    }
});

// DELETE user
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);

        const existingUser = await prisma.user.findUnique({ where: { id } });
        if (existingUser?.email === 'IT2026') {
            res.status(403).json({ error: 'System IT account cannot be deleted.' });
            return;
        }

        // Prevent deleting yourself
        if (req.user!.id === id) {
            res.status(400).json({ error: 'You cannot delete your own account.' });
            return;
        }

        await prisma.user.delete({ where: { id } });
        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

export default router;

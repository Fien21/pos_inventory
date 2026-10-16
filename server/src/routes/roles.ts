import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
        res.json(roles);
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ error: 'Failed to fetch roles.' });
    }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, permissions } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Role name is required.' });
            return;
        }

        const existing = await prisma.role.findUnique({ where: { name: name.toUpperCase() } });
        if (existing) {
            res.status(400).json({ error: 'Role already exists.' });
            return;
        }

        const role = await prisma.role.create({
            data: {
                name: name.toUpperCase(),
                permissions: JSON.stringify(permissions || []),
            },
        });

        res.status(201).json(role);
    } catch (error) {
        console.error('Create role error:', error);
        res.status(500).json({ error: 'Failed to create role.' });
    }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const { name, permissions } = req.body;

        const role = await prisma.role.findUnique({ where: { id } });
        if (!role) {
            res.status(404).json({ error: 'Role not found.' });
            return;
        }

        const data: any = {};
        if (name) data.name = name.toUpperCase();
        if (permissions) data.permissions = JSON.stringify(permissions);

        const updated = await prisma.role.update({
            where: { id },
            data,
        });

        // Also update users if the name changed!
        if (name && name.toUpperCase() !== role.name) {
            await prisma.user.updateMany({
                where: { role: role.name },
                data: { role: name.toUpperCase() }
            });
        }

        res.json(updated);
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update role.' });
    }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        const role = await prisma.role.findUnique({ where: { id } });
        
        if (!role) {
            res.status(404).json({ error: 'Role not found.' });
            return;
        }

        if (['ADMIN', 'STAFF', 'CASHIER'].includes(role.name)) {
            res.status(400).json({ error: 'Cannot delete core system roles.' });
            return;
        }

        const usersCount = await prisma.user.count({ where: { role: role.name } });
        if (usersCount > 0) {
            res.status(400).json({ error: `Cannot delete role. ${usersCount} users are currently assigned this role.` });
            return;
        }

        await prisma.role.delete({ where: { id } });
        res.json({ message: 'Role deleted successfully.' });
    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({ error: 'Failed to delete role.' });
    }
});

export default router;

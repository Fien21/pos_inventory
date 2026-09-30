"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All user routes require ADMIN role
router.use(auth_1.authenticate, (0, auth_1.authorize)('ADMIN'));
// GET all users
router.get('/', async (_req, res) => {
    try {
        const users = await prisma_1.default.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});
// POST create user
router.post('/', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            res.status(400).json({ error: 'Name, email, and password are required.' });
            return;
        }
        const validRoles = ['ADMIN', 'STAFF', 'CASHIER'];
        if (role && !validRoles.includes(role)) {
            res.status(400).json({ error: 'Invalid role. Must be ADMIN, STAFF, or CASHIER.' });
            return;
        }
        const existing = await prisma_1.default.user.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: 'Email already exists.' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.default.user.create({
            data: { name, email, password: hashedPassword, role: role || 'CASHIER' },
            select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
        res.status(201).json(user);
    }
    catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user.' });
    }
});
// PUT update user
router.put('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, email, password, role } = req.body;
        const data = {};
        if (name)
            data.name = name;
        if (email)
            data.email = email;
        if (role)
            data.role = role;
        if (password)
            data.password = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.default.user.update({
            where: { id },
            data,
            select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
        res.json(user);
    }
    catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user.' });
    }
});
// DELETE user
router.delete('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        // Prevent deleting yourself
        if (req.user.id === id) {
            res.status(400).json({ error: 'You cannot delete your own account.' });
            return;
        }
        await prisma_1.default.user.delete({ where: { id } });
        res.json({ message: 'User deleted successfully.' });
    }
    catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map
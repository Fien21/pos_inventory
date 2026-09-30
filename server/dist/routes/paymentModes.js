"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET all payment modes
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const activeOnly = req.query.active === 'true' || req.user.role === 'CASHIER';
        const where = activeOnly ? { isActive: true } : {};
        const modes = await prisma_1.default.paymentMode.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        res.json(modes);
    }
    catch (error) {
        console.error('Get payment modes error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch payment modes.' });
    }
});
// POST create payment mode (ADMIN or STAFF only)
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'STAFF'), async (req, res) => {
    try {
        const { name, description, isActive } = req.body;
        if (!name || !name.trim()) {
            res.status(400).json({ error: 'Name is required.' });
            return;
        }
        // Check uniqueness
        const existing = await prisma_1.default.paymentMode.findUnique({
            where: { name: name.trim() },
        });
        if (existing) {
            res.status(400).json({ error: 'A payment mode with this name already exists.' });
            return;
        }
        const mode = await prisma_1.default.paymentMode.create({
            data: {
                name: name.trim(),
                description: description || '',
                isActive: isActive !== undefined ? Boolean(isActive) : true,
            },
        });
        res.status(201).json(mode);
    }
    catch (error) {
        console.error('Create payment mode error:', error);
        res.status(500).json({ error: error.message || 'Failed to create payment mode.' });
    }
});
// PUT update payment mode (ADMIN or STAFF only)
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'STAFF'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, description, isActive } = req.body;
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID.' });
            return;
        }
        const existingMode = await prisma_1.default.paymentMode.findUnique({ where: { id } });
        if (!existingMode) {
            res.status(404).json({ error: 'Payment mode not found.' });
            return;
        }
        const data = {};
        if (name !== undefined) {
            if (!name || !name.trim()) {
                res.status(400).json({ error: 'Name cannot be empty.' });
                return;
            }
            // Check uniqueness if name changed
            if (name.trim().toLowerCase() !== existingMode.name.toLowerCase()) {
                const dup = await prisma_1.default.paymentMode.findUnique({ where: { name: name.trim() } });
                if (dup) {
                    res.status(400).json({ error: 'A payment mode with this name already exists.' });
                    return;
                }
            }
            data.name = name.trim();
        }
        if (description !== undefined) {
            data.description = description || '';
        }
        if (isActive !== undefined) {
            data.isActive = Boolean(isActive);
        }
        const mode = await prisma_1.default.paymentMode.update({
            where: { id },
            data,
        });
        res.json(mode);
    }
    catch (error) {
        console.error('Update payment mode error:', error);
        res.status(500).json({ error: error.message || 'Failed to update payment mode.' });
    }
});
// DELETE payment mode (ADMIN or STAFF only)
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'STAFF'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID.' });
            return;
        }
        const existingMode = await prisma_1.default.paymentMode.findUnique({ where: { id } });
        if (!existingMode) {
            res.status(404).json({ error: 'Payment mode not found.' });
            return;
        }
        await prisma_1.default.paymentMode.delete({ where: { id } });
        res.json({ success: true, message: 'Payment mode deleted successfully.' });
    }
    catch (error) {
        console.error('Delete payment mode error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete payment mode.' });
    }
});
exports.default = router;
//# sourceMappingURL=paymentModes.js.map
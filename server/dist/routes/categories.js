"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET all categories
router.get('/', auth_1.authenticate, async (_req, res) => {
    try {
        const categories = await prisma_1.default.category.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' },
        });
        res.json(categories);
    }
    catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});
// POST create category
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'STAFF'), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Category name is required.' });
            return;
        }
        const category = await prisma_1.default.category.create({ data: { name } });
        res.status(201).json(category);
    }
    catch (error) {
        if (error.code === 'P2002') {
            res.status(400).json({ error: 'Category already exists.' });
            return;
        }
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category.' });
    }
});
// PUT update category
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'STAFF'), async (req, res) => {
    try {
        const { name } = req.body;
        const category = await prisma_1.default.category.update({
            where: { id: Number(req.params.id) },
            data: { name },
        });
        res.json(category);
    }
    catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Failed to update category.' });
    }
});
// DELETE category
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'STAFF'), async (req, res) => {
    try {
        await prisma_1.default.category.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: 'Category deleted successfully.' });
    }
    catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category.' });
    }
});
exports.default = router;
//# sourceMappingURL=categories.js.map
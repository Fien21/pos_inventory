"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const barcode_1 = require("../lib/barcode");
const router = (0, express_1.Router)();
// GET all products
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const products = await prisma_1.default.product.findMany({
            include: { category: true, stockItems: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(products);
    }
    catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products.' });
    }
});
// GET search products
router.get('/search', auth_1.authenticate, async (req, res) => {
    try {
        const { q, categoryId, barcode } = req.query;
        const where = {};
        if (q) {
            where.OR = [
                { name: { contains: String(q) } },
                { description: { contains: String(q) } },
                { barcode: { contains: String(q) } },
            ];
        }
        if (categoryId) {
            where.categoryId = Number(categoryId);
        }
        if (barcode) {
            where.barcode = String(barcode);
        }
        const products = await prisma_1.default.product.findMany({
            where,
            include: { category: true, stockItems: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(products);
    }
    catch (error) {
        console.error('Search products error:', error);
        res.status(500).json({ error: 'Failed to search products.' });
    }
});
// GET single product
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const product = await prisma_1.default.product.findUnique({
            where: { id: Number(req.params.id) },
            include: { category: true, stockItems: true },
        });
        if (!product) {
            res.status(404).json({ error: 'Product not found.' });
            return;
        }
        res.json(product);
    }
    catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product.' });
    }
});
// POST create product
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'STAFF'), upload_1.upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, retailPrice, costPrice, taxRate, taxInclusive, stockQty, categoryId, barcode, serialNumbers } = req.body;
        const finalBarcode = barcode || (0, barcode_1.generateBarcodeString)();
        // Check barcode uniqueness
        const existing = await prisma_1.default.product.findUnique({ where: { barcode: finalBarcode } });
        if (existing) {
            res.status(400).json({ error: 'Barcode already exists.' });
            return;
        }
        // Generate barcode image
        const barcodeImageUrl = await (0, barcode_1.generateBarcodeImage)(finalBarcode);
        const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;
        // Parse serial numbers
        let parsedSns = [];
        if (serialNumbers) {
            parsedSns = typeof serialNumbers === 'string'
                ? serialNumbers.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
                : serialNumbers;
        }
        const hasSns = parsedSns.length > 0;
        const targetQty = hasSns ? parsedSns.length : (parseInt(stockQty) || 0);
        // Auto-generate missing S/Ns only if no manual S/Ns were entered
        const finalSns = [...parsedSns];
        if (!hasSns && targetQty > 0) {
            const prefix = (name || 'PROD').substring(0, 3).toUpperCase();
            for (let i = 0; i < targetQty; i++) {
                const randomSn = `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
                finalSns.push(randomSn);
            }
        }
        const product = await prisma_1.default.product.create({
            data: {
                name,
                description: description || '',
                price: parseFloat(price) || 0,
                retailPrice: parseFloat(retailPrice) || 0,
                costPrice: parseFloat(costPrice) || 0,
                taxRate: parseFloat(taxRate) || 0,
                taxInclusive: taxInclusive === 'true' || taxInclusive === true,
                barcode: finalBarcode,
                imageUrl,
                stockQty: targetQty,
                categoryId: parseInt(categoryId),
                stockItems: {
                    create: finalSns.map(sn => ({
                        serialNumber: sn,
                        status: 'AVAILABLE'
                    }))
                }
            },
            include: { category: true, stockItems: true },
        });
        res.status(201).json({ ...product, barcodeImageUrl });
    }
    catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product.' });
    }
});
// PUT update product
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'STAFF'), upload_1.upload.single('image'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, description, price, retailPrice, costPrice, taxRate, taxInclusive, stockQty, categoryId, serialNumbers } = req.body;
        const data = {};
        if (name !== undefined)
            data.name = name;
        if (description !== undefined)
            data.description = description;
        if (price !== undefined)
            data.price = parseFloat(price);
        if (retailPrice !== undefined)
            data.retailPrice = parseFloat(retailPrice);
        if (costPrice !== undefined)
            data.costPrice = parseFloat(costPrice);
        if (taxRate !== undefined)
            data.taxRate = parseFloat(taxRate);
        if (taxInclusive !== undefined)
            data.taxInclusive = taxInclusive === 'true' || taxInclusive === true;
        if (categoryId !== undefined)
            data.categoryId = parseInt(categoryId);
        if (req.file) {
            data.imageUrl = `/uploads/products/${req.file.filename}`;
        }
        else if (req.body.removeImage === 'true') {
            data.imageUrl = null;
        }
        // Update standard product fields
        let product = await prisma_1.default.product.update({
            where: { id },
            data,
            include: { category: true, stockItems: true },
        });
        const prodName = name || product.name;
        const prefix = prodName.substring(0, 3).toUpperCase();
        // Handle Serial Numbers sync
        if (serialNumbers !== undefined) {
            const parsedSns = typeof serialNumbers === 'string'
                ? serialNumbers.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
                : (Array.isArray(serialNumbers) ? serialNumbers.map((s) => String(s).trim()) : []);
            const hasSns = parsedSns.length > 0;
            const existingStock = await prisma_1.default.stockItem.findMany({ where: { productId: id } });
            const existingSns = existingStock.map((s) => s.serialNumber);
            // Delete AVAILABLE stock items that are no longer in the list
            const snsToDelete = existingStock.filter((s) => !parsedSns.includes(s.serialNumber) && s.status === 'AVAILABLE');
            if (snsToDelete.length > 0) {
                await prisma_1.default.stockItem.deleteMany({
                    where: { id: { in: snsToDelete.map((s) => s.id) } }
                });
            }
            // Add new serial numbers
            const snsToAdd = parsedSns.filter(sn => !existingSns.includes(sn));
            for (const sn of snsToAdd) {
                const globalExisting = await prisma_1.default.stockItem.findUnique({ where: { serialNumber: sn } });
                if (!globalExisting) {
                    await prisma_1.default.stockItem.create({
                        data: {
                            productId: id,
                            serialNumber: sn,
                            status: 'AVAILABLE'
                        }
                    });
                }
            }
            // If stockQty (target) is larger than current AVAILABLE, generate the difference (only if no manual S/Ns are present)
            let updatedStock = await prisma_1.default.stockItem.findMany({ where: { productId: id } });
            let currentAvailableCount = updatedStock.filter((s) => s.status === 'AVAILABLE').length;
            const targetQty = parseInt(stockQty);
            if (!hasSns && !isNaN(targetQty) && targetQty > currentAvailableCount) {
                const diff = targetQty - currentAvailableCount;
                for (let i = 0; i < diff; i++) {
                    const randomSn = `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
                    await prisma_1.default.stockItem.create({
                        data: {
                            productId: id,
                            serialNumber: randomSn,
                            status: 'AVAILABLE'
                        }
                    });
                }
            }
            // Sync the actual available quantity in the DB to the product stockQty
            updatedStock = await prisma_1.default.stockItem.findMany({ where: { productId: id } });
            const totalStock = updatedStock.filter((s) => s.status === 'AVAILABLE').length;
            product = await prisma_1.default.product.update({
                where: { id },
                data: { stockQty: totalStock },
                include: { category: true, stockItems: true }
            });
        }
        else if (stockQty !== undefined) {
            // If serialNumbers is not provided, adjust the auto-generated ones according to stockQty
            const targetQty = parseInt(stockQty) || 0;
            const existingStock = await prisma_1.default.stockItem.findMany({ where: { productId: id } });
            const currentAvailable = existingStock.filter((s) => s.status === 'AVAILABLE');
            if (targetQty > currentAvailable.length) {
                const diff = targetQty - currentAvailable.length;
                for (let i = 0; i < diff; i++) {
                    const randomSn = `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
                    await prisma_1.default.stockItem.create({
                        data: {
                            productId: id,
                            serialNumber: randomSn,
                            status: 'AVAILABLE'
                        }
                    });
                }
            }
            else if (targetQty < currentAvailable.length) {
                const diff = currentAvailable.length - targetQty;
                const toDelete = currentAvailable.slice(0, diff);
                await prisma_1.default.stockItem.deleteMany({
                    where: { id: { in: toDelete.map((s) => s.id) } }
                });
            }
            const updatedStock = await prisma_1.default.stockItem.findMany({ where: { productId: id } });
            const totalStock = updatedStock.filter((s) => s.status === 'AVAILABLE').length;
            product = await prisma_1.default.product.update({
                where: { id },
                data: { stockQty: totalStock },
                include: { category: true, stockItems: true }
            });
        }
        res.json(product);
    }
    catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product.' });
    }
});
// DELETE product
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res) => {
    try {
        await prisma_1.default.product.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: 'Product deleted successfully.' });
    }
    catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product.' });
    }
});
// GET barcode image for a product
router.get('/:id/barcode', auth_1.authenticate, async (req, res) => {
    try {
        const product = await prisma_1.default.product.findUnique({ where: { id: Number(req.params.id) } });
        if (!product) {
            res.status(404).json({ error: 'Product not found.' });
            return;
        }
        const barcodeImageUrl = await (0, barcode_1.generateBarcodeImage)(product.barcode);
        res.json({ barcode: product.barcode, barcodeImageUrl });
    }
    catch (error) {
        console.error('Barcode error:', error);
        res.status(500).json({ error: 'Failed to generate barcode.' });
    }
});
exports.default = router;
//# sourceMappingURL=products.js.map
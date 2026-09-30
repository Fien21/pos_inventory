import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { generateBarcodeString, generateBarcodeImage } from '../lib/barcode';

const router = Router();

// GET all products
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const products = await prisma.product.findMany({
            include: { category: true, stockItems: true } as any,
            orderBy: { createdAt: 'desc' },
        });
        res.json(products);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products.' });
    }
});

// GET search products
router.get('/search', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { q, categoryId, barcode } = req.query;

        const where: any = {};
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

        const products = await prisma.product.findMany({
            where,
            include: { category: true, stockItems: true } as any,
            orderBy: { createdAt: 'desc' },
        });
        res.json(products);
    } catch (error) {
        console.error('Search products error:', error);
        res.status(500).json({ error: 'Failed to search products.' });
    }
});

// GET lookup product from Open Food Facts
router.get('/lookup/:barcode', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { barcode } = req.params;
        const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,brands,categories,image_front_url`, {
            headers: {
                'User-Agent': 'ShadowApolloPOS - InventoryLookup - Version 1.0 (contact@yourdomain.com)'
            },
            signal: AbortSignal.timeout(3000)
        });
        if (!response.ok) {
            res.status(response.status).json({ error: 'Failed to lookup product.' });
            return;
        }
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        if (error.name === 'TimeoutError' || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
            console.error('Lookup product error: Connection to Open Food Facts timed out.');
        } else {
            console.error('Lookup product error:', error.message);
        }
        res.status(500).json({ error: 'Failed to lookup product (API Timeout).' });
    }
});

// GET search products from Open Food Facts by name
router.get('/search-off', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { q } = req.query;
        if (!q) {
            res.json({ products: [] });
            return;
        }
        
        const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(String(q))}&search_simple=1&action=process&json=1&page_size=10&fields=code,product_name,brands,categories,image_front_url`;
        
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'ShadowApolloPOS - InventoryLookup - Version 1.0 (contact@yourdomain.com)'
            },
            signal: AbortSignal.timeout(3000)
        });
        
        if (!response.ok) {
            res.status(response.status).json({ error: 'Failed to search products.' });
            return;
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        if (error.name === 'TimeoutError' || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
            console.error('Search OFF error: Connection to Open Food Facts timed out.');
        } else {
            console.error('Search OFF error:', error.message);
        }
        // Return an empty array instead of a 500 error so the frontend doesn't throw a console error while typing
        res.json({ products: [] });
    }
});

// GET single product
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: Number(req.params.id) },
            include: { category: true, stockItems: true } as any,
        });
        if (!product) {
            res.status(404).json({ error: 'Product not found.' });
            return;
        }
        res.json(product);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product.' });
    }
});

// POST create product
router.post(
    '/',
    authenticate,
    authorize('ADMIN', 'STAFF'),
    upload.single('image'),
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { name, description, price, retailPrice, costPrice, taxRate, taxInclusive, stockQty, categoryId, barcode, serialNumbers, autoGenerateSn } = req.body;

            const finalBarcode = barcode || generateBarcodeString();

            // Check barcode uniqueness
            const existing = await prisma.product.findUnique({ where: { barcode: finalBarcode } });
            if (existing) {
                res.status(400).json({ error: 'Barcode already exists.' });
                return;
            }

            // Generate barcode image
            const barcodeImageUrl = await generateBarcodeImage(finalBarcode);

            const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

            // Parse serial numbers
            let parsedSns: string[] = [];
            if (serialNumbers) {
                parsedSns = typeof serialNumbers === 'string'
                    ? serialNumbers.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean)
                    : serialNumbers;
            }

            const hasSns = parsedSns.length > 0;
            const targetQty = hasSns ? parsedSns.length : (parseInt(stockQty) || 0);

            // Auto-generate missing S/Ns only if no manual S/Ns were entered and autoGenerateSn is true
            const finalSns = [...parsedSns];
            if (!hasSns && targetQty > 0 && (autoGenerateSn === 'true' || autoGenerateSn === true)) {
                const prefix = (name || 'PROD').substring(0, 3).toUpperCase();
                for (let i = 0; i < targetQty; i++) {
                    const randomSn = `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
                    finalSns.push(randomSn);
                }
            }

            const product = await prisma.product.create({
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
                } as any,
                include: { category: true, stockItems: true } as any,
            });

            res.status(201).json({ ...product, barcodeImageUrl });
        } catch (error) {
            console.error('Create product error:', error);
            res.status(500).json({ error: 'Failed to create product.' });
        }
    }
);

// PUT update product
router.put(
    '/:id',
    authenticate,
    authorize('ADMIN', 'STAFF'),
    upload.single('image'),
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const id = Number(req.params.id);
            const { name, description, price, retailPrice, costPrice, taxRate, taxInclusive, stockQty, categoryId, serialNumbers, autoGenerateSn } = req.body;

            const data: any = {};
            if (name !== undefined) data.name = name;
            if (description !== undefined) data.description = description;
            if (price !== undefined) data.price = parseFloat(price);
            if (retailPrice !== undefined) data.retailPrice = parseFloat(retailPrice);
            if (costPrice !== undefined) data.costPrice = parseFloat(costPrice);
            if (taxRate !== undefined) data.taxRate = parseFloat(taxRate);
            if (taxInclusive !== undefined) data.taxInclusive = taxInclusive === 'true' || taxInclusive === true;
            if (categoryId !== undefined) data.categoryId = parseInt(categoryId);
            if (req.file) {
                data.imageUrl = `/uploads/products/${req.file.filename}`;
            } else if (req.body.removeImage === 'true') {
                data.imageUrl = null;
            }

            // Update standard product fields
            let product = await prisma.product.update({
                where: { id },
                data,
                include: { category: true, stockItems: true } as any,
            });

            const prodName = name || product.name;
            const prefix = prodName.substring(0, 3).toUpperCase();

            // Handle Serial Numbers sync
            if (serialNumbers !== undefined) {
                const parsedSns: string[] = typeof serialNumbers === 'string'
                    ? serialNumbers.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean)
                    : (Array.isArray(serialNumbers) ? serialNumbers.map((s: any) => String(s).trim()) : []);

                const hasSns = parsedSns.length > 0;

                const existingStock = await (prisma as any).stockItem.findMany({ where: { productId: id } });
                const existingSns = existingStock.map((s: any) => s.serialNumber);

                // Delete AVAILABLE stock items that are no longer in the list
                const snsToDelete = existingStock.filter((s: any) => !parsedSns.includes(s.serialNumber) && s.status === 'AVAILABLE');
                if (snsToDelete.length > 0) {
                    await (prisma as any).stockItem.deleteMany({
                        where: { id: { in: snsToDelete.map((s: any) => s.id) } }
                    });
                }

                // Add new serial numbers
                const snsToAdd = parsedSns.filter(sn => !existingSns.includes(sn));
                for (const sn of snsToAdd) {
                    const globalExisting = await (prisma as any).stockItem.findUnique({ where: { serialNumber: sn } });
                    if (!globalExisting) {
                        await (prisma as any).stockItem.create({
                            data: {
                                productId: id,
                                serialNumber: sn,
                                status: 'AVAILABLE'
                            }
                        });
                    }
                }

                // If stockQty (target) is larger than current AVAILABLE, generate the difference (only if no manual S/Ns are present)
                let updatedStock = await (prisma as any).stockItem.findMany({ where: { productId: id } });
                let currentAvailableCount = updatedStock.filter((s: any) => s.status === 'AVAILABLE').length;
                const targetQty = parseInt(stockQty);

                if (!hasSns && !isNaN(targetQty) && targetQty > currentAvailableCount && (autoGenerateSn === 'true' || autoGenerateSn === true)) {
                    const diff = targetQty - currentAvailableCount;
                    for (let i = 0; i < diff; i++) {
                        const randomSn = `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
                        await (prisma as any).stockItem.create({
                            data: {
                                productId: id,
                                serialNumber: randomSn,
                                status: 'AVAILABLE'
                            }
                        });
                    }
                }

                // Sync the actual available quantity in the DB to the product stockQty
                updatedStock = await (prisma as any).stockItem.findMany({ where: { productId: id } });
                const totalStock = updatedStock.filter((s: any) => s.status === 'AVAILABLE').length;
                const finalStockQty = (autoGenerateSn === 'true' || autoGenerateSn === true) ? totalStock : targetQty;
                product = await prisma.product.update({
                    where: { id },
                    data: { stockQty: finalStockQty },
                    include: { category: true, stockItems: true } as any
                });
            } else if (stockQty !== undefined) {
                // If serialNumbers is not provided, adjust the auto-generated ones according to stockQty
                const targetQty = parseInt(stockQty) || 0;
                const existingStock = await (prisma as any).stockItem.findMany({ where: { productId: id } });
                const currentAvailable = existingStock.filter((s: any) => s.status === 'AVAILABLE');

                if (targetQty > currentAvailable.length && (autoGenerateSn === 'true' || autoGenerateSn === true)) {
                    const diff = targetQty - currentAvailable.length;
                    for (let i = 0; i < diff; i++) {
                        const randomSn = `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
                        await (prisma as any).stockItem.create({
                            data: {
                                productId: id,
                                serialNumber: randomSn,
                                status: 'AVAILABLE'
                            }
                        });
                    }
                } else if (targetQty < currentAvailable.length) {
                    const diff = currentAvailable.length - targetQty;
                    const toDelete = currentAvailable.slice(0, diff);
                    await (prisma as any).stockItem.deleteMany({
                        where: { id: { in: toDelete.map((s: any) => s.id) } }
                    });
                }

                const updatedStock = await (prisma as any).stockItem.findMany({ where: { productId: id } });
                const totalStock = updatedStock.filter((s: any) => s.status === 'AVAILABLE').length;
                const finalStockQty = (autoGenerateSn === 'true' || autoGenerateSn === true) ? totalStock : targetQty;
                product = await prisma.product.update({
                    where: { id },
                    data: { stockQty: finalStockQty },
                    include: { category: true, stockItems: true } as any
                });
            }

            res.json(product);
        } catch (error) {
            console.error('Update product error:', error);
            res.status(500).json({ error: 'Failed to update product.' });
        }
    }
);

// DELETE product
router.delete(
    '/:id',
    authenticate,
    authorize('ADMIN'),
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            await prisma.product.delete({ where: { id: Number(req.params.id) } });
            res.json({ message: 'Product deleted successfully.' });
        } catch (error) {
            console.error('Delete product error:', error);
            res.status(500).json({ error: 'Failed to delete product.' });
        }
    }
);

// GET barcode image for a product
router.get('/:id/barcode', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
        if (!product) {
            res.status(404).json({ error: 'Product not found.' });
            return;
        }
        const barcodeImageUrl = await generateBarcodeImage(product.barcode);
        res.json({ barcode: product.barcode, barcodeImageUrl });
    } catch (error) {
        console.error('Barcode error:', error);
        res.status(500).json({ error: 'Failed to generate barcode.' });
    }
});

export default router;

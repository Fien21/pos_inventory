"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const xlsx = __importStar(require("xlsx"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Configure memory storage for Multer file uploads
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});
// GET export Excel inventory (Protected - ADMIN & STAFF)
router.get('/export', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'STAFF'), async (_req, res) => {
    try {
        const categories = await prisma_1.default.category.findMany({ orderBy: { name: 'asc' } });
        const products = (await prisma_1.default.product.findMany({
            include: { category: true, stockItems: true },
            orderBy: { name: 'asc' },
        }));
        // 1. Map Categories to rows
        const categoryRows = categories.map((c) => ({
            'Category Name': c.name,
        }));
        // 2. Map Products to rows
        const productRows = products.map((p) => ({
            'Barcode': p.barcode,
            'Product Name': p.name,
            'Description': p.description || '',
            'Price': p.price,
            'Cost Price': p.costPrice,
            'Retail Price': p.retailPrice,
            'Tax Rate': p.taxRate,
            'Tax Inclusive': p.taxInclusive ? 'Yes' : 'No',
            'Stock Quantity': p.stockQty,
            'Category Name': p.category.name,
            'Serial Numbers': (p.stockItems || [])
                .filter((s) => s.status === 'AVAILABLE')
                .map((s) => s.serialNumber)
                .join(', '),
        }));
        // 3. Create a new Workbook
        const wb = xlsx.utils.book_new();
        // 4. Create Worksheets
        const wsCategories = xlsx.utils.json_to_sheet(categoryRows);
        const wsProducts = xlsx.utils.json_to_sheet(productRows);
        // 5. Append Worksheets to Workbook
        xlsx.utils.book_append_sheet(wb, wsCategories, 'Categories');
        xlsx.utils.book_append_sheet(wb, wsProducts, 'Products');
        // 6. Write Workbook to binary buffer
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        // 7. Send workbook buffer as file attachment response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory.xlsx');
        res.send(buffer);
    }
    catch (error) {
        console.error('Failed to export inventory:', error);
        res.status(500).json({ error: 'Failed to export inventory' });
    }
});
// POST import Excel inventory (Protected - ADMIN & STAFF)
router.post('/import', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'STAFF'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Please upload an Excel file.' });
            return;
        }
        // Parse workbook from buffer
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        let categoriesUpserted = 0;
        let productsCreated = 0;
        let productsUpdated = 0;
        // 1. Process Categories sheet first
        if (workbook.SheetNames.includes('Categories')) {
            const wsCategories = workbook.Sheets['Categories'];
            const categoryData = xlsx.utils.sheet_to_json(wsCategories);
            for (const row of categoryData) {
                const categoryName = row['Category Name']?.toString()?.trim();
                if (categoryName) {
                    await prisma_1.default.category.upsert({
                        where: { name: categoryName },
                        update: {},
                        create: { name: categoryName },
                    });
                    categoriesUpserted++;
                }
            }
        }
        // 2. Process Products sheet
        if (workbook.SheetNames.includes('Products')) {
            const wsProducts = workbook.Sheets['Products'];
            const productData = xlsx.utils.sheet_to_json(wsProducts);
            for (const row of productData) {
                const barcode = row['Barcode']?.toString()?.trim();
                const productName = row['Product Name']?.toString()?.trim();
                const description = row['Description']?.toString()?.trim() || '';
                const basePriceVal = parseFloat(row['Price']) || 0;
                const costPriceVal = parseFloat(row['Cost Price']) || 0;
                const retailPriceVal = parseFloat(row['Retail Price']) || basePriceVal;
                const taxRateVal = parseFloat(row['Tax Rate']) || 0;
                const taxInclusiveVal = row['Tax Inclusive']?.toString()?.trim()?.toLowerCase() === 'yes';
                const stockQtyVal = parseInt(row['Stock Quantity'], 10);
                const categoryName = row['Category Name']?.toString()?.trim();
                const serialNumbersStr = row['Serial Numbers']?.toString()?.trim() || '';
                // Row validation: Skip rows missing essential values
                if (!barcode || !productName || !categoryName) {
                    continue;
                }
                // Ensure category exists, create dynamically if not
                let category = await prisma_1.default.category.findUnique({
                    where: { name: categoryName },
                });
                if (!category) {
                    category = await prisma_1.default.category.create({
                        data: { name: categoryName },
                    });
                    categoriesUpserted++;
                }
                // Check if product with this barcode already exists
                let product = await prisma_1.default.product.findUnique({
                    where: { barcode },
                });
                const parsedSns = serialNumbersStr
                    ? serialNumbersStr.split(',').map((s) => s.trim()).filter(Boolean)
                    : [];
                const targetQty = Math.max(isNaN(stockQtyVal) ? 0 : stockQtyVal, parsedSns.length);
                const dataPayload = {
                    name: productName,
                    description,
                    price: basePriceVal || retailPriceVal,
                    costPrice: costPriceVal,
                    retailPrice: retailPriceVal,
                    taxRate: taxRateVal,
                    taxInclusive: taxInclusiveVal,
                    stockQty: targetQty,
                    categoryId: category.id,
                };
                if (product) {
                    // Update existing product properties
                    product = await prisma_1.default.product.update({
                        where: { barcode },
                        data: dataPayload,
                    });
                    productsUpdated++;
                }
                else {
                    // Create new product
                    product = await prisma_1.default.product.create({
                        data: {
                            ...dataPayload,
                            barcode,
                        },
                    });
                    productsCreated++;
                }
                // Sync Serial Numbers
                const prefix = productName.substring(0, 3).toUpperCase();
                const existingStock = await prisma_1.default.stockItem.findMany({ where: { productId: product.id } });
                const existingSns = existingStock.map((s) => s.serialNumber);
                // Delete AVAILABLE stock items that are no longer in the imported serial numbers list
                if (parsedSns.length > 0) {
                    const toDelete = existingStock.filter((s) => !parsedSns.includes(s.serialNumber) && s.status === 'AVAILABLE');
                    if (toDelete.length > 0) {
                        await prisma_1.default.stockItem.deleteMany({
                            where: { id: { in: toDelete.map((s) => s.id) } },
                        });
                    }
                    // Add new ones
                    for (const sn of parsedSns) {
                        if (!existingSns.includes(sn)) {
                            const globalExisting = await prisma_1.default.stockItem.findUnique({ where: { serialNumber: sn } });
                            if (!globalExisting) {
                                await prisma_1.default.stockItem.create({
                                    data: {
                                        productId: product.id,
                                        serialNumber: sn,
                                        status: 'AVAILABLE',
                                    },
                                });
                            }
                        }
                    }
                }
                // Auto-generate missing serial numbers to match targetQty
                let updatedStock = await prisma_1.default.stockItem.findMany({ where: { productId: product.id } });
                let currentAvailable = updatedStock.filter((s) => s.status === 'AVAILABLE').length;
                if (targetQty > currentAvailable) {
                    const diff = targetQty - currentAvailable;
                    for (let i = 0; i < diff; i++) {
                        const randomSn = `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
                        await prisma_1.default.stockItem.create({
                            data: {
                                productId: product.id,
                                serialNumber: randomSn,
                                status: 'AVAILABLE',
                            },
                        });
                    }
                }
                else if (parsedSns.length === 0 && targetQty < currentAvailable) {
                    // Prune extra AVAILABLE stock items if no explicit S/Ns were supplied but count is lowered
                    const diff = currentAvailable - targetQty;
                    const availableItems = updatedStock.filter((s) => s.status === 'AVAILABLE');
                    const toDelete = availableItems.slice(0, diff);
                    await prisma_1.default.stockItem.deleteMany({
                        where: { id: { in: toDelete.map((s) => s.id) } },
                    });
                }
                // Re-sync final stock quantity count
                updatedStock = await prisma_1.default.stockItem.findMany({ where: { productId: product.id } });
                const finalQty = updatedStock.filter((s) => s.status === 'AVAILABLE').length;
                await prisma_1.default.product.update({
                    where: { id: product.id },
                    data: { stockQty: finalQty },
                });
            }
        }
        res.json({
            success: true,
            summary: {
                categoriesUpserted,
                productsCreated,
                productsUpdated,
            },
        });
    }
    catch (error) {
        console.error('Failed to import Excel file:', error);
        res.status(500).json({ error: error.message || 'Failed to parse Excel file.' });
    }
});
exports.default = router;
//# sourceMappingURL=excel.js.map
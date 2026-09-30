"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./lib/prisma"));
async function test() {
    try {
        console.log('Testing settings connection...');
        const settings = await prisma_1.default.settings.findUnique({
            where: { id: 1 },
        });
        console.log('Settings read successfully:', settings);
        console.log('Testing categories connection...');
        const categories = await prisma_1.default.category.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' },
        });
        console.log('Categories read successfully, count:', categories.length);
        console.log('Testing products search/findMany connection...');
        const products = await prisma_1.default.product.findMany({
            include: { category: true, stockItems: true },
            orderBy: { createdAt: 'desc' },
        });
        console.log('Products read successfully:', JSON.stringify(products, null, 2));
    }
    catch (error) {
        console.error('Error connecting to database:', error);
    }
    finally {
        await prisma_1.default.$disconnect();
    }
}
test();
//# sourceMappingURL=test_prisma.js.map
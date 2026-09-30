import prisma from './lib/prisma';

async function test() {
  try {
    console.log('Testing settings connection...');
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
    });
    console.log('Settings read successfully:', settings);

    console.log('Testing categories connection...');
    const categories = await prisma.category.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
    });
    console.log('Categories read successfully, count:', categories.length);

    console.log('Testing products search/findMany connection...');
    const products = await prisma.product.findMany({
        include: { category: true, stockItems: true } as any,
        orderBy: { createdAt: 'desc' },
    });
    console.log('Products read successfully:', JSON.stringify(products, null, 2));

  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();


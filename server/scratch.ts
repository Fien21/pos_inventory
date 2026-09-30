import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.product.findUnique({ where: { id: 1 }, include: { category: true, stockItems: true } as any })
  .then((res) => console.log("Success:", !!res))
  .catch((err) => console.error("Error:", err));

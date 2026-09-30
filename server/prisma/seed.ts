import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
declare const process: any;

const prisma = new PrismaClient();

async function main() {
    // Seed admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
        where: { email: 'admin@shadow.com' },
        update: {},
        create: {
            name: 'System Admin',
            email: 'admin@shadow.com',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });

    // Seed default settings
    await prisma.settings.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            appName: 'Shadow Apollo',
            subtitle: 'Inventory & POS System',
            logoIcon: '⚡',
            maintenanceMode: false,
        },
    });

    // Seed categories
    const categories = ['Electronics', 'Groceries', 'Beverages', 'Snacks', 'Personal Care', 'Household'];
    for (const name of categories) {
        await prisma.category.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }

    // Seed default payment modes
    const paymentModes = [
        { name: 'Cash', description: 'Standard physical currency' },
        { name: 'Credit/Debit Card', description: 'Visa, Mastercard, etc.' },
        { name: 'Mobile Wallet', description: 'GCash, Maya, WeChat Pay, etc.' },
        { name: 'Bank Transfer', description: 'Direct bank transfer / wire' }
    ];
    for (const pm of paymentModes) {
        await (prisma as any).paymentMode.upsert({
            where: { name: pm.name },
            update: {},
            create: { name: pm.name, description: pm.description, isActive: true },
        });
    }

    console.log('✅ Database seeded successfully');
    console.log('   Admin: admin@shadow.com / admin123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

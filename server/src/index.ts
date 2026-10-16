import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Load .env relative to this directory so it's always found regardless of process cwd
dotenv.config({ path: path.join(__dirname, '../.env') });

// Prevent server crashes from unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import transactionRoutes from './routes/transactions';
import userRoutes from './routes/users';
import settingsRoutes from './routes/settings';
import excelRoutes from './routes/excel';
import paymentModeRoutes from './routes/paymentModes';
import auditLogRoutes from './routes/auditLogs';
import inventoryAuditRoutes from './routes/inventoryAudits';
import suppliersRoutes from './routes/suppliers';
import roleRoutes from './routes/roles';
import licenseRoutes from './routes/license';
import customerRoutes from './routes/customers';
import shiftRoutes from './routes/shifts';
import reportRoutes from './routes/reports';
import ticketRoutes from './routes/tickets';
import purchaseOrdersRoutes from './routes/purchaseOrders';
import promotionsRoutes from './routes/promotions';
import branchesRoutes from './routes/branches';

import bcrypt from 'bcryptjs';
import prisma from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize System IT Account
async function initSystemAccount() {
    try {
        // Initialize Default Branch
        let mainBranch = await prisma.branch.findUnique({ where: { name: 'Main Store' } });
        if (!mainBranch) {
            mainBranch = await prisma.branch.create({
                data: {
                    name: 'Main Store',
                    location: 'Headquarters'
                }
            });
            console.log('✅ Main Store branch created.');
        }

        const existing = await prisma.user.findUnique({ where: { email: 'IT2026' } });
        if (!existing) {
            const hashedPassword = await bcrypt.hash('IT2026', 10);
            await prisma.user.create({
                data: {
                    name: 'System IT',
                    email: 'IT2026',
                    password: hashedPassword,
                    role: 'ADMIN',
                    branchId: mainBranch.id
                }
            });
            console.log('✅ System IT account created (IT2026).');
        } else if (!existing.branchId) {
            await prisma.user.update({
                where: { email: 'IT2026' },
                data: { branchId: mainBranch.id }
            });
        }

        // Initialize Default Roles
        const coreRoles = [
            { name: 'ADMIN', permissions: ['*'] },
            { name: 'STAFF', permissions: ['POS'] },
            { name: 'CASHIER', permissions: ['POS', 'DASHBOARD', 'SALES_HISTORY'] }
        ];

        for (const r of coreRoles) {
            const existRole = await prisma.role.findUnique({ where: { name: r.name } });
            if (!existRole) {
                await prisma.role.create({
                    data: { name: r.name, permissions: JSON.stringify(r.permissions) }
                });
            }
        }
    } catch (e) {
        console.error('Failed to init system:', e);
    }
}
initSystemAccount();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/payment-modes', paymentModeRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/inventory-audits', inventoryAuditRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/promotions', promotionsRoutes);
app.use('/api/branches', branchesRoutes);

// Health check
app.get('/api/health', (_req, res) => {
    // Triggering nodemon restart to load new Prisma client
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
// Force nodemon restart to load updated Prisma client

// Trigger nodemon restart

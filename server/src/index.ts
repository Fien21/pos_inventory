import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Load .env relative to this directory so it's always found regardless of process cwd
dotenv.config({ path: path.join(__dirname, '../.env') });

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

const app = express();
const PORT = process.env.PORT || 3001;

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


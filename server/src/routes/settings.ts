import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Configure upload directory for branding images
const BRANDING_UPLOAD_DIR = path.join(__dirname, '../../uploads/branding');
if (!fs.existsSync(BRANDING_UPLOAD_DIR)) {
    fs.mkdirSync(BRANDING_UPLOAD_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, BRANDING_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    },
});

// File filter (only allow web images)
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// GET current settings (Public - so login page can access it)
router.get('/', async (_req, res: Response): Promise<void> => {
    try {
        let settings = await prisma.settings.findUnique({
            where: { id: 1 },
        });

        // Fallback in case seed didn't run or table is empty
        if (!settings) {
            settings = await prisma.settings.create({
                data: {
                    id: 1,
                    appName: 'Shadow Apollo',
                    subtitle: 'Inventory & POS System',
                    logoIcon: '⚡',
                    logoUrl: null,
                    posPin: null,
                    posPinLength: 4,
                    emailDomain: 'shadow.com',
                    maintenanceMode: false,
                    receiptFooter: 'Thank you for shopping with us!',
                    receiptPolicy: 'No return, no exchange after 7 days.',
                },
            });
        }

        // Return a safe settings object without exposing the raw PIN
        const safeSettings = {
            id: settings.id,
            appName: settings.appName,
            subtitle: settings.subtitle,
            logoIcon: settings.logoIcon,
            logoUrl: settings.logoUrl,
            posPinLength: settings.posPinLength,
            hasPosPin: !!settings.posPin,
            emailDomain: settings.emailDomain,
            maintenanceMode: settings.maintenanceMode,
            receiptFooter: settings.receiptFooter,
            receiptPolicy: settings.receiptPolicy,
        };

        res.json(safeSettings);
    } catch (error) {
        console.error('Failed to get settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// PUT update settings (Protected - ADMIN only)
router.put('/', authenticate, authorize('ADMIN'), upload.single('logo'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { appName, subtitle, logoIcon, removeLogo, posPin, posPinLength, emailDomain, maintenanceMode, receiptFooter, receiptPolicy } = req.body;

        if (!appName || !subtitle || !logoIcon) {
            res.status(400).json({ error: 'appName, subtitle, and logoIcon are required.' });
            return;
        }

        // Determine if logoUrl should be updated
        let logoUrlUpdate: string | null | undefined = undefined;
        if (req.file) {
            logoUrlUpdate = `/uploads/branding/${req.file.filename}`;
        } else if (removeLogo === 'true') {
            logoUrlUpdate = null;
        }

        const resolvedPosPin = posPin === '' ? null : posPin;
        const isMaintenance = maintenanceMode !== undefined
            ? (maintenanceMode === 'true' || maintenanceMode === true)
            : undefined;

        const settings = await prisma.settings.upsert({
            where: { id: 1 },
            update: {
                appName,
                subtitle,
                logoIcon,
                ...(logoUrlUpdate !== undefined ? { logoUrl: logoUrlUpdate } : {}),
                ...(posPin !== undefined ? { posPin: resolvedPosPin } : {}),
                ...(posPinLength !== undefined ? { posPinLength: Number(posPinLength) } : {}),
                ...(emailDomain !== undefined ? { emailDomain } : {}),
                ...(isMaintenance !== undefined ? { maintenanceMode: isMaintenance } : {}),
                ...(receiptFooter !== undefined ? { receiptFooter } : {}),
                ...(receiptPolicy !== undefined ? { receiptPolicy } : {}),
            },
            create: {
                id: 1,
                appName,
                subtitle,
                logoIcon,
                logoUrl: logoUrlUpdate || null,
                posPin: resolvedPosPin || null,
                posPinLength: posPinLength ? Number(posPinLength) : 4,
                emailDomain: emailDomain || 'shadow.com',
                maintenanceMode: isMaintenance || false,
                receiptFooter: receiptFooter || 'Thank you for shopping with us!',
                receiptPolicy: receiptPolicy || 'No return, no exchange after 7 days.',
            },
        });

        // Return safe settings
        res.json({
            id: settings.id,
            appName: settings.appName,
            subtitle: settings.subtitle,
            logoIcon: settings.logoIcon,
            logoUrl: settings.logoUrl,
            posPinLength: settings.posPinLength,
            hasPosPin: !!settings.posPin,
            emailDomain: settings.emailDomain,
            maintenanceMode: settings.maintenanceMode,
            receiptFooter: settings.receiptFooter,
            receiptPolicy: settings.receiptPolicy,
        });
    } catch (error: any) {
        console.error('Failed to update settings:', error);
        res.status(500).json({ error: error.message || 'Failed to update settings' });
    }
});

// POST verify admin password or POS PIN (Protected - any logged in cashier can hit this to verify void permission)
router.post('/verify-pin', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { value } = req.body; // EITHER the 4/6-digit PIN OR the admin password
        if (!value) {
            res.status(400).json({ error: 'Verification value is required.' });
            return;
        }

        // 1. Check against the POS PIN setting
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (settings && settings.posPin && settings.posPin === String(value)) {
            res.json({ valid: true });
            return;
        }

        // 2. Check against the Admin password(s)
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        const bcrypt = require('bcryptjs');
        for (const admin of admins) {
            const match = await bcrypt.compare(value, admin.password);
            if (match) {
                res.json({ valid: true });
                return;
            }
        }

        res.json({ valid: false });
    } catch (error) {
        console.error('Verify pin error:', error);
        res.status(500).json({ error: 'Failed to verify admin credentials.' });
    }
});

// POST clear all data (Protected - ADMIN only)
router.post('/clear-data', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // Clear all transactional and product data
        await prisma.auditLog.deleteMany({});
        await prisma.inventoryAuditItem.deleteMany({});
        await prisma.inventoryAudit.deleteMany({});
        await prisma.transactionItem.deleteMany({});
        await prisma.transaction.deleteMany({});
        await prisma.stockItem.deleteMany({});
        await prisma.bundleItem.deleteMany({});
        await prisma.product.deleteMany({});
        await prisma.category.deleteMany({});
        await prisma.supplier.deleteMany({});
        
        // Log the action
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'CLEAR_DATA',
                entity: 'System',
                details: 'Admin cleared all products, categories, and transactions.'
            }
        });

        res.json({ success: true, message: 'All data has been cleared successfully.' });
    } catch (error: any) {
        console.error('Failed to clear data:', error);
        res.status(500).json({ error: error.message || 'Failed to clear data' });
    }
});

export default router;

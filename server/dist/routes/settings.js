"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Configure upload directory for branding images
const BRANDING_UPLOAD_DIR = path_1.default.join(__dirname, '../../uploads/branding');
if (!fs_1.default.existsSync(BRANDING_UPLOAD_DIR)) {
    fs_1.default.mkdirSync(BRANDING_UPLOAD_DIR, { recursive: true });
}
// Multer Storage Configuration
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, BRANDING_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'logo-' + uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
// File filter (only allow web images)
const fileFilter = (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
        cb(null, true);
    }
    else {
        cb(new Error('Only image files are allowed'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});
// GET current settings (Public - so login page can access it)
router.get('/', async (_req, res) => {
    try {
        let settings = await prisma_1.default.settings.findUnique({
            where: { id: 1 },
        });
        // Fallback in case seed didn't run or table is empty
        if (!settings) {
            settings = await prisma_1.default.settings.create({
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
        };
        res.json(safeSettings);
    }
    catch (error) {
        console.error('Failed to get settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});
// PUT update settings (Protected - ADMIN and STAFF only)
router.put('/', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'STAFF'), upload.single('logo'), async (req, res) => {
    try {
        const { appName, subtitle, logoIcon, removeLogo, posPin, posPinLength, emailDomain, maintenanceMode } = req.body;
        if (!appName || !subtitle || !logoIcon) {
            res.status(400).json({ error: 'appName, subtitle, and logoIcon are required.' });
            return;
        }
        // Determine if logoUrl should be updated
        let logoUrlUpdate = undefined;
        if (req.file) {
            logoUrlUpdate = `/uploads/branding/${req.file.filename}`;
        }
        else if (removeLogo === 'true') {
            logoUrlUpdate = null;
        }
        const resolvedPosPin = posPin === '' ? null : posPin;
        const isMaintenance = maintenanceMode !== undefined
            ? (maintenanceMode === 'true' || maintenanceMode === true)
            : undefined;
        const settings = await prisma_1.default.settings.upsert({
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
        });
    }
    catch (error) {
        console.error('Failed to update settings:', error);
        res.status(500).json({ error: error.message || 'Failed to update settings' });
    }
});
// POST verify admin password or POS PIN (Protected - any logged in cashier can hit this to verify void permission)
router.post('/verify-pin', auth_1.authenticate, async (req, res) => {
    try {
        const { value } = req.body; // EITHER the 4/6-digit PIN OR the admin password
        if (!value) {
            res.status(400).json({ error: 'Verification value is required.' });
            return;
        }
        // 1. Check against the POS PIN setting
        const settings = await prisma_1.default.settings.findUnique({ where: { id: 1 } });
        if (settings && settings.posPin && settings.posPin === String(value)) {
            res.json({ valid: true });
            return;
        }
        // 2. Check against the Admin password(s)
        const admins = await prisma_1.default.user.findMany({ where: { role: 'ADMIN' } });
        const bcrypt = require('bcryptjs');
        for (const admin of admins) {
            const match = await bcrypt.compare(value, admin.password);
            if (match) {
                res.json({ valid: true });
                return;
            }
        }
        res.json({ valid: false });
    }
    catch (error) {
        console.error('Verify pin error:', error);
        res.status(500).json({ error: 'Failed to verify admin credentials.' });
    }
});
exports.default = router;
//# sourceMappingURL=settings.js.map
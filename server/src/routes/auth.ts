import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { logAudit } from '../utils/audit';


const router = Router();

router.post('/login', async (req, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        const JWT_SECRET = process.env.JWT_SECRET || 'shadow-apollo-secret';

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required.' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        await logAudit(user.id, 'LOGIN', 'User', user.id, { email: user.email });


        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/rfid-login', async (req, res: Response): Promise<void> => {
    try {
        const { rfidUid, pin } = req.body;
        const JWT_SECRET = process.env.JWT_SECRET || 'shadow-apollo-secret';

        if (!rfidUid || !pin) {
            res.status(400).json({ error: 'RFID UID and PIN are required.' });
            return;
        }

        const trimmedUid = String(rfidUid).trim();
        const user = await prisma.user.findUnique({ where: { rfidUid: trimmedUid } });
        
        if (!user) {
            res.status(401).json({ error: 'Invalid RFID card or PIN.' });
            return;
        }

        const pinToCompare = user.posPin || user.password;
        const isValid = await bcrypt.compare(pin, pinToCompare);
        
        if (!isValid) {
            res.status(401).json({ error: 'Invalid RFID card or PIN.' });
            return;
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        await logAudit(user.id, 'LOGIN', 'User', user.id, { method: 'RFID_TAP' });

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('RFID Login error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

export default router;

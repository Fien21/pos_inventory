import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();
const MAINSITE_URL = process.env.MAINSITE_URL || 'http://localhost:3000';

router.get('/', async (req: Request, res: Response) => {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (!settings || !settings.licenseKey) {
            return res.json({ tickets: [] });
        }
        
        const response = await fetch(`${MAINSITE_URL}/api/clients/tickets?licenseKey=${settings.licenseKey}`);
        if (!response.ok) throw new Error('Failed to fetch from mainsite');
        
        const data: any = await response.json();
        res.json({ tickets: data.tickets || [] });
    } catch (error) {
        console.error('Fetch tickets error:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    try {
        const { subject, message, senderName, senderRole } = req.body;
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        
        if (!settings || !settings.licenseKey) {
            return res.status(400).json({ error: 'System not licensed' });
        }

        const response = await fetch(`${MAINSITE_URL}/api/clients/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                licenseKey: settings.licenseKey,
                subject,
                message,
                senderName,
                senderRole
            })
        });

        if (!response.ok) throw new Error('Failed to post ticket to mainsite');
        
        const data: any = await response.json();
        res.json({ success: true, ticket: data.ticket });
    } catch (error) {
        console.error('Post ticket error:', error);
        res.status(500).json({ error: 'Failed to post ticket' });
    }
});

export default router;

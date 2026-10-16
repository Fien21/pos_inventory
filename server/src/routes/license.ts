import { Router, Response, Request } from 'express';
import os from 'os';
import prisma from '../lib/prisma';

const router = Router();
const MAINSITE_URL = process.env.MAINSITE_URL || 'http://localhost:3000';

router.post('/verify', async (req: Request, res: Response) => {
    try {
        const licenseKey = req.body.licenseKey?.trim();
        const { deviceId, userAgent } = req.body;
        
        if (!licenseKey) {
            return res.json({ success: false, error: 'License key is required' });
        }
        if (!deviceId) {
            return res.json({ success: false, error: 'Device ID is required' });
        }

        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        
        // If the license key provided matches the server's already active global key
        if (settings && settings.licenseStatus === 'ACTIVE' && settings.licenseKey === licenseKey) {
            
            // Check if device is already registered
            const existingDevice = await prisma.registeredDevice.findUnique({ where: { id: deviceId } });
            if (existingDevice) {
                return res.json({
                    success: true,
                    message: 'Device already registered and license is active.',
                    licenseExpiry: settings.licenseExpiry,
                });
            }

            // Not registered yet, check device limit
            const deviceCount = await prisma.registeredDevice.count();
            if (deviceCount >= settings.maxDevices) {
                // Ping mainsite to alert that they want to add more devices
                try {
                    await fetch(`${MAINSITE_URL}/api/clients/devices`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ licenseKey, action: 'request_upgrade' })
                    });
                } catch (e) {
                    console.error('Failed to notify mainsite of upgrade request', e);
                }

                return res.json({ success: false, error: `Terminal Limit Reached: Your current plan only supports ${settings.maxDevices} active cashier terminal. Please upgrade or purchase an Extra Terminal Add-on to unlock Counter ${settings.maxDevices + 1}.` });
            }

            // Register the device
            await prisma.registeredDevice.create({
                data: {
                    id: deviceId,
                    userAgent: userAgent || 'Unknown'
                }
            });

            // Sync to mainsite
            try {
                await fetch(`${MAINSITE_URL}/api/clients/devices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ licenseKey, deviceId, userAgent: userAgent || 'Unknown', action: 'register' })
                });
            } catch (e) {
                console.error('Failed to sync device to mainsite', e);
            }

            return res.json({
                success: true,
                message: 'Device registered successfully!',
                licenseExpiry: settings.licenseExpiry,
            });
        }

        // If not matching global, we must verify with mainsite
        try {
            const verifyRes = await fetch(`${MAINSITE_URL}/api/clients/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey })
            });

            const data: any = await verifyRes.json();

            if (verifyRes.ok && data.success) {
                if (data.client.systemType && data.client.systemType !== 'POS') {
                    return res.json({ success: false, error: 'This license key is strictly for the Retail Management System (RMS) and cannot be used for the POS system.' });
                }

                const expDate = new Date(data.client.expires);
                const maxDev = data.client.maxDevices || 1;

                // Update server global license
                await prisma.settings.upsert({
                    where: { id: 1 },
                    update: {
                        licenseKey,
                        licenseStatus: 'ACTIVE',
                        licenseExpiry: expDate,
                        maxDevices: maxDev,
                        clientName: data.client.name,
                        clientAddress: data.client.branch,
                        clientContact: data.client.contactNumber,
                        mapLat: data.client.lat ? parseFloat(data.client.lat) : null,
                        mapLng: data.client.lng ? parseFloat(data.client.lng) : null
                    },
                    create: {
                        id: 1,
                        appName: 'Shadow Apollo',
                        licenseKey,
                        licenseStatus: 'ACTIVE',
                        licenseExpiry: expDate,
                        maxDevices: maxDev,
                        clientName: data.client.name,
                        clientAddress: data.client.branch,
                        clientContact: data.client.contactNumber,
                        mapLat: data.client.lat ? parseFloat(data.client.lat) : null,
                        mapLng: data.client.lng ? parseFloat(data.client.lng) : null
                    },
                });

                // Since they are entering a new key, let's see if this device can be registered
                const existingDevice = await prisma.registeredDevice.findUnique({ where: { id: deviceId } });
                
                // If it's a completely new key, maybe we should clear old registered devices?
                // For now, let's just clear them if the key actually changed.
                if (settings && settings.licenseKey !== licenseKey) {
                    await prisma.registeredDevice.deleteMany();
                }

                if (!existingDevice) {
                    await prisma.registeredDevice.create({
                        data: {
                            id: deviceId,
                            userAgent: userAgent || 'Unknown'
                        }
                    });
                }

                // Sync to mainsite
                try {
                    await fetch(`${MAINSITE_URL}/api/clients/devices`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ licenseKey, deviceId, userAgent: userAgent || 'Unknown', action: 'register' })
                    });
                } catch (e) {
                    console.error('Failed to sync device to mainsite', e);
                }

                return res.json({
                    success: true,
                    message: 'License applied and device registered successfully!',
                    licenseExpiry: expDate,
                    clientInfo: data.client
                });
            } else {
                return res.json({ success: false, error: data.error || 'Invalid license key' });
            }
        } catch (fetchError: any) {
            console.error('Mainsite verification error:', fetchError.message);
            return res.json({ success: false, error: 'Failed to communicate with license server.' });
        }

    } catch (error) {
        console.error('License verification error:', error);
        res.json({ success: false, error: 'Failed to process license verification' });
    }
});

router.get('/status', async (req: Request, res: Response) => {
    try {
        const { deviceId } = req.query;
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        
        let currentSettings = settings;

        // Sync with mainsite if we have a key
        if (currentSettings && currentSettings.licenseKey) {
            try {
                const totalMem = os.totalmem();
                const freeMem = os.freemem();
                const usedMem = totalMem - freeMem;
                const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
                
                const cpus = os.cpus().length;
                const loadAvg = os.loadavg()[0] || 0; 
                const cpuPercent = Math.min(((loadAvg / cpus) * 100), 100).toFixed(1);
                const uptime = os.uptime();

                const syncRes = await fetch(`${MAINSITE_URL}/api/clients/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        licenseKey: currentSettings.licenseKey,
                        metrics: {
                            cpu: cpuPercent,
                            memory: memPercent,
                            uptime: uptime,
                            lastSeen: new Date().toISOString()
                        }
                    })
                });
                const syncData: any = await syncRes.json();
                
                if (syncData.success) {
                    let newStatus = currentSettings.licenseStatus;
                    if (syncData.status === 'revoked') newStatus = 'UNLICENSED';
                    else if (syncData.status === 'locked_down') newStatus = 'LOCKED_DOWN';
                    else if (syncData.status === 'active') newStatus = 'ACTIVE';

                    currentSettings = await prisma.settings.update({
                        where: { id: 1 },
                        data: {
                            licenseStatus: newStatus,
                            licenseExpiry: new Date(syncData.expires),
                            maxDevices: syncData.maxDevices
                        }
                    });
                } else if (syncRes.ok) {
                    currentSettings = await prisma.settings.update({
                        where: { id: 1 },
                        data: {
                            licenseStatus: 'UNLICENSED'
                        }
                    });
                }
            } catch (e) {
                console.error('Failed to sync with mainsite during /status', e);
            }
        }

        if (!currentSettings || currentSettings.licenseStatus !== 'ACTIVE') {
            return res.json({ licenseStatus: currentSettings?.licenseStatus || 'UNLICENSED', licenseExpiry: currentSettings?.licenseExpiry });
        }

        // Auto-expire check
        if (currentSettings.licenseExpiry) {
            if (new Date() > new Date(currentSettings.licenseExpiry)) {
                await prisma.settings.update({
                    where: { id: 1 },
                    data: { licenseStatus: 'EXPIRED' }
                });
                return res.json({ licenseStatus: 'EXPIRED', licenseExpiry: currentSettings.licenseExpiry });
            }
        }

        // If server is ACTIVE, check if THIS device is registered
        // Bypassing per-device activation requirement as requested
        /*
        if (deviceId) {
            const device = await prisma.registeredDevice.findUnique({
                where: { id: String(deviceId) }
            });
            
            if (!device) {
                return res.json({ licenseStatus: 'UNREGISTERED_DEVICE', licenseExpiry: currentSettings.licenseExpiry });
            }
        } else {
            return res.json({ licenseStatus: 'UNREGISTERED_DEVICE', licenseExpiry: currentSettings.licenseExpiry });
        }
        */

        // All good, device is registered and server is active
        res.json({
            licenseStatus: 'ACTIVE',
            licenseExpiry: currentSettings.licenseExpiry,
            clientInfo: {
                name: currentSettings.clientName,
                address: currentSettings.clientAddress,
                contact: currentSettings.clientContact,
                mapLat: currentSettings.mapLat,
                mapLng: currentSettings.mapLng
            }
        });
    } catch (error) {
        console.error('Get license status error:', error);
        res.status(500).json({ error: 'Failed to fetch license status' });
    }
});

router.get('/devices', async (req: Request, res: Response) => {
    try {
        const devices = await prisma.registeredDevice.findMany();
        res.json({ success: true, devices });
    } catch (error) {
        console.error('Fetch devices error:', error);
        res.status(500).json({ error: 'Failed to fetch registered devices' });
    }
});

router.delete('/devices/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.registeredDevice.delete({
            where: { id: String(id) }
        });

        // Sync revocation to mainsite
        try {
            const settings = await prisma.settings.findUnique({ where: { id: 1 } });
            if (settings && settings.licenseKey) {
                await fetch(`${MAINSITE_URL}/api/clients/devices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ licenseKey: settings.licenseKey, deviceId: id, action: 'revoke' })
                });
            }
        } catch (e) {
            console.error('Failed to sync device revocation to mainsite', e);
        }

        res.json({ success: true, message: 'Device revoked successfully' });
    } catch (error) {
        console.error('Revoke device error:', error);
        res.status(500).json({ error: 'Failed to revoke device' });
    }
});

export default router;

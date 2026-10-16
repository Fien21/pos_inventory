import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LicenseContextType {
    status: 'ACTIVE' | 'EXPIRED' | 'UNLICENSED' | 'UNREGISTERED_DEVICE' | 'LOCKED_DOWN' | 'LOADING';
    expiry: string | null;
    deviceId: string;
    clientInfo: any;
    checkLicense: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType>({
    status: 'LOADING',
    expiry: null,
    deviceId: '',
    clientInfo: null,
    checkLicense: async () => { },
});

// Helper to get or create device ID
function getDeviceId(): string {
    let id = localStorage.getItem('shadow_pos_device_id');
    if (!id) {
        id = 'DEV-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('shadow_pos_device_id', id);
    }
    return id;
}

export const LicenseProvider = ({ children }: { children: ReactNode }) => {
    const [status, setStatus] = useState<'ACTIVE' | 'EXPIRED' | 'UNLICENSED' | 'UNREGISTERED_DEVICE' | 'LOCKED_DOWN' | 'LOADING'>('LOADING');
    const [expiry, setExpiry] = useState<string | null>(null);
    const [clientInfo, setClientInfo] = useState<any>(null);
    const [deviceId] = useState<string>(getDeviceId());

    const checkLicense = async () => {
        try {
            const res = await fetch(`/api/license/status?deviceId=${deviceId}`);
            if (!res.ok) {
                throw new Error(`Server returned ${res.status}`);
            }
            const text = await res.text();
            if (!text) {
                throw new Error('Empty response');
            }
            const data = JSON.parse(text);
            setStatus(data.licenseStatus || 'UNLICENSED');
            setExpiry(data.licenseExpiry || null);
            setClientInfo(data.clientInfo || null);
        } catch (error) {
            // Silently handle polling errors (often caused by nodemon restarts)
            setStatus('UNLICENSED');
        }
    };

    useEffect(() => {
        checkLicense();
        const interval = setInterval(checkLicense, 5000);
        return () => clearInterval(interval);
    }, [deviceId]);

    return (
        <LicenseContext.Provider value={{ status, expiry, deviceId, clientInfo, checkLicense }}>
            {children}
        </LicenseContext.Provider>
    );
};

export const useLicense = () => useContext(LicenseContext);

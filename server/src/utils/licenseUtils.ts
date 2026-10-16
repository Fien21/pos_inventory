import crypto from 'crypto';

const SECRET_KEY = 'AZTECH_SUPER_SECRET_KEY_2026'; // In production, move to .env

export function generateLicenseKey(daysValid: number): string {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + daysValid);
    
    const payload = {
        exp: expDate.getTime(),
        type: 'PRO',
        issuedAt: Date.now()
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(payloadBase64);
    const signature = hmac.digest('hex');

    return `${payloadBase64}.${signature}`;
}

export function verifyLicenseKey(key: string): { valid: boolean, payload?: any, error?: string } {
    try {
        const parts = key.split('.');
        if (parts.length !== 2) return { valid: false, error: 'Invalid key format' };

        const [payloadBase64, signature] = parts;
        
        const hmac = crypto.createHmac('sha256', SECRET_KEY);
        hmac.update(payloadBase64);
        const expectedSignature = hmac.digest('hex');

        if (signature !== expectedSignature) {
            return { valid: false, error: 'Signature mismatch' };
        }

        const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const payload = JSON.parse(payloadStr);

        if (Date.now() > payload.exp) {
            return { valid: false, error: 'License expired', payload };
        }

        return { valid: true, payload };
    } catch (e) {
        return { valid: false, error: 'Invalid key structure' };
    }
}

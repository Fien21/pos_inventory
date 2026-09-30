import bwipjs from 'bwip-js';
import path from 'path';
import fs from 'fs';

const BARCODE_DIR = path.join(__dirname, '../../uploads/barcodes');

export function generateBarcodeString(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${timestamp}${random}`;
}

export async function generateBarcodeImage(barcodeText: string): Promise<string> {
    if (!fs.existsSync(BARCODE_DIR)) {
        fs.mkdirSync(BARCODE_DIR, { recursive: true });
    }

    const filename = `barcode-${barcodeText}.png`;
    const filepath = path.join(BARCODE_DIR, filename);

    const png = await bwipjs.toBuffer({
        bcid: 'code128',
        text: barcodeText,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
    });

    fs.writeFileSync(filepath, png);
    return `/uploads/barcodes/${filename}`;
}

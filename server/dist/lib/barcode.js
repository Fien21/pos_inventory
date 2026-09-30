"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBarcodeString = generateBarcodeString;
exports.generateBarcodeImage = generateBarcodeImage;
const bwip_js_1 = __importDefault(require("bwip-js"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const BARCODE_DIR = path_1.default.join(__dirname, '../../uploads/barcodes');
function generateBarcodeString() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${timestamp}${random}`;
}
async function generateBarcodeImage(barcodeText) {
    if (!fs_1.default.existsSync(BARCODE_DIR)) {
        fs_1.default.mkdirSync(BARCODE_DIR, { recursive: true });
    }
    const filename = `barcode-${barcodeText}.png`;
    const filepath = path_1.default.join(BARCODE_DIR, filename);
    const png = await bwip_js_1.default.toBuffer({
        bcid: 'code128',
        text: barcodeText,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
    });
    fs_1.default.writeFileSync(filepath, png);
    return `/uploads/barcodes/${filename}`;
}
//# sourceMappingURL=barcode.js.map
import { ScanLine, Search, Package } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function PriceCheck() {
    const [sku, setSku] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleCheck = async () => {
        if (!sku) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/products/search?q=${sku}`);
            if (res.data && res.data.length > 0) {
                setResult(res.data[0]);
            } else {
                throw new Error('Product not found in local stock.');
            }
        } catch (err: any) {
            setResult(null);
            Swal.fire({
                icon: 'error',
                title: 'Not Found',
                text: err.response?.data?.error || 'Product not found.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Price Check / Scan</h1>
                    <p className="text-[11px] text-slate-500 font-medium">Quick item lookup and verification</p>
                </div>
            </header>

            <main className="flex-1 p-6 overflow-y-auto w-full flex flex-col items-center justify-center">
                <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg shadow-sm p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-6">
                        <ScanLine className="w-8 h-8" />
                    </div>
                    <h2 className="text-[18px] font-bold text-slate-900 mb-2">Scan Barcode</h2>
                    <p className="text-[13px] text-slate-500 mb-6">Use your barcode scanner or enter SKU manually</p>
                    
                    <div className="flex gap-2 mb-8">
                        <div className="flex-1 relative">
                            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text" 
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                                placeholder="Scan or enter SKU..." 
                                className="w-full pl-10 pr-3 py-3 text-[14px] font-medium border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>
                        <button onClick={handleCheck} className="bg-slate-900 text-white px-6 py-3 rounded font-bold hover:bg-slate-800 transition-colors">
                            Check
                        </button>
                    </div>

                    {result && (
                        <div className="border border-slate-200 rounded p-4 text-left flex gap-4 bg-slate-50">
                            <div className="w-20 h-20 bg-white border border-slate-200 rounded flex items-center justify-center text-slate-300 overflow-hidden">
                                {result.imageUrl ? <img src={result.imageUrl} alt={result.name} className="w-full h-full object-cover" /> : <Package className="w-8 h-8" />}
                            </div>
                            <div className="flex-1">
                                <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold mb-1">{result.category?.name || 'Uncategorized'} • {result.barcode}</p>
                                <h3 className="text-[16px] font-bold text-slate-900 mb-2">{result.name}</h3>
                                <div className="flex justify-between items-end">
                                    <p className="text-[24px] font-bold text-emerald-600 leading-none">₱{(result.retailPrice || result.price).toFixed(2)}</p>
                                    <p className="text-[12px] font-medium text-slate-500">In Stock: <span className="text-slate-900 font-bold">{result.stockQty}</span></p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

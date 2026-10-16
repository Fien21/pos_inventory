import { useState, useEffect } from 'react';
import { Search, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function Refunds() {
    const [receiptId, setReceiptId] = useState('');
    const [refunds, setRefunds] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRefunds = async () => {
            try {
                // Fetch all transactions and filter to ones with refunds
                const res = await axios.get('/api/transactions');
                const refundedTxns = res.data.filter((t: any) => t.refundStatus === 'PARTIAL' || t.refundStatus === 'FULL');
                setRefunds(refundedTxns);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchRefunds();
    }, []);

    const lookupReceipt = async () => {
        if (!receiptId) return;
        const cleanId = receiptId.replace('RC-', '');
        try {
            const res = await axios.get(`/api/transactions/${cleanId}`);
            if (res.data) {
                Swal.fire({
                    icon: 'success',
                    title: 'Receipt Found',
                    text: `Total: ₱${res.data.totalAmount.toFixed(2)} - Status: ${res.data.status}`,
                    confirmButtonColor: '#0f172a'
                });
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Not Found',
                text: 'Receipt could not be found.',
                confirmButtonColor: '#0f172a'
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Refunds & Returns</h1>
                    <p className="text-[11px] text-slate-500 font-medium">Process customer refunds and item returns</p>
                </div>
            </header>

            <main className="flex-1 p-6 overflow-y-auto w-full flex flex-col gap-6">
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 max-w-xl">
                    <h2 className="text-[14px] font-bold text-slate-900 mb-4">Process New Return</h2>
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text" 
                                value={receiptId}
                                onChange={(e) => setReceiptId(e.target.value)}
                                placeholder="Scan or enter Receipt ID (e.g. RC-12345)" 
                                className="w-full pl-9 pr-3 py-2 text-[13px] border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <button onClick={lookupReceipt} className="bg-slate-900 text-white px-4 py-2 rounded text-[13px] font-bold hover:bg-slate-800 transition-colors">
                            Lookup Receipt
                        </button>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                        <h2 className="text-[14px] font-bold text-slate-900">Recent Refunds</h2>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-[12px]">
                            <thead className="bg-white border-b border-slate-200 text-slate-500 font-medium sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 border-b border-slate-200">Receipt Ref</th>
                                    <th className="px-4 py-3 border-b border-slate-200">Date</th>
                                    <th className="px-4 py-3 border-b border-slate-200">Items Returned</th>
                                    <th className="px-4 py-3 border-b border-slate-200 text-right">Original Total</th>
                                    <th className="px-4 py-3 border-b border-slate-200">Refund Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center"><div className="spinner mx-auto" /></td>
                                    </tr>
                                ) : refunds.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No recent refunds found.</td>
                                    </tr>
                                ) : refunds.map((ref, i) => (
                                    <tr key={ref.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 border-b border-slate-100 text-blue-600 font-bold cursor-pointer">RC-{ref.id}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-500">{new Date(ref.createdAt).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-600">{ref.returnItems?.length || 0} items</td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-right font-bold text-slate-700">₱{(ref.totalAmount || 0).toFixed(2)}</td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            {ref.refundStatus === 'FULL' ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px] font-bold">
                                                    <CheckCircle className="w-3 h-3" /> Fully Refunded
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] font-bold">
                                                    <RotateCcw className="w-3 h-3" /> Partially Refunded
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}

import { Archive, Plus, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function Layaway() {
    const [layaways, setLayaways] = useState<any[]>([]);
    const [paymentModes, setPaymentModes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLayaways = async () => {
        try {
            const res = await axios.get('/api/transactions?status=LAYAWAY');
            setLayaways(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPaymentModes = async () => {
        try {
            const res = await axios.get('/api/payment-modes');
            setPaymentModes(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchLayaways();
        fetchPaymentModes();
    }, []);

    const handleReceivePayment = async (layaway: any) => {
        const balance = (layaway.totalAmount || 0) - (layaway.amountTendered || 0);

        const optionsHtml = paymentModes.map(pm => `<option value="${pm.id}">${pm.name}</option>`).join('');

        const { value: formValues } = await Swal.fire({
            title: `Receive Payment for LYW-${layaway.id}`,
            html: `
                <div style="text-align: left; font-size: 14px; margin-bottom: 10px; color: var(--text-primary);">
                    <strong>Remaining Balance:</strong> ₱${balance.toFixed(2)}
                </div>
                <div style="text-align: left; margin-bottom: 10px;">
                    <label style="color: var(--text-primary);">Amount to Pay (₱)</label>
                    <input id="swal-input-amount" type="number" step="0.01" max="${balance}" class="swal2-input" placeholder="0.00" value="${balance}">
                </div>
                <div style="text-align: left;">
                    <label style="color: var(--text-primary);">Payment Mode</label>
                    <select id="swal-input-pm" class="swal2-select" style="display: flex; width: 100%;">
                        <option value="">Cash</option>
                        ${optionsHtml}
                    </select>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Submit Payment',
            confirmButtonColor: 'var(--accent)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            preConfirm: () => {
                const amount = (document.getElementById('swal-input-amount') as HTMLInputElement).value;
                const pmSelect = (document.getElementById('swal-input-pm') as HTMLSelectElement);
                const pmId = pmSelect.value;
                const pmName = pmId ? pmSelect.options[pmSelect.selectedIndex].text : 'Cash';
                if (!amount || Number(amount) <= 0) {
                    Swal.showValidationMessage('Please enter a valid amount');
                    return false;
                }
                if (Number(amount) > balance) {
                    Swal.showValidationMessage('Amount cannot exceed remaining balance');
                    return false;
                }
                return { amount: Number(amount), paymentModeId: pmId ? Number(pmId) : null, paymentModeName: pmName };
            }
        });

        if (formValues) {
            try {
                await axios.post(`/api/transactions/${layaway.id}/pay-layaway`, formValues);
                Swal.fire({
                    icon: 'success',
                    title: 'Payment Received',
                    text: 'The payment has been applied successfully.',
                    confirmButtonColor: 'var(--accent)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                });
                fetchLayaways();
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.response?.data?.error || 'Failed to apply payment',
                    confirmButtonColor: 'var(--accent)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                });
            }
        }
    };
    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Layaway / Reserves</h1>
                    <p className="text-[11px] text-slate-500 font-medium">Manage customer reserved items and deposits</p>
                </div>
                <button className="bg-slate-900 text-white px-3 py-1.5 rounded flex items-center gap-2 text-[12px] font-bold hover:bg-slate-800 transition-colors">
                    <Plus className="w-4 h-4" /> New Layaway
                </button>
            </header>

            <main className="flex-1 p-6 overflow-y-auto w-full">
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text" 
                                placeholder="Search layaways by customer..." 
                                className="w-[300px] pl-9 pr-3 py-1.5 text-[12px] border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <table className="w-full text-left text-[12px]">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                            <tr>
                                <th className="px-4 py-3">Layaway ID</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Item Reserved</th>
                                <th className="px-4 py-3 text-right">Total Price</th>
                                <th className="px-4 py-3 text-right">Deposit Paid</th>
                                <th className="px-4 py-3 text-right">Balance</th>
                                <th className="px-4 py-3">Due Date</th>
                                <th className="px-4 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center"><div className="spinner mx-auto" /></td>
                                </tr>
                            ) : layaways.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                        No active layaways found.
                                    </td>
                                </tr>
                            ) : layaways.map((l, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                    <td className="px-4 py-3 font-bold text-slate-900">LYW-{l.id}</td>
                                    <td className="px-4 py-3 font-medium text-slate-700">{l.customer?.name || 'Walk-in'}</td>
                                    <td className="px-4 py-3 text-slate-600">{l.items?.length || 0} items</td>
                                    <td className="px-4 py-3 text-right text-slate-600">₱{(l.totalAmount || 0).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-emerald-600 font-bold">₱{(l.amountTendered || 0).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-red-500 font-bold">₱{((l.totalAmount || 0) - (l.amountTendered || 0)).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-slate-500">-</td>
                                    <td className="px-4 py-3">
                                        <button 
                                            onClick={() => handleReceivePayment(l)}
                                            className="text-blue-600 font-bold hover:underline">
                                            Receive Payment
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}

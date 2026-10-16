import { Wallet, ArrowDownRight, ArrowUpRight, Lock, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function CashDrawer() {
    const [tillData, setTillData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchTillData = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/shifts/till/data');
            setTillData(res.data);
        } catch (err) {
            console.error('Failed to fetch till data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTillData();
    }, []);

    const currentBalance = tillData?.currentBalance || 0;

    const handlePayIn = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Pay In',
            html: `
                <div class="space-y-3 text-left">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Amount (₱) *</label>
                        <input id="swal-payin-amount" type="number" step="0.01" min="0.01" class="w-full border border-slate-300 rounded p-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="0.00" />
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes *</label>
                        <input id="swal-payin-reason" type="text" class="w-full border border-slate-300 rounded p-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="e.g. Added Float, Change replenishment" />
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Add to Till',
            confirmButtonColor: '#059669',
            cancelButtonColor: '#94a3b8',
            preConfirm: () => {
                const amountInput = (document.getElementById('swal-payin-amount') as HTMLInputElement)?.value;
                const reasonInput = (document.getElementById('swal-payin-reason') as HTMLInputElement)?.value;
                const amt = parseFloat(amountInput);
                if (!amt || amt <= 0) {
                    Swal.showValidationMessage('Please enter a valid positive amount in ₱.');
                    return false;
                }
                if (!reasonInput || !reasonInput.trim()) {
                    Swal.showValidationMessage('Please provide a reason for the Pay In.');
                    return false;
                }
                return { amount: amt, reason: reasonInput.trim() };
            }
        });

        if (formValues) {
            try {
                await axios.post('/api/shifts/till/pay-in', formValues);
                Swal.fire({
                    icon: 'success',
                    title: 'Pay In Recorded',
                    text: `Successfully added ₱${formValues.amount.toFixed(2)} to till.`,
                    confirmButtonColor: '#0f172a'
                });
                fetchTillData();
            } catch (err: any) {
                Swal.fire('Error', err.response?.data?.error || 'Failed to process Pay In', 'error');
            }
        }
    };

    const handlePayOut = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Pay Out',
            html: `
                <div class="space-y-3 text-left">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Amount (₱) *</label>
                        <input id="swal-payout-amount" type="number" step="0.01" min="0.01" class="w-full border border-slate-300 rounded p-2 text-sm focus:outline-none focus:border-red-500" placeholder="0.00" />
                        <p class="text-[11px] text-slate-500 mt-1">Available in Till: ₱${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes *</label>
                        <input id="swal-payout-reason" type="text" class="w-full border border-slate-300 rounded p-2 text-sm focus:outline-none focus:border-red-500" placeholder="e.g. Petty cash, Supplier payout, Refund" />
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Withdraw from Till',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#94a3b8',
            preConfirm: () => {
                const amountInput = (document.getElementById('swal-payout-amount') as HTMLInputElement)?.value;
                const reasonInput = (document.getElementById('swal-payout-reason') as HTMLInputElement)?.value;
                const amt = parseFloat(amountInput);
                if (!amt || amt <= 0) {
                    Swal.showValidationMessage('Please enter a valid positive amount in ₱.');
                    return false;
                }
                if (amt > currentBalance) {
                    Swal.showValidationMessage(`Cannot withdraw ₱${amt.toFixed(2)}. Current till balance is only ₱${currentBalance.toFixed(2)}.`);
                    return false;
                }
                if (!reasonInput || !reasonInput.trim()) {
                    Swal.showValidationMessage('Please provide a reason for the Pay Out.');
                    return false;
                }
                return { amount: amt, reason: reasonInput.trim() };
            }
        });

        if (formValues) {
            try {
                await axios.post('/api/shifts/till/pay-out', formValues);
                Swal.fire({
                    icon: 'success',
                    title: 'Pay Out Recorded',
                    text: `Successfully withdrew ₱${formValues.amount.toFixed(2)} from till.`,
                    confirmButtonColor: '#0f172a'
                });
                fetchTillData();
            } catch (err: any) {
                Swal.fire('Error', err.response?.data?.error || 'Failed to process Pay Out', 'error');
            }
        }
    };

    const handleOpenDrawer = async () => {
        try {
            // Hardware pulse event trigger
            window.dispatchEvent(new CustomEvent('pulse-cash-drawer'));
            
            // Persist No Sale audit
            await axios.post('/api/shifts/till/open-drawer', { reason: 'No Sale Manual Drawer Open' });
            
            Swal.fire({
                icon: 'success',
                title: 'Drawer Opened',
                text: 'Cash drawer trigger pulse sent and No Sale activity logged.',
                confirmButtonColor: '#0f172a'
            });
            fetchTillData();
        } catch (err: any) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to trigger drawer open', 'error');
        }
    };

    // Combine shift opening float, cash sales, cash refunds, and manual till movements
    const allActivities: any[] = [];
    if (tillData) {
        if (tillData.openingFloat > 0) {
            allActivities.push({
                type: 'IN',
                amount: tillData.openingFloat,
                desc: 'Opening Float',
                time: new Date(tillData.activeShift?.startTime || Date.now()).toLocaleTimeString(),
                user: tillData.activeShift?.cashier?.name || 'System'
            });
        }
        if (tillData.cashSales > 0) {
            allActivities.push({
                type: 'IN',
                amount: tillData.cashSales,
                desc: 'Total Cash Sales',
                time: 'Shift Activity',
                user: tillData.activeShift?.cashier?.name || 'Register'
            });
        }
        if (tillData.cashRefunds > 0) {
            allActivities.push({
                type: 'OUT',
                amount: -tillData.cashRefunds,
                desc: 'Total Cash Refunds',
                time: 'Shift Activity',
                user: tillData.activeShift?.cashier?.name || 'Register'
            });
        }
        if (Array.isArray(tillData.activities)) {
            allActivities.push(...tillData.activities);
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Cash Drawer & Till</h1>
                    <p className="text-[11px] text-slate-500 font-medium">Manage cash float, pay-ins, and pay-outs</p>
                </div>
                <button 
                    onClick={fetchTillData}
                    className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    title="Refresh Till Data"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </header>

            <main className="flex-1 p-6 overflow-y-auto w-full flex flex-col md:flex-row gap-6">
                <div className="flex-1 flex flex-col gap-6">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Wallet className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[12px] text-slate-500 font-bold uppercase tracking-wider mb-1">Current Till Balance</p>
                                <h2 className="text-[32px] font-bold text-slate-900 leading-none">
                                    ₱{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </h2>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handlePayIn}
                                className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded font-bold text-[13px] flex items-center gap-2 hover:bg-emerald-100 transition-colors"
                            >
                                <ArrowDownRight className="w-4 h-4" /> Pay In
                            </button>
                            <button 
                                onClick={handlePayOut}
                                className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded font-bold text-[13px] flex items-center gap-2 hover:bg-red-100 transition-colors"
                            >
                                <ArrowUpRight className="w-4 h-4" /> Pay Out
                            </button>
                            <button 
                                onClick={handleOpenDrawer}
                                className="bg-slate-900 text-white px-4 py-2 rounded font-bold text-[13px] flex items-center gap-2 hover:bg-slate-800 transition-colors ml-2"
                            >
                                <Lock className="w-4 h-4" /> Open Drawer
                            </button>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <h3 className="text-[14px] font-bold text-slate-900">Today's Till Activity</h3>
                            <span className="text-[11px] text-slate-500 font-medium">{allActivities.length} total event(s)</span>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            {loading ? (
                                <div className="text-center py-8 text-slate-400">Loading till activities...</div>
                            ) : allActivities.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">No till activity recorded today.</div>
                            ) : (
                                <div className="space-y-4">
                                    {allActivities.map((tx, i) => (
                                        <div key={i} className="flex justify-between items-center pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                    tx.type === 'IN' 
                                                        ? 'bg-emerald-50 text-emerald-600' 
                                                        : tx.type === 'OUT' 
                                                            ? 'bg-red-50 text-red-600' 
                                                            : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {tx.type === 'IN' ? <ArrowDownRight className="w-4 h-4" /> : tx.type === 'OUT' ? <ArrowUpRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-bold text-slate-900">{tx.desc}</p>
                                                    <p className="text-[11px] text-slate-500">{tx.time} • by {tx.user}</p>
                                                </div>
                                            </div>
                                            <div className={`text-[14px] font-bold ${
                                                tx.type === 'IN' 
                                                    ? 'text-emerald-600' 
                                                    : tx.type === 'OUT' 
                                                        ? 'text-red-600' 
                                                        : 'text-slate-500'
                                            }`}>
                                                {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''} ₱{Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

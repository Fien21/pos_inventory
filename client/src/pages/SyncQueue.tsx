import { RefreshCw, CloudOff, CheckCircle2, UploadCloud, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function SyncQueue() {
    const [queue, setQueue] = useState<any[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const storedQueue = localStorage.getItem('shadow-apollo-offline-queue');
        if (storedQueue) {
            try {
                setQueue(JSON.parse(storedQueue));
            } catch (e) {
                console.error('Failed to parse offline queue', e);
            }
        }
    }, []);

    const handleSync = async () => {
        if (queue.length === 0) return;
        setIsSyncing(true);

        try {
            const res = await axios.post('/api/transactions/sync-bulk', { transactions: queue });
            if (res.data.success) {
                // Remove synced items from local queue (for simplicity, we clear all if success)
                const failed = res.data.results.filter((r: any) => !r.success);
                
                if (failed.length === 0) {
                    localStorage.removeItem('shadow-apollo-offline-queue');
                    setQueue([]);
                    Swal.fire('Synced!', 'All offline transactions synced successfully.', 'success');
                } else {
                    const remaining = queue.filter(q => failed.find((f: any) => f.id === q.offlineId));
                    localStorage.setItem('shadow-apollo-offline-queue', JSON.stringify(remaining));
                    setQueue(remaining);
                    Swal.fire('Partial Sync', `${failed.length} transactions failed to sync.`, 'warning');
                }
            }
        } catch (error) {
            console.error('Sync failed', error);
            Swal.fire('Error', 'Failed to synchronize with the server. Are you online?', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const clearQueue = () => {
        Swal.fire({
            title: 'Clear Queue?',
            text: 'This will permanently delete all offline transactions. Proceed?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff6b6b'
        }).then((res) => {
            if (res.isConfirmed) {
                localStorage.removeItem('shadow-apollo-offline-queue');
                setQueue([]);
            }
        });
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Sync Queue</h1>
                    <p className="text-[11px] text-slate-500 font-medium">Offline mode synchronization status</p>
                </div>
                <div className="flex gap-2">
                    {queue.length > 0 && (
                        <button onClick={clearQueue} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded font-bold text-[13px] flex items-center gap-2 hover:bg-slate-50 transition-colors">
                            <Trash2 className="w-4 h-4" /> Clear
                        </button>
                    )}
                    <button 
                        onClick={handleSync}
                        disabled={queue.length === 0 || isSyncing}
                        className={`bg-slate-900 text-white px-4 py-2 rounded font-bold text-[13px] flex items-center gap-2 transition-colors ${queue.length === 0 || isSyncing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800'}`}
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /> 
                        {isSyncing ? 'Syncing...' : 'Force Sync Now'}
                    </button>
                </div>
            </header>

            <main className="flex-1 p-6 overflow-y-auto w-full flex flex-col items-center">
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 w-full max-w-2xl text-center mb-6">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${queue.length === 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                        {queue.length === 0 ? <CheckCircle2 className="w-8 h-8" /> : <RefreshCw className="w-8 h-8" />}
                    </div>
                    <h2 className="text-[18px] font-bold text-slate-900 mb-1">
                        {queue.length === 0 ? 'System is Synced' : 'Pending Sync'}
                    </h2>
                    <p className="text-[13px] text-slate-500">
                        {queue.length === 0 
                            ? 'All transactions have been uploaded. 0 pending items in queue.' 
                            : `${queue.length} offline transaction(s) waiting to be pushed to the server.`}
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg shadow-sm w-full max-w-2xl flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h3 className="text-[14px] font-bold text-slate-900">Recent Sync Logs</h3>
                    </div>
                    <div className="p-4">
                        <div className="space-y-3">
                            {queue.length === 0 ? (
                                <div className="text-center text-slate-500 text-[13px] py-4">No pending items.</div>
                            ) : (
                                queue.map((q, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 border border-slate-100 rounded bg-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-100 text-amber-600">
                                                <CloudOff className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-bold text-slate-900">Offline Sale</p>
                                                <p className="text-[11px] text-slate-500">Total: ₱{q.totalAmount?.toFixed(2) || '0.00'} | Items: {q.items?.length || 0}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[12px] font-bold text-amber-600">Pending</p>
                                            <p className="text-[11px] text-slate-500">{new Date(q.createdAt || Date.now()).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

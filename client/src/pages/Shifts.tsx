import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, Play, Square, Printer, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

interface Shift {
    id: number;
    cashierId: number;
    cashier: { name: string; role: string };
    startTime: string;
    endTime: string | null;
    startingCash: number;
    endingCash: number | null;
    expectedCash: number | null;
    status: string;
}

export default function Shifts() {
    const { token, user } = useAuth();
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [activeShift, setActiveShift] = useState<Shift | null>(null);

    useEffect(() => {
        fetchShifts();
        fetchActiveShift();
    }, []);

    const fetchShifts = async () => {
        try {
            const res = await axios.get('/api/shifts', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShifts(res.data);
        } catch (error) {
            console.error('Failed to fetch shifts', error);
        }
    };

    const fetchActiveShift = async () => {
        try {
            const res = await axios.get('/api/shifts/active', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveShift(res.data);
        } catch (error) {
            console.error('Failed to fetch active shift', error);
        }
    };

    const handleStartShift = async () => {
        const { value: startingCash } = await Swal.fire({
            title: 'Start Shift',
            input: 'number',
            inputLabel: 'Enter Starting Cash (₱)',
            inputPlaceholder: '0.00',
            showCancelButton: true,
            confirmButtonText: 'Start',
            inputValidator: (value) => {
                if (!value || isNaN(Number(value))) {
                    return 'Please enter a valid amount!';
                }
            }
        });

        if (startingCash) {
            try {
                await axios.post('/api/shifts/start', { startingCash: Number(startingCash) }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Swal.fire('Shift Started', 'Your shift has started successfully.', 'success');
                fetchShifts();
                fetchActiveShift();
            } catch (error: any) {
                Swal.fire('Error', error.response?.data?.error || 'Failed to start shift', 'error');
            }
        }
    };

    const handleEndShift = async (id: number) => {
        const { value: endingCash } = await Swal.fire({
            title: 'End Shift',
            input: 'number',
            inputLabel: 'Enter Ending Cash (₱)',
            inputPlaceholder: '0.00',
            showCancelButton: true,
            confirmButtonText: 'End Shift',
            inputValidator: (value) => {
                if (!value || isNaN(Number(value))) {
                    return 'Please enter a valid amount!';
                }
            }
        });

        if (endingCash) {
            try {
                await axios.post(`/api/shifts/${id}/end`, { endingCash: Number(endingCash) }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Swal.fire('Shift Ended', 'Your shift has been closed successfully.', 'success');
                fetchShifts();
                fetchActiveShift();
            } catch (error: any) {
                Swal.fire('Error', error.response?.data?.error || 'Failed to end shift', 'error');
            }
        }
    };

    const handlePrintReading = async (shiftId: number, type: 'X' | 'Z') => {
        try {
            const res = await axios.get(`/api/shifts/${shiftId}/reading`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = res.data;

            let html = `
                <div style="font-family: monospace; text-align: left; font-size: 0.9em; max-width: 300px; margin: 0 auto;">
                    <h3 style="text-align: center; margin: 0 0 10px 0;">${type}-READING</h3>
                    <p><strong>Shift ID:</strong> ${data.shiftId}</p>
                    <p><strong>Cashier:</strong> ${data.cashierName}</p>
                    <p><strong>Start:</strong> ${new Date(data.startTime).toLocaleString()}</p>
                    <p><strong>End:</strong> ${data.endTime ? new Date(data.endTime).toLocaleString() : 'ONGOING'}</p>
                    <hr style="border: 1px dashed #ccc; margin: 10px 0;" />
                    <div style="display: flex; justify-content: space-between;">
                        <span>Starting Cash:</span>
                        <span>₱${data.startingCash.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Cash Sales:</span>
                        <span>₱${data.totalCashSales.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Card/Other Sales:</span>
                        <span>₱${data.totalCardSales.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Discounts Given:</span>
                        <span>₱${data.totalDiscounts.toFixed(2)}</span>
                    </div>
                    <hr style="border: 1px dashed #ccc; margin: 10px 0;" />
                    <div style="display: flex; justify-content: space-between; font-weight: bold;">
                        <span>Expected Cash:</span>
                        <span>₱${data.expectedCash.toFixed(2)}</span>
                    </div>
                    ${data.endingCash !== null ? `
                    <div style="display: flex; justify-content: space-between; font-weight: bold;">
                        <span>Actual Cash:</span>
                        <span>₱${data.endingCash.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: bold; color: ${data.shortageOverage! >= 0 ? 'green' : 'red'};">
                        <span>${data.shortageOverage! >= 0 ? 'Overage' : 'Shortage'}:</span>
                        <span>₱${Math.abs(data.shortageOverage!).toFixed(2)}</span>
                    </div>
                    ` : ''}
                </div>
            `;

            Swal.fire({
                html,
                showCloseButton: true,
                showConfirmButton: true,
                confirmButtonText: '<i class="lucide lucide-printer"></i> Print',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
            }).then((result) => {
                if (result.isConfirmed) {
                    window.print();
                }
            });
        } catch (error: any) {
            Swal.fire('Error', error.response?.data?.error || 'Failed to generate reading', 'error');
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="flex items-center gap-2 flex items-center gap-2 text-[20px] font-bold text-slate-900 tracking-tight">
                        <Clock className="icon-lg" style={{ color: 'var(--primary)' }} /> Shifts & Cash Drawer
                    </h1>
                    <p className="text-[11px] text-slate-500 font-medium">Manage your daily shifts and monitor cash drawers.</p>
                </div>
                {!activeShift ? (
                    <button className="btn btn-primary" onClick={handleStartShift}>
                        <Play size={20} /> Start Shift
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button className="btn btn-secondary" onClick={() => handlePrintReading(activeShift.id, 'X')}>
                            <FileText size={20} /> X-Reading
                        </button>
                        <button className="btn btn-secondary" style={{ color: '#ff4b4b', borderColor: '#ff4b4b' }} onClick={() => handleEndShift(activeShift.id)}>
                            <Square size={20} /> End Current Shift
                        </button>
                    </div>
                )}
            </header>
            <main className="flex-1 p-5 overflow-y-auto w-full">

            {activeShift && (
                <div className="card mb-6" style={{ borderLeft: '4px solid var(--accent)', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: 'rgba(108, 99, 255, 0.1)', padding: '16px', borderRadius: '50%' }}>
                            <Clock size={32} style={{ color: 'var(--accent)' }} />
                        </div>
                        <div>
                            <h2 style={{ margin: '0 0 4px 0', fontSize: '1.2rem' }}>Active Shift In Progress</h2>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                Started at: <strong>{new Date(activeShift.startTime).toLocaleString()}</strong>
                            </p>
                            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
                                Starting Cash: <strong style={{ color: 'var(--green)' }}>₱{activeShift.startingCash.toFixed(2)}</strong>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="table-container">
                    <table className="table w-full">
                        <thead>
                            <tr>
                                <th>Shift ID</th>
                                {user?.role === 'ADMIN' && <th>Cashier</th>}
                                <th>Start Time</th>
                                <th>End Time</th>
                                <th>Starting Cash</th>
                                <th>Ending Cash</th>
                                <th>Status</th>
                                {user?.role === 'ADMIN' && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {shifts.map(shift => (
                                <tr key={shift.id}>
                                    <td>#{shift.id}</td>
                                    {user?.role === 'ADMIN' && (
                                        <td style={{ fontWeight: 500 }}>{shift.cashier?.name} ({shift.cashier?.role})</td>
                                    )}
                                    <td>{new Date(shift.startTime).toLocaleString()}</td>
                                    <td>{shift.endTime ? new Date(shift.endTime).toLocaleString() : '-'}</td>
                                    <td>₱{shift.startingCash.toFixed(2)}</td>
                                    <td>{shift.endingCash !== null ? `₱${shift.endingCash.toFixed(2)}` : '-'}</td>
                                    <td>
                                        <span className={`badge ${shift.status === 'OPEN' ? 'badge-success' : 'badge-secondary'}`}>
                                            {shift.status}
                                        </span>
                                    </td>
                                    {user?.role === 'ADMIN' && (
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    title="Print Reading"
                                                    onClick={() => handlePrintReading(shift.id, shift.status === 'CLOSED' ? 'Z' : 'X')}
                                                >
                                                    <Printer size={16} />
                                                </button>
                                                {shift.status === 'OPEN' && (
                                                    <button
                                                        className="btn btn-sm"
                                                        style={{ background: 'var(--bg-hover)', color: '#ff4b4b' }}
                                                        onClick={() => handleEndShift(shift.id)}
                                                    >
                                                        Force End
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {shifts.length === 0 && (
                                <tr>
                                    <td colSpan={user?.role === 'ADMIN' ? 8 : 6} className="text-center py-8 text-muted">
                                        No shifts found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
        </div>
    );
}

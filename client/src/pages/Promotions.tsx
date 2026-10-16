import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react';
import Swal from 'sweetalert2';

export default function Promotions() {
    const [promotions, setPromotions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPromotions = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/promotions');
            setPromotions(res.data);
        } catch (err) {
            console.error('Failed to fetch promotions', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPromotions();
    }, []);

    const handleCreate = () => {
        Swal.fire({
            title: 'Create Promotion',
            html: `
                <input id="swal-input-name" class="swal2-input" placeholder="Promotion Name (e.g. 10% Off All)">
                <select id="swal-input-type" class="swal2-select" style="width: 100%;">
                    <option value="PERCENTAGE">Percentage Discount</option>
                    <option value="FIXED">Fixed Amount Discount</option>
                </select>
                <input id="swal-input-value" type="number" class="swal2-input" placeholder="Value (e.g. 10)">
                <select id="swal-input-target" class="swal2-select" style="width: 100%;">
                    <option value="ALL">All Products</option>
                </select>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Create',
            confirmButtonColor: 'var(--accent)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            preConfirm: () => {
                const name = (document.getElementById('swal-input-name') as HTMLInputElement).value;
                const type = (document.getElementById('swal-input-type') as HTMLSelectElement).value;
                const value = (document.getElementById('swal-input-value') as HTMLInputElement).value;
                const targetType = (document.getElementById('swal-input-target') as HTMLSelectElement).value;

                if (!name || !value) {
                    Swal.showValidationMessage('Name and Value are required');
                    return false;
                }
                return { name, type, value: Number(value), targetType };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await axios.post('/api/promotions', result.value);
                    Swal.fire({
                        title: 'Created!',
                        text: 'Promotion created successfully',
                        icon: 'success',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                    });
                    fetchPromotions();
                } catch (err: any) {
                    Swal.fire({
                        title: 'Error',
                        text: err.response?.data?.error || 'Failed to create promotion',
                        icon: 'error',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                    });
                }
            }
        });
    };

    const handleDelete = async (id: number) => {
        Swal.fire({
            title: 'Delete Promotion?',
            text: "This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await axios.delete(`/api/promotions/${id}`);
                    fetchPromotions();
                } catch (err: any) {
                    Swal.fire('Error', err.response?.data?.error || 'Failed to delete', 'error');
                }
            }
        });
    };

    const toggleStatus = async (promo: any) => {
        try {
            await axios.put(`/api/promotions/${promo.id}`, { ...promo, isActive: !promo.isActive });
            fetchPromotions();
        } catch (err: any) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to update status', 'error');
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[72px] bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Promotions & Discounts</h1>
                    <p className="text-[13px] text-slate-500 font-medium">Manage automatic discounts applied at checkout.</p>
                </div>
                <button onClick={handleCreate} className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-slate-800 transition-colors">
                    <Plus size={18} /> New Promotion
                </button>
            </header>

            <main className="flex-1 p-6 overflow-y-auto">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Promotion Name</th>
                                <th className="px-6 py-4 font-semibold">Type</th>
                                <th className="px-6 py-4 font-semibold">Value</th>
                                <th className="px-6 py-4 font-semibold">Target</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center"><div className="spinner mx-auto" /></td></tr>
                            ) : promotions.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-medium">No promotions found</td></tr>
                            ) : (
                                promotions.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-900">{p.name}</td>
                                        <td className="px-6 py-4 text-slate-600 font-medium">{p.type}</td>
                                        <td className="px-6 py-4 text-slate-600 font-medium">
                                            {p.type === 'PERCENTAGE' ? `${p.value}%` : `₱${p.value}`}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{p.targetType}</td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => toggleStatus(p)} 
                                                className={`px-3 py-1 rounded-full text-xs font-bold ${p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                                            >
                                                {p.isActive ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 flex justify-end gap-3">
                                            <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}

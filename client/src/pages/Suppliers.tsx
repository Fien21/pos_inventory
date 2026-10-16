import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, Plus, Edit2, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

interface Supplier {
    id: number;
    name: string;
    contactPerson: string | null;
    contactNumber: string | null;
    email: string | null;
    address: string | null;
    isActive: boolean;
}

export default function Suppliers() {
    const { token } = useAuth();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentSupplier, setCurrentSupplier] = useState<Partial<Supplier>>({});

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        try {
            const res = await axios.get('/api/suppliers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuppliers(res.data);
        } catch (error) {
            console.error('Failed to fetch suppliers', error);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (currentSupplier.id) {
                await axios.put(`/api/suppliers/${currentSupplier.id}`, currentSupplier, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Swal.fire('Updated', 'Supplier updated successfully', 'success');
            } else {
                await axios.post('/api/suppliers', currentSupplier, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Swal.fire('Created', 'Supplier created successfully', 'success');
            }
            setIsEditing(false);
            setCurrentSupplier({});
            fetchSuppliers();
        } catch (error: any) {
            Swal.fire('Error', error.response?.data?.error || 'Failed to save supplier', 'error');
        }
    };

    const handleDelete = async (id: number) => {
        const { isConfirmed } = await Swal.fire({
            title: 'Delete Supplier?',
            text: "This cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete'
        });

        if (isConfirmed) {
            try {
                await axios.delete(`/api/suppliers/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Swal.fire('Deleted', 'Supplier has been deleted', 'success');
                fetchSuppliers();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete supplier', 'error');
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="flex items-center gap-2 flex items-center gap-2 text-[20px] font-bold text-slate-900 tracking-tight">
                        <Truck className="icon-lg" style={{ color: 'var(--primary)' }} /> Suppliers
                    </h1>
                    <p className="text-[11px] text-slate-500 font-medium">Manage your supplier list and contact info</p>
                </div>
                {!isEditing && (
                    <button className="btn btn-primary" onClick={() => { setIsEditing(true); setCurrentSupplier({ isActive: true }); }}>
                        <Plus size={20} /> Add Supplier
                    </button>
                )}
            </header>
            <main className="flex-1 p-5 overflow-y-auto w-full">

            {isEditing ? (
                <div className="card">
                    <h2 className="card-header">{currentSupplier.id ? 'Edit Supplier' : 'New Supplier'}</h2>
                    <form onSubmit={handleSave} className="p-6">
                        <div className="form-group">
                            <label>Supplier Name *</label>
                            <input
                                type="text"
                                className="input"
                                value={currentSupplier.name || ''}
                                onChange={(e) => setCurrentSupplier({ ...currentSupplier, name: e.target.value })}
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Contact Person</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={currentSupplier.contactPerson || ''}
                                    onChange={(e) => setCurrentSupplier({ ...currentSupplier, contactPerson: e.target.value })}
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Contact Number</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={currentSupplier.contactNumber || ''}
                                    onChange={(e) => setCurrentSupplier({ ...currentSupplier, contactNumber: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                className="input"
                                value={currentSupplier.email || ''}
                                onChange={(e) => setCurrentSupplier({ ...currentSupplier, email: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Address</label>
                            <textarea
                                className="input"
                                rows={2}
                                value={currentSupplier.address || ''}
                                onChange={(e) => setCurrentSupplier({ ...currentSupplier, address: e.target.value })}
                            />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                            <input
                                type="checkbox"
                                id="active-check"
                                checked={currentSupplier.isActive !== false}
                                onChange={(e) => setCurrentSupplier({ ...currentSupplier, isActive: e.target.checked })}
                                style={{ width: '18px', height: '18px' }}
                            />
                            <label htmlFor="active-check" style={{ margin: 0, fontWeight: 500 }}>Active Supplier</label>
                        </div>
                        <div className="flex gap-4 mt-6">
                            <button type="submit" className="btn btn-primary">Save Supplier</button>
                            <button type="button" className="btn btn-secondary" onClick={() => { setIsEditing(false); setCurrentSupplier({}); }}>Cancel</button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="card">
                    <div className="table-container">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th>Supplier Name</th>
                                    <th>Contact Person</th>
                                    <th>Phone / Email</th>
                                    <th>Address</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {suppliers.map(supplier => (
                                    <tr key={supplier.id}>
                                        <td style={{ fontWeight: 500 }}>{supplier.name}</td>
                                        <td>{supplier.contactPerson || '-'}</td>
                                        <td>
                                            <div>{supplier.contactNumber || '-'}</div>
                                            <div className="text-muted text-sm">{supplier.email || ''}</div>
                                        </td>
                                        <td>{supplier.address || '-'}</td>
                                        <td>
                                            <span className={`badge ${supplier.isActive ? 'badge-success' : 'badge-error'}`}>
                                                {supplier.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    className="btn-icon"
                                                    style={{ color: 'var(--accent)' }}
                                                    onClick={() => { setCurrentSupplier(supplier); setIsEditing(true); }}
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    className="btn-icon"
                                                    style={{ color: '#ff4b4b' }}
                                                    onClick={() => handleDelete(supplier.id)}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {suppliers.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-muted">No suppliers found. Click "Add Supplier" to create one.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </main>
        </div>
    );
}

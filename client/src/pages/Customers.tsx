import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Plus, Edit2, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

interface Customer {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    loyaltyPoints: number;
    storeCredit: number;
    createdAt: string;
    ledgerEntries?: any[];
}

export default function Customers() {
    const { token } = useAuth();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer>>({});

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const res = await axios.get('/api/customers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomers(res.data);
        } catch (error) {
            console.error('Failed to fetch customers', error);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (currentCustomer.id) {
                await axios.put(`/api/customers/${currentCustomer.id}`, currentCustomer, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Swal.fire('Updated', 'Customer updated successfully', 'success');
            } else {
                await axios.post('/api/customers', currentCustomer, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Swal.fire('Created', 'Customer created successfully', 'success');
            }
            setIsEditing(false);
            setCurrentCustomer({});
            fetchCustomers();
        } catch (error: any) {
            Swal.fire('Error', error.response?.data?.error || 'Failed to save customer', 'error');
        }
    };

    const handleDelete = async (id: number) => {
        const { isConfirmed } = await Swal.fire({
            title: 'Delete Customer?',
            text: "This cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete'
        });

        if (isConfirmed) {
            try {
                await axios.delete(`/api/customers/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Swal.fire('Deleted', 'Customer has been deleted', 'success');
                fetchCustomers();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete customer', 'error');
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="flex items-center gap-2 flex items-center gap-2 text-[20px] font-bold text-slate-900 tracking-tight">
                        <Users className="icon-lg" style={{ color: 'var(--primary)' }} /> Customers
                    </h1>
                    <p className="text-[11px] text-slate-500 font-medium">Manage your customers, loyalty points, and store credits.</p>
                </div>
                {!isEditing && (
                    <button className="btn btn-primary" onClick={() => { setIsEditing(true); setCurrentCustomer({}); }}>
                        <Plus size={20} /> Add Customer
                    </button>
                )}
            </header>
            <main className="flex-1 p-5 overflow-y-auto w-full">

            {isEditing ? (
                <div className="card">
                    <h2 className="card-header">{currentCustomer.id ? 'Edit Customer' : 'New Customer'}</h2>
                    <form onSubmit={handleSave} className="p-6">
                        <div className="form-group">
                            <label>Customer Name *</label>
                            <input
                                type="text"
                                className="input"
                                value={currentCustomer.name || ''}
                                onChange={(e) => setCurrentCustomer({ ...currentCustomer, name: e.target.value })}
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    className="input"
                                    value={currentCustomer.email || ''}
                                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, email: e.target.value })}
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Phone Number</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={currentCustomer.phone || ''}
                                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, phone: e.target.value })}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Loyalty Points</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={currentCustomer.loyaltyPoints || 0}
                                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, loyaltyPoints: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Store Credit</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    value={currentCustomer.storeCredit || 0}
                                    onChange={(e) => setCurrentCustomer({ ...currentCustomer, storeCredit: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                        
                        <div className="flex gap-4 mt-6 mb-8">
                            <button type="submit" className="btn btn-primary">Save Customer</button>
                            <button type="button" className="btn btn-secondary" onClick={() => { setIsEditing(false); setCurrentCustomer({}); }}>Cancel</button>
                        </div>
                    </form>

                    {currentCustomer.id && (
                        <div className="p-6 pt-0">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Ledger & History</h3>
                            <div className="table-container max-h-[300px] overflow-y-auto border border-slate-200 rounded">
                                <table className="table w-full">
                                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Amount</th>
                                            <th>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentCustomer.ledgerEntries && currentCustomer.ledgerEntries.length > 0 ? (
                                            currentCustomer.ledgerEntries.map((entry: any) => (
                                                <tr key={entry.id}>
                                                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                                                    <td>
                                                        <span style={{
                                                            padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                                                            background: entry.type === 'POINTS' ? 'rgba(108, 99, 255, 0.1)' : 'rgba(255, 165, 0, 0.1)',
                                                            color: entry.type === 'POINTS' ? 'var(--accent)' : '#ff8c00'
                                                        }}>
                                                            {entry.type}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: entry.amount > 0 ? 'var(--green)' : 'red', fontWeight: 'bold' }}>
                                                        {entry.amount > 0 ? '+' : ''}{entry.amount}
                                                    </td>
                                                    <td className="text-muted">{entry.reason}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="text-center text-muted py-4">No ledger history found for this customer.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card">
                    <div className="table-container">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th>Customer Name</th>
                                    <th>Contact Info</th>
                                    <th>Loyalty Points</th>
                                    <th>Store Credit</th>
                                    <th>Date Added</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map(customer => (
                                    <tr key={customer.id}>
                                        <td style={{ fontWeight: 500 }}>{customer.name}</td>
                                        <td>
                                            <div>{customer.phone || '-'}</div>
                                            <div className="text-muted text-sm">{customer.email || ''}</div>
                                        </td>
                                        <td>{customer.loyaltyPoints}</td>
                                        <td style={{ color: 'var(--primary)', fontWeight: 600 }}>₱{customer.storeCredit.toFixed(2)}</td>
                                        <td>{new Date(customer.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    className="btn-icon"
                                                    style={{ color: 'var(--accent)' }}
                                                    onClick={async () => {
                                                        try {
                                                            const res = await axios.get(`/api/customers/${customer.id}`, {
                                                                headers: { Authorization: `Bearer ${token}` }
                                                            });
                                                            setCurrentCustomer(res.data);
                                                            setIsEditing(true);
                                                        } catch(e) {
                                                            Swal.fire('Error', 'Failed to load customer details', 'error');
                                                        }
                                                    }}
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    className="btn-icon"
                                                    style={{ color: '#ff4b4b' }}
                                                    onClick={() => handleDelete(customer.id)}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {customers.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-muted">No customers found. Click "Add Customer" to create one.</td>
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

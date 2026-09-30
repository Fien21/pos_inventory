import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Plus, Edit3, Trash2, CreditCard, Search, X, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PaymentMode {
    id: number;
    name: string;
    description: string;
    isActive: boolean;
    createdAt: string;
}

export default function PaymentModes() {
    const [modes, setModes] = useState<PaymentMode[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { user } = useAuth();

    // Modal / Drawer state
    const [isOpen, setIsOpen] = useState(false);
    const [editingMode, setEditingMode] = useState<PaymentMode | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [error, setError] = useState('');

    const fetchModes = async () => {
        try {
            const res = await axios.get('/api/payment-modes');
            setModes(res.data);
        } catch (err) {
            console.error('Failed to fetch payment modes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchModes();
    }, []);

    const openCreateModal = () => {
        setEditingMode(null);
        setName('');
        setDescription('');
        setIsActive(true);
        setError('');
        setIsOpen(true);
    };

    const openEditModal = (mode: PaymentMode) => {
        setEditingMode(mode);
        setName(mode.name);
        setDescription(mode.description);
        setIsActive(mode.isActive);
        setError('');
        setIsOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('Name is required.');
            return;
        }

        try {
            if (editingMode) {
                // Update
                await axios.put(`/api/payment-modes/${editingMode.id}`, {
                    name,
                    description,
                    isActive,
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Updated!',
                    text: 'Payment mode updated successfully.',
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#eee',
                });
            } else {
                // Create
                await axios.post('/api/payment-modes', {
                    name,
                    description,
                    isActive,
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Created!',
                    text: 'Payment mode created successfully.',
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#eee',
                });
            }
            setIsOpen(false);
            fetchModes();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to save payment mode.');
        }
    };

    const handleDelete = async (mode: PaymentMode) => {
        const result = await Swal.fire({
            title: 'Delete Payment Mode?',
            text: `Are you sure you want to delete "${mode.name}"? Transactions using this payment mode will preserve the name string but lose the ID relation.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff6b6b',
            cancelButtonColor: '#555',
            confirmButtonText: 'Yes, delete it',
            background: '#1a1a2e',
            color: '#eee',
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`/api/payment-modes/${mode.id}`);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Payment mode has been deleted.',
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#eee',
                });
                fetchModes();
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.response?.data?.error || 'Failed to delete payment mode.',
                    background: '#1a1a2e',
                    color: '#eee',
                });
            }
        }
    };

    const filteredModes = modes.filter((m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isAuthorized = user?.role === 'ADMIN' || user?.role === 'STAFF';

    return (
        <div className="container" style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.8rem', fontWeight: 600 }}>
                        <CreditCard size={28} style={{ color: 'var(--primary)' }} />
                        Payment Modes
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Manage modes of payment available at your Point of Sale checkout.
                    </p>
                </div>
                {isAuthorized && (
                    <motion.button
                        className="btn btn-primary"
                        onClick={openCreateModal}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Plus size={18} /> Add Payment Mode
                    </motion.button>
                )}
            </div>

            {/* Toolbar */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div className="search-box" style={{ flex: 1, maxWidth: '400px' }}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search payment modes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ background: 'transparent', border: 'none', width: '100%', color: '#fff', outline: 'none' }}
                    />
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <div className="spinner" />
                </div>
            ) : filteredModes.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <CreditCard size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <p>No payment modes found.</p>
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th>Created At</th>
                                {isAuthorized && <th style={{ textAlign: 'right' }}>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredModes.map((mode) => (
                                <tr key={mode.id}>
                                    <td>
                                        <strong>{mode.name}</strong>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)' }}>{mode.description || '-'}</td>
                                    <td>
                                        <span className={`badge ${mode.isActive ? 'badge-success' : 'badge-danger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            {mode.isActive ? <Check size={12} /> : <X size={12} />}
                                            {mode.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)' }}>
                                        {new Date(mode.createdAt).toLocaleDateString()}
                                    </td>
                                    {isAuthorized && (
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn btn-icon btn-ghost"
                                                    onClick={() => openEditModal(mode)}
                                                    title="Edit"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    className="btn btn-icon btn-ghost text-danger"
                                                    onClick={() => handleDelete(mode)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal Overlay / Form Drawer */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: '100vw',
                                height: '100vh',
                                background: '#000',
                                zIndex: 1000,
                            }}
                        />

                        {/* Modal Container */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            style={{
                                position: 'fixed',
                                top: '15%',
                                left: 'calc(50% - 225px)',
                                width: '450px',
                                background: '#1a1a2e',
                                border: '1px solid #333',
                                borderRadius: '12px',
                                padding: '24px',
                                zIndex: 1001,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                color: '#eee',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                                    {editingMode ? 'Edit Payment Mode' : 'Add Payment Mode'}
                                </h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {error && (
                                <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid var(--red)', borderRadius: '6px', color: 'var(--red)', fontSize: '0.85rem' }}>
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Name *</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Cash, GCash, Card"
                                        required
                                        style={{ width: '100%', padding: '10px', background: '#16213e', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Enter details..."
                                        rows={3}
                                        style={{ width: '100%', padding: '10px', background: '#16213e', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontFamily: 'inherit' }}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="checkbox"
                                        id="active-toggle"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    <label htmlFor="active-toggle" style={{ fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none' }}>
                                        Active (Available at POS checkout)
                                    </label>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        {editingMode ? 'Update' : 'Create'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

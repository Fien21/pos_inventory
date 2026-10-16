import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { ClipboardList, History, ShieldAlert, Plus, CheckCircle, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Audits() {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<'system' | 'purchases' | 'inventory'>('system');
    
    // System Logs
    const [systemLogs, setSystemLogs] = useState<any[]>([]);
    
    // Inventory Audits
    const [inventoryAudits, setInventoryAudits] = useState<any[]>([]);
    
    // New Audit Form
    const [isCreatingAudit, setIsCreatingAudit] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [auditItems, setAuditItems] = useState<{productId: number, actualQty: number, notes: string}[]>([]);
    const [auditNotes, setAuditNotes] = useState('');

    useEffect(() => {
        if (activeTab === 'system') {
            fetchSystemLogs();
        } else if (activeTab === 'purchases') {
            fetchSystemLogs();
            fetchProducts();
        } else {
            fetchInventoryAudits();
            fetchProducts(); // needed for creating new audits
        }
    }, [activeTab]);

    const fetchSystemLogs = async () => {
        try {
            const res = await axios.get('/api/audit-logs', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSystemLogs(res.data);
        } catch (error) {
            console.error('Failed to fetch system logs', error);
        }
    };

    const fetchInventoryAudits = async () => {
        try {
            const res = await axios.get('/api/inventory-audits', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInventoryAudits(res.data);
        } catch (error) {
            console.error('Failed to fetch inventory audits', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get('/api/products', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProducts(res.data);
        } catch (error) {
            console.error('Failed to fetch products', error);
        }
    };

    const handleCreateAudit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/api/inventory-audits', {
                notes: auditNotes,
                items: auditItems.filter(i => i.productId)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Swal.fire('Success', 'Inventory audit session created', 'success');
            setIsCreatingAudit(false);
            setAuditItems([]);
            setAuditNotes('');
            fetchInventoryAudits();
        } catch (error) {
            Swal.fire('Error', 'Failed to create audit', 'error');
        }
    };

    const completeAudit = async (id: number) => {
        const { isConfirmed } = await Swal.fire({
            title: 'Complete Audit?',
            text: 'This will update actual stock quantities based on the audit variances.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, complete it'
        });

        if (isConfirmed) {
            try {
                await axios.post(`/api/inventory-audits/${id}/complete`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Swal.fire('Completed', 'Audit completed and stock updated', 'success');
                fetchInventoryAudits();
            } catch (error) {
                Swal.fire('Error', 'Failed to complete audit', 'error');
            }
        }
    };

    const renderSystemLogs = () => (
        <div className="card">
            <h2 className="card-header"><History className="icon" /> System Activity Logs</h2>
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>User</th>
                            <th>Action</th>
                            <th>Entity</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {systemLogs.map(log => (
                            <tr key={log.id}>
                                <td>{new Date(log.createdAt).toLocaleString()}</td>
                                <td>{log.user?.name || 'System'}</td>
                                <td><span className={`badge badge-${log.action.toLowerCase()}`}>{log.action}</span></td>
                                <td>
                                    {log.entity === 'User' ? (
                                        <span>User Account</span>
                                    ) : (
                                        <span>{log.entity} {log.entityId && `#${log.entityId}`}</span>
                                    )}
                                </td>
                                <td>
                                    {(() => {
                                        if (!log.details) return <span className="text-muted">-</span>;
                                        try {
                                            const parsed = JSON.parse(log.details);
                                            return (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {Object.entries(parsed).map(([key, value]) => (
                                                        <div key={key} style={{ 
                                                            background: 'var(--bg-primary)', 
                                                            padding: '4px 10px', 
                                                            borderRadius: '16px', 
                                                            fontSize: '0.75rem', 
                                                            border: '1px solid var(--border)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}>
                                                            <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                                            </span>
                                                            <strong style={{ color: 'var(--text-primary)' }}>
                                                                {typeof value === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('profit')) 
                                                                    ? `$${value.toFixed(2)}` 
                                                                    : String(value)}
                                                            </strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        } catch {
                                            return <span className="text-muted text-sm">{log.details}</span>;
                                        }
                                    })()}
                                </td>
                            </tr>
                        ))}
                        {systemLogs.length === 0 && (
                            <tr><td colSpan={5} className="text-center py-4">No audit logs found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderStockPurchases = () => {
        const purchaseLogs = systemLogs.filter(log => log.action === 'STOCK_PURCHASE');
        return (
            <div className="card">
                <h2 className="card-header"><Package className="icon" /> Stock Purchase Logs</h2>
                <div className="table-container">
                    <table className="table w-full">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>User</th>
                                <th>Product</th>
                                <th>Quantity Added</th>
                                <th>Supplier Info</th>
                                <th>Reference No.</th>
                                <th>Invoice No.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchaseLogs.map(log => {
                                let details: any = {};
                                try { details = JSON.parse(log.details || '{}'); } catch(e){}
                                const product = products.find(p => p.id === log.entityId);
                                return (
                                    <tr key={log.id}>
                                        <td>{new Date(log.createdAt).toLocaleString()}</td>
                                        <td>{log.user?.name || 'System'}</td>
                                        <td style={{ fontWeight: 500 }}>{product ? product.name : `Product #${log.entityId}`}</td>
                                        <td><span className="badge badge-success" style={{ fontSize: '0.9rem' }}>+{details.addedQty || 0}</span></td>
                                        <td className="text-muted">{details.supplierInfo || '-'}</td>
                                        <td className="text-muted" style={{ fontFamily: 'monospace' }}>{details.referenceNo || '-'}</td>
                                        <td className="text-muted">{details.invoiceNo || '-'}</td>
                                    </tr>
                                )
                            })}
                            {purchaseLogs.length === 0 && (
                                <tr><td colSpan={5} className="text-center py-8 text-muted">No stock purchase logs found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderInventoryAudits = () => (
        <div>
            {isCreatingAudit ? (
                <div className="card mb-4">
                    <h2 className="card-header">New Stock Audit</h2>
                    <form onSubmit={handleCreateAudit} className="p-4 space-y-4">
                        <div className="form-group">
                            <label>Audit Notes</label>
                            <input 
                                type="text" 
                                className="input" 
                                value={auditNotes}
                                onChange={e => setAuditNotes(e.target.value)}
                                placeholder="E.g., Monthly check for electronics"
                            />
                        </div>
                        
                        <div className="border border-base-content/20 rounded p-4 mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3>Audit Items</h3>
                                <button 
                                    type="button" 
                                    className="btn btn-sm"
                                    onClick={() => setAuditItems([...auditItems, {productId: 0, actualQty: 0, notes: ''}])}
                                >
                                    <Plus className="icon-sm" /> Add Item
                                </button>
                            </div>
                            
                            {auditItems.map((item, idx) => (
                                <div key={idx} className="flex gap-4 mb-2">
                                    <select 
                                        className="input flex-1"
                                        value={item.productId}
                                        onChange={e => {
                                            const newItems = [...auditItems];
                                            newItems[idx].productId = parseInt(e.target.value);
                                            setAuditItems(newItems);
                                        }}
                                        required
                                    >
                                        <option value={0}>Select Product</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} (Sys Qty: {p.stockQty})</option>
                                        ))}
                                    </select>
                                    <input 
                                        type="number" 
                                        className="input w-24" 
                                        placeholder="Actual Qty"
                                        value={item.actualQty}
                                        onChange={e => {
                                            const newItems = [...auditItems];
                                            newItems[idx].actualQty = parseInt(e.target.value) || 0;
                                            setAuditItems(newItems);
                                        }}
                                        required
                                    />
                                    <button 
                                        type="button"
                                        className="btn btn-sm btn-error"
                                        onClick={() => {
                                            const newItems = [...auditItems];
                                            newItems.splice(idx, 1);
                                            setAuditItems(newItems);
                                        }}
                                    >
                                        X
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button type="submit" className="btn btn-primary" disabled={auditItems.length === 0}>Save Audit</button>
                            <button type="button" className="btn" onClick={() => setIsCreatingAudit(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="flex justify-between items-center mb-4">
                    <h2>Stock Audits</h2>
                    <button className="btn btn-primary" onClick={() => setIsCreatingAudit(true)}>
                        <Plus className="icon" /> New Audit
                    </button>
                </div>
            )}

            <div className="grid gap-4">
                {inventoryAudits.map(audit => (
                    <div key={audit.id} className="card p-4">
                        <div className="flex justify-between items-center mb-4 border-b border-base-content/10 pb-2">
                            <div>
                                <h3 className="font-bold flex items-center gap-2">
                                    Audit #{audit.id} 
                                    <span className={`badge ${audit.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                                        {audit.status}
                                    </span>
                                </h3>
                                <p className="text-sm text-muted">By {audit.auditor?.name} on {new Date(audit.createdAt).toLocaleDateString()}</p>
                                {audit.notes && <p className="text-sm">Notes: {audit.notes}</p>}
                            </div>
                            {audit.status === 'PENDING' && (
                                <button className="btn btn-success" onClick={() => completeAudit(audit.id)}>
                                    <CheckCircle className="icon" /> Complete
                                </button>
                            )}
                        </div>
                        
                        <div className="table-container">
                            <table className="table w-full text-sm">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Expected</th>
                                        <th>Actual</th>
                                        <th>Variance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {audit.items?.map((item: any) => (
                                        <tr key={item.id}>
                                            <td>{item.product?.name}</td>
                                            <td>{item.expectedQty}</td>
                                            <td>{item.actualQty}</td>
                                            <td className={item.variance < 0 ? 'text-error font-bold' : item.variance > 0 ? 'text-success font-bold' : ''}>
                                                {item.variance > 0 ? '+' : ''}{item.variance}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
                {inventoryAudits.length === 0 && !isCreatingAudit && (
                    <div className="text-center py-8 text-muted bg-base-100 rounded-lg">No stock audits found.</div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="flex items-center gap-2 flex items-center gap-2 text-[20px] font-bold text-slate-900 tracking-tight">
                        <ShieldAlert className="icon-lg" style={{ color: 'var(--primary)' }} /> Audit & Logs
                    </h1>
                    <p className="text-[11px] text-slate-500 font-medium">System activity and physical stock tracking</p>
                </div>
            </header>
            <main className="flex-1 p-5 overflow-y-auto w-full">

            <div className="tabs mb-6 flex gap-4">
                <button 
                    className={`btn ${activeTab === 'system' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('system')}
                >
                    <History className="icon" /> System Logs
                </button>
                <button 
                    className={`btn ${activeTab === 'purchases' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('purchases')}
                >
                    <Package className="icon" /> Stock Purchases
                </button>
                <button 
                    className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('inventory')}
                >
                    <ClipboardList className="icon" /> Stock Audits
                </button>
            </div>

            {activeTab === 'system' ? renderSystemLogs() : activeTab === 'purchases' ? renderStockPurchases() : renderInventoryAudits()}
        </main>
        </div>
    );
}

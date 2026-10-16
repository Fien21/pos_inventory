import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';
import { Search, Package, Plus, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    costPrice: number;
    retailPrice: number;
    barcode: string;
    imageUrl: string | null;
    stockQty: number;
    stockItems?: any[];
}

export default function StockPurchase() {
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const { token } = useAuth();
    const [addQty, setAddQty] = useState<number | ''>('');
    const [isSerialized, setIsSerialized] = useState(false);
    const [newSerialNumbers, setNewSerialNumbers] = useState('');
    const [supplierInfo, setSupplierInfo] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProducts = async () => {
            if (!search.trim()) {
                setSearchResults([]);
                return;
            }
            try {
                const res = await axios.get('/api/products/search', { params: { q: search } });
                setSearchResults(res.data);
            } catch (err) {
                console.error(err);
            }
        };

        const timer = setTimeout(fetchProducts, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const res = await axios.get('/api/suppliers', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSuppliers(res.data.filter((s: any) => s.isActive));
            } catch (err) {
                console.error(err);
            }
        };
        if (token) fetchSuppliers();
    }, [token]);

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setSearch('');
        setSearchResults([]);
        setAddQty('');
        setIsSerialized(product.stockItems && product.stockItems.length > 0 ? true : false);
        setNewSerialNumbers('');
        setSupplierInfo('');
        setReferenceNo(`REF-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`);
        setInvoiceNo('');
    };

    const handleAddStock = async () => {
        if (!selectedProduct) return;
        const parsedSns = newSerialNumbers.split('\n').map(l => l.trim()).filter(Boolean);
        const qtyNum = typeof addQty === 'number' ? addQty : 0;
        const effectiveAddQty = isSerialized ? parsedSns.length : qtyNum;

        if (effectiveAddQty <= 0) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid Quantity',
                text: isSerialized ? 'Please enter at least one serial number.' : 'Quantity must be at least 1.',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
            });
            return;
        }

        setLoading(true);
        try {
            const newTotalQty = selectedProduct.stockQty + effectiveAddQty;
            
            let updatedSerialNumbers: string[] | undefined;
            if (isSerialized) {
                const existingAvailable = (selectedProduct.stockItems || [])
                    .filter((s: any) => s.status === 'AVAILABLE')
                    .map((s: any) => s.serialNumber);
                updatedSerialNumbers = [...existingAvailable, ...parsedSns];
            }

            await axios.put(`/api/products/${selectedProduct.id}`, {
                stockQty: newTotalQty,
                serialNumbers: updatedSerialNumbers,
                supplierInfo: supplierInfo,
                referenceNo: referenceNo,
                invoiceNo: invoiceNo,
                isStockPurchase: true,
                addedQty: effectiveAddQty
            });

            Swal.fire({
                icon: 'success',
                title: 'Stock Added',
                text: `Successfully added ${effectiveAddQty} to ${selectedProduct.name}. New total: ${newTotalQty}`,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
            });

            setSelectedProduct({
                ...selectedProduct,
                stockQty: newTotalQty,
                stockItems: updatedSerialNumbers ? updatedSerialNumbers.map(sn => ({ serialNumber: sn, status: 'AVAILABLE' })) : selectedProduct.stockItems
            });
            setAddQty('');
            setNewSerialNumbers('');
            setSupplierInfo('');
            setReferenceNo(`REF-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`);
            setInvoiceNo('');
        } catch (err: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.response?.data?.error || 'Failed to add stock',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="btn-icon" onClick={() => navigate('/inventory')}>
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Stock Purchase</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Search products in inventory to receive stock</p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-5 overflow-y-auto w-full">

            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div className="search-box" style={{ marginBottom: '20px', position: 'relative' }}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search product by name or barcode..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: '100%' }}
                    />
                    {searchResults.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            zIndex: 10,
                            maxHeight: '300px',
                            overflowY: 'auto',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                            marginTop: '8px'
                        }}>
                            {searchResults.map((product) => (
                                <div
                                    key={product.id}
                                    onClick={() => handleSelectProduct(product)}
                                    style={{
                                        padding: '12px',
                                        borderBottom: '1px solid var(--border)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}
                                >
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                    ) : (
                                        <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', borderRadius: '4px' }}>
                                            <Package size={20} />
                                        </div>
                                    )}
                                    <div>
                                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{product.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{product.barcode}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedProduct ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="product-detail-grid"
                        style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}
                    >
                        <div className="product-detail-image-section">
                            {selectedProduct.imageUrl ? (
                                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="product-detail-image" />
                            ) : (
                                <div className="product-detail-image-placeholder">
                                    <Package size={48} />
                                </div>
                            )}
                        </div>
                        <div className="product-detail-info-section">
                            <div className="product-detail-header">
                                <h2>{selectedProduct.name}</h2>
                                <span className="product-detail-category-badge" style={{ fontFamily: 'monospace' }}>{selectedProduct.barcode}</span>
                            </div>
                            
                            <div className="product-detail-description" style={{ marginBottom: '16px' }}>
                                <h3>Description</h3>
                                <p>{selectedProduct.description || 'No description provided.'}</p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                                <div>
                                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Current Stock</h3>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{selectedProduct.stockQty}</div>
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>Add Stock</h3>
                                
                                <div className="form-group">
                                    <label>Supplier (Optional)</label>
                                    <select
                                        className="input"
                                        value={supplierInfo}
                                        onChange={(e) => setSupplierInfo(e.target.value)}
                                        style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px' }}
                                    >
                                        <option value="">-- Select a Supplier --</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.name}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label>Reference No.</label>
                                        <input
                                            type="text"
                                            value={referenceNo}
                                            readOnly
                                            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                                        />
                                    </div>

                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label>Invoice No. (Optional)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. INV-1002"
                                            value={invoiceNo}
                                            onChange={(e) => setInvoiceNo(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="checkbox"
                                        id="serialize-check"
                                        checked={isSerialized}
                                        onChange={(e) => setIsSerialized(e.target.checked)}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer', margin: 0 }}
                                    />
                                    <label htmlFor="serialize-check" style={{ cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                                        Product uses Serial Numbers
                                    </label>
                                </div>

                                {isSerialized ? (
                                    <div className="form-group">
                                        <label>Scan or type new Serial Numbers (One per line)</label>
                                        <textarea
                                            value={newSerialNumbers}
                                            onChange={(e) => setNewSerialNumbers(e.target.value)}
                                            placeholder="SN-123&#10;SN-124"
                                            rows={5}
                                            style={{ fontFamily: 'monospace' }}
                                        />
                                        <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)' }}>
                                            Total to add: <strong>{newSerialNumbers.split('\n').map(l => l.trim()).filter(Boolean).length}</strong>
                                        </small>
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label>Quantity to Add</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={addQty}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setAddQty(val === '' ? '' : parseInt(val));
                                            }}
                                        />
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                    <button 
                                        className="btn btn-primary"
                                        onClick={handleAddStock}
                                        disabled={loading}
                                        style={{ flex: 1 }}
                                    >
                                        <Plus size={18} />
                                        {loading ? 'Adding...' : 'Confirm Stock Purchase'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        <Package size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                        <p>Search and select a product to begin receiving stock.</p>
                    </div>
                )}
            </div>
        </main>
        </div>
    );
}

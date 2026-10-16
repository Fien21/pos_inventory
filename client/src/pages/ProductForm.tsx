import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Save, ArrowLeft, Upload, Package, Search } from 'lucide-react';

interface Category {
    id: number;
    name: string;
}

export default function ProductForm() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [costPrice, setCostPrice] = useState('');
    const [retailPrice, setRetailPrice] = useState('');
    const [taxRate, setTaxRate] = useState('');
    const [taxInclusive, setTaxInclusive] = useState(false);
    const [stockQty, setStockQty] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [barcode, setBarcode] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [serialNumbers, setSerialNumbers] = useState('');
    const [autoGenerateSn, setAutoGenerateSn] = useState(true);
    const [isBundle, setIsBundle] = useState(false);
    const [bundleItems, setBundleItems] = useState<{productId: string; quantity: string; product: any; productName?: string}[]>([]);
    const [allProducts, setAllProducts] = useState<any[]>([]);

    const snCount = serialNumbers.split('\n').map(l => l.trim()).filter(Boolean).length;

    useEffect(() => {
        axios.get('/api/categories')
            .then((r) => setCategories(r.data))
            .catch((err) => console.error("Failed to fetch categories:", err));

        axios.get('/api/products')
            .then((r) => {
                if (id) {
                    setAllProducts(r.data.filter((p: any) => p.id !== Number(id)));
                } else {
                    setAllProducts(r.data);
                }
            })
            .catch((err) => console.error("Failed to fetch products:", err));

        if (isEdit) {
            axios.get(`/api/products/${id}`).then((r) => {
                const p = r.data;
                setName(p.name);
                setDescription(p.description);
                setPrice(String(p.price));
                setCostPrice(String(p.costPrice || ''));
                setRetailPrice(String(p.retailPrice || ''));
                setTaxRate(String(p.taxRate || ''));
                setTaxInclusive(Boolean(p.taxInclusive));
                setStockQty(String(p.stockQty));
                setCategoryId(String(p.categoryId));
                setBarcode(p.barcode);
                setIsBundle(Boolean(p.isBundle));
                if (p.bundleItems && p.bundleItems.length > 0) {
                    setBundleItems(p.bundleItems.map((bi: any) => ({
                        productId: String(bi.productId),
                        quantity: String(bi.quantity),
                        product: bi.product,
                        productName: bi.product ? `${bi.product.name} (${bi.product.barcode || 'No barcode'})` : ''
                    })));
                }
                if (p.imageUrl) setImagePreview(p.imageUrl);

                if (p.stockItems && p.stockItems.length > 0) {
                    const availableSns = p.stockItems
                        .filter((s: any) => s.status === 'AVAILABLE')
                        .map((s: any) => s.serialNumber)
                        .join('\n');
                    setSerialNumbers(availableSns);
                    setAutoGenerateSn(true);
                } else {
                    setAutoGenerateSn(false);
                }
            });
        }
    }, [id]);

    useEffect(() => {
        if (!name || name.length < 3 || !showSuggestions) {
            setSuggestions([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await axios.get(`/api/products/search-off?q=${encodeURIComponent(name)}`);
                if (response.data && response.data.products) {
                    setSuggestions(response.data.products);
                }
            } catch (err) {
                console.error('Failed to fetch suggestions', err);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [name, showSuggestions]);

    const handleSelectSuggestion = async (p: any) => {
        setShowSuggestions(false);
        if (p.product_name) setName(p.product_name.toUpperCase());
        if (p.code) setBarcode(p.code);
        
        const descParts = [];
        if (p.brands) descParts.push(`Brand: ${p.brands}`);
        if (p.categories) descParts.push(`Categories: ${p.categories}`);
        if (descParts.length > 0) {
            setDescription(descParts.join('\n'));
        }
        
        if (p.image_front_url) {
            setImagePreview(p.image_front_url);
            try {
                const imgRes = await fetch(p.image_front_url);
                const blob = await imgRes.blob();
                const file = new File([blob], 'product_image.jpg', { type: blob.type });
                setImage(file);
                setRemoveImage(false);
            } catch (err) {
                console.error('Failed to download image', err);
            }
        }
    };

    const handleLookup = async (isAuto = false) => {
        if (!barcode) {
            if (!isAuto) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Barcode Required',
                    text: 'Please enter a barcode to look up.',
                    background: '#1a1a2e',
                    color: '#eee',
                    confirmButtonColor: '#6c63ff',
                });
            }
            return;
        }

        setLookupLoading(true);
        try {
            const response = await axios.get(`/api/products/lookup/${barcode}`);
            const data = response.data;

            if (data.status === 1 && data.product) {
                const p = data.product;
                if (p.product_name) setName(p.product_name.toUpperCase());
                
                const descParts = [];
                if (p.brands) descParts.push(`Brand: ${p.brands}`);
                if (p.categories) descParts.push(`Categories: ${p.categories}`);
                if (descParts.length > 0) {
                    setDescription(descParts.join('\n'));
                }
                
                if (p.image_front_url) {
                    setImagePreview(p.image_front_url);
                    try {
                        const imgRes = await fetch(p.image_front_url);
                        const blob = await imgRes.blob();
                        const file = new File([blob], 'product_image.jpg', { type: blob.type });
                        setImage(file);
                        setRemoveImage(false);
                    } catch (err) {
                        console.error('Failed to download image', err);
                    }
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Product Found!',
                    text: `Loaded details for ${p.product_name || 'the product'}`,
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#eee',
                });
            } else {
                if (!isAuto) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Not Found',
                        text: 'Product not found in Open Food Facts database.',
                        background: '#1a1a2e',
                        color: '#eee',
                        confirmButtonColor: '#6c63ff',
                    });
                }
            }
        } catch (err) {
            if (!isAuto) {
                Swal.fire({
                    icon: 'error',
                    title: 'Lookup Failed',
                    text: 'Could not connect to the database or an error occurred.',
                    background: '#1a1a2e',
                    color: '#eee',
                    confirmButtonColor: '#6c63ff',
                });
            }
        } finally {
            setLookupLoading(false);
        }
    };

    // Auto-lookup barcode with debounce
    useEffect(() => {
        if (!barcode || barcode.length < 5 || isEdit) return;
        const timer = setTimeout(() => {
            handleLookup(true);
        }, 800);
        return () => clearTimeout(timer);
    }, [barcode]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
            setRemoveImage(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('price', price || retailPrice || '0');
        formData.append('costPrice', costPrice || '0');
        formData.append('retailPrice', retailPrice || '0');
        formData.append('taxRate', taxRate || '0');
        formData.append('taxInclusive', String(taxInclusive));
        const snCount = serialNumbers.split('\n').map(l => l.trim()).filter(Boolean).length;
        formData.append('stockQty', snCount > 0 ? String(snCount) : (stockQty || '0'));
        formData.append('categoryId', categoryId);
        formData.append('serialNumbers', serialNumbers);
        formData.append('autoGenerateSn', String(autoGenerateSn));
        formData.append('isBundle', String(isBundle));
        if (isBundle && bundleItems.length > 0) {
            formData.append('bundleItems', JSON.stringify(bundleItems));
        }
        if (barcode) formData.append('barcode', barcode);
        if (image) {
            formData.append('image', image);
        } else if (removeImage) {
            formData.append('removeImage', 'true');
        }

        try {
            if (isEdit) {
                await axios.put(`/api/products/${id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await axios.post('/api/products', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }

            await Swal.fire({
                icon: 'success',
                title: isEdit ? 'Updated!' : 'Created!',
                text: `Product ${isEdit ? 'updated' : 'created'} successfully`,
                timer: 1500,
                showConfirmButton: false,
                background: '#1a1a2e',
                color: '#eee',
            });

            navigate('/inventory');
        } catch (err: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.response?.data?.error || 'Something went wrong',
                background: '#1a1a2e',
                color: '#eee',
                confirmButtonColor: '#6c63ff',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <button className="btn btn-ghost" onClick={() => navigate('/inventory')}>
                        <ArrowLeft size={18} /> Back
                    </button>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">{isEdit ? 'Edit Product' : 'New Product'}</h1>
                </div>
            </header>
            <main className="flex-1 p-5 overflow-y-auto w-full">

            <motion.div
                className="card form-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <form onSubmit={handleSubmit} className="product-form">
                    <div className="form-grid">
                        <div className="form-left">
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label>Product Name *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value.toUpperCase());
                                        setShowSuggestions(true);
                                    }}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    required
                                    placeholder="e.g. Wireless Headphones"
                                    autoComplete="off"
                                />
                                {showSuggestions && (name.length >= 3) && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        backgroundColor: '#1a1a2e',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        marginTop: '4px',
                                        zIndex: 10,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                        maxHeight: '200px',
                                        overflowY: 'auto'
                                    }}>
                                        {isSearching ? (
                                            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>Searching...</div>
                                        ) : suggestions.length > 0 ? (
                                            suggestions.map((p: any) => (
                                                <div
                                                    key={p.code}
                                                    onMouseDown={() => handleSelectSuggestion(p)}
                                                    style={{
                                                        padding: '10px 12px',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                                        display: 'flex',
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        gap: '12px'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <div style={{ width: '40px', height: '40px', flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                        {p.image_front_url ? (
                                                            <img src={p.image_front_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <Package size={20} color="var(--text-muted)" />
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                        <span style={{ fontWeight: 500, color: '#fff' }}>{p.product_name || 'Unknown Product'}</span>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                            {p.brands ? `Brand: ${p.brands}` : 'No brand'} | Barcode: {p.code}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>No products found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={3} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Cost Price (Before Tax) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={costPrice}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setCostPrice(val);
                                            const c = parseFloat(val);
                                            const t = parseFloat(taxRate);
                                            if (!isNaN(c)) {
                                                let r = c;
                                                if (!isNaN(t) && t > 0) {
                                                    r = c * (1 + t / 100);
                                                }
                                                if (taxInclusive) {
                                                    r = r * 1.12;
                                                }
                                                setRetailPrice(r.toFixed(2));
                                            }
                                        }}
                                        required
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Markup Margin (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={taxRate}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setTaxRate(val);
                                            const c = parseFloat(costPrice);
                                            const t = parseFloat(val);
                                            if (!isNaN(c)) {
                                                let r = c;
                                                if (!isNaN(t) && t > 0) {
                                                    r = c * (1 + t / 100);
                                                }
                                                if (taxInclusive) {
                                                    r = r * 1.12;
                                                }
                                                setRetailPrice(r.toFixed(2));
                                            }
                                        }}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Retail Price (Selling Price) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={retailPrice}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setRetailPrice(val);
                                            const r = parseFloat(val);
                                            const c = parseFloat(costPrice);
                                            if (!isNaN(r) && !isNaN(c) && c > 0) {
                                                let base = taxInclusive ? r / 1.12 : r;
                                                const margin = ((base / c) - 1) * 100;
                                                setTaxRate(margin.toFixed(2));
                                            } else if (!isNaN(r) && (isNaN(c) || c === 0)) {
                                                // If no cost price, we can't calculate margin, just clear it or leave it
                                            }
                                        }}
                                        required
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '28px' }}>
                                    <input
                                        id="tax-inclusive"
                                        type="checkbox"
                                        checked={taxInclusive}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setTaxInclusive(checked);
                                            const c = parseFloat(costPrice);
                                            const t = parseFloat(taxRate);
                                            if (!isNaN(c)) {
                                                let r = c;
                                                if (!isNaN(t) && t > 0) {
                                                    r = c * (1 + t / 100);
                                                }
                                                if (checked) {
                                                    r = r * 1.12;
                                                }
                                                setRetailPrice(r.toFixed(2));
                                            }
                                        }}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    <label htmlFor="tax-inclusive" style={{ cursor: 'pointer', margin: 0, fontWeight: 500 }}>Tax Inclusive</label>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Stock Qty</label>
                                    <input
                                        type="number"
                                        value={snCount > 0 ? snCount : stockQty}
                                        onChange={(e) => setStockQty(e.target.value)}
                                        placeholder="0"
                                        disabled={snCount > 0}
                                        style={snCount > 0 ? { backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed', opacity: 0.8 } : {}}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Category *</label>
                                    <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                                        <option value="">Select category</option>
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    id="is-bundle"
                                    type="checkbox"
                                    checked={isBundle}
                                    onChange={(e) => setIsBundle(e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="is-bundle" style={{ cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                                    This is a Bundle Product
                                </label>
                            </div>
                            
                            {isBundle && (
                                <div className="form-group" style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                                    <label style={{ color: 'var(--accent)' }}>Bundle Contents *</label>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                        Search and select the items that make up this bundle.
                                    </p>
                                    <datalist id="bundle-product-list">
                                        {allProducts.filter(p => !p.isBundle).map(p => (
                                            <option key={p.id} value={`${p.name} (${p.barcode || 'No barcode'})`} />
                                        ))}
                                    </datalist>
                                    {bundleItems.map((bi, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                            <input 
                                                type="text"
                                                list="bundle-product-list"
                                                value={bi.productName || ''} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const newBi = [...bundleItems];
                                                    newBi[idx].productName = val;
                                                    const selectedP = allProducts.find(p => `${p.name} (${p.barcode || 'No barcode'})` === val);
                                                    if (selectedP) {
                                                        newBi[idx].productId = String(selectedP.id);
                                                        newBi[idx].product = selectedP;
                                                    } else {
                                                        newBi[idx].productId = '';
                                                        newBi[idx].product = null;
                                                    }
                                                    setBundleItems(newBi);
                                                }} 
                                                style={{ flex: 1 }}
                                                placeholder="Search product..."
                                                required
                                            />
                                            <input 
                                                type="number" 
                                                value={bi.quantity} 
                                                onChange={(e) => {
                                                    const newBi = [...bundleItems];
                                                    newBi[idx].quantity = e.target.value;
                                                    setBundleItems(newBi);
                                                }} 
                                                style={{ width: '80px' }} 
                                                placeholder="Qty" 
                                                required 
                                                min="1"
                                            />
                                            <button type="button" className="btn btn-icon" onClick={() => {
                                                setBundleItems(bundleItems.filter((_, i) => i !== idx));
                                            }} style={{ color: '#ff4b4b', padding: '0 8px' }} title="Remove">
                                                ✖
                                            </button>
                                        </div>
                                    ))}
                                    <button type="button" className="btn btn-secondary" onClick={() => setBundleItems([...bundleItems, { productId: '', quantity: '1', product: null, productName: '' }])} style={{ marginTop: '8px', fontSize: '0.8rem', padding: '6px 12px' }}>
                                        + Add Bundle Item
                                    </button>
                                    {bundleItems.length > 0 && (
                                        <div style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>
                                                    Estimated Bundle Cost: <strong style={{ color: 'var(--green)' }}>₱{bundleItems.reduce((sum, bi) => {
                                                        const c = bi.product?.costPrice || 0;
                                                        return sum + (c * (parseInt(bi.quantity) || 1));
                                                    }, 0).toFixed(2)}</strong>
                                                </span>
                                                <button 
                                                    type="button" 
                                                    className="btn btn-secondary" 
                                                    style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                                                    onClick={() => {
                                                        const sum = bundleItems.reduce((s, bi) => {
                                                            const c = bi.product?.costPrice || 0;
                                                            return s + (c * (parseInt(bi.quantity) || 1));
                                                        }, 0);
                                                        setCostPrice(sum.toFixed(2));
                                                    }}
                                                >
                                                    Use as Cost Price
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>
                                                    Estimated Total Retail Price: <strong style={{ color: 'var(--accent)' }}>₱{bundleItems.reduce((sum, bi) => {
                                                        const r = bi.product?.retailPrice || bi.product?.price || 0;
                                                        return sum + (r * (parseInt(bi.quantity) || 1));
                                                    }, 0).toFixed(2)}</strong>
                                                </span>
                                                <button 
                                                    type="button" 
                                                    className="btn btn-secondary" 
                                                    style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                                                    onClick={() => {
                                                        const sum = bundleItems.reduce((s, bi) => {
                                                            const r = bi.product?.retailPrice || bi.product?.price || 0;
                                                            return s + (r * (parseInt(bi.quantity) || 1));
                                                        }, 0);
                                                        setRetailPrice(sum.toFixed(2));
                                                    }}
                                                >
                                                    Use as Retail Price
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="form-group" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    id="auto-gen-sn"
                                    type="checkbox"
                                    checked={autoGenerateSn}
                                    onChange={(e) => {
                                        setAutoGenerateSn(e.target.checked);
                                        if (!e.target.checked) setSerialNumbers('');
                                    }}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="auto-gen-sn" style={{ cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                                    Enable Serial Numbers
                                </label>
                            </div>
                            
                            {autoGenerateSn && (
                                <div className="form-group" style={{ marginTop: '8px' }}>
                                    <label>Serial Numbers (S/N) - Enter one S/N per line (Optional)</label>
                                    <textarea
                                        value={serialNumbers}
                                        onChange={(e) => setSerialNumbers(e.target.value)}
                                        placeholder="e.g.&#10;SN-849032890&#10;SN-849032891"
                                        rows={4}
                                        style={{ fontFamily: 'monospace' }}
                                    />
                                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                                        If you specify a higher stock quantity than the number of serial numbers listed, the system will auto-generate unique serial numbers for the remaining items.
                                    </small>
                                </div>
                            )}
                                <div className="form-group">
                                    <label>Barcode {!isEdit && '(auto-generated if empty)'}</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            value={barcode}
                                            onChange={(e) => setBarcode(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleLookup(false);
                                                }
                                            }}
                                            placeholder="Leave blank to auto-generate"
                                            disabled={isEdit}
                                            style={{ flex: 1 }}
                                        />
                                        {!isEdit && (
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => setBarcode(Math.floor(100000000000 + Math.random() * 900000000000).toString())}
                                                style={{ padding: '0 12px', fontSize: '0.85rem' }}
                                            >
                                                Generate
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={() => handleLookup(false)}
                                            disabled={lookupLoading || !barcode}
                                            style={{ padding: '0 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            {lookupLoading ? <div className="spinner-small" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <Search size={14} />}
                                            Lookup
                                        </button>
                                    </div>
                                </div>
                            </div>

                        <div className="form-right">
                            <div className="form-group">
                                <label>Product Image (Optional)</label>
                                <div className="image-upload-area" onClick={() => document.getElementById('image-input')?.click()}>
                                    {imagePreview ? (
                                        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '220px' }}>
                                            <img src={imagePreview} alt="Preview" className="image-preview" style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
                                            <button
                                                type="button"
                                                className="btn btn-delete"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setImage(null);
                                                    setImagePreview(null);
                                                    setRemoveImage(true);
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '8px',
                                                    right: '8px',
                                                    background: 'rgba(255, 107, 107, 0.95)',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '6px 12px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--red)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 107, 107, 0.95)'}
                                            >
                                                Remove Image
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="image-placeholder">
                                            <Upload size={32} />
                                            <p>Click to upload image</p>
                                            <span>JPG, PNG, WebP up to 5MB</span>
                                        </div>
                                    )}
                                    <input id="image-input" type="file" accept="image/*" onChange={handleImageChange} hidden />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => navigate('/inventory')}>Cancel</button>
                        <motion.button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {loading ? <div className="spinner-small" /> : <><Save size={18} /> {isEdit ? 'Update Product' : 'Create Product'}</>}
                        </motion.button>
                    </div>
                </form>
            </motion.div>
        </main>
        </div>
    );
}

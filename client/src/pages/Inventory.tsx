import { useState, useEffect, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Swal from 'sweetalert2';
import JsBarcode from 'jsbarcode';
import {
    Plus,
    Search,
    Edit3,
    Trash2,
    Package,
    AlertTriangle,
    Barcode,
    Filter,
    Upload,
    Download,
    Printer,
    Eye,
    ArrowUpDown,
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    X
} from 'lucide-react';

interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    costPrice: number;
    retailPrice: number;
    taxRate: number;
    taxInclusive: boolean;
    barcode: string;
    imageUrl: string | null;
    stockQty: number;
    categoryId: number;
    category: { id: number; name: string };
    stockItems?: Array<{ id: number; serialNumber: string; status: string; createdAt: string }>;
    createdAt: string;
}

interface Category {
    id: number;
    name: string;
}

export default function Inventory() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Pagination, Sorting, and Viewing State
    const [currentPage, setCurrentPage] = useState(1);
    const [sortBy, setSortBy] = useState<string>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
    const [viewingProductBarcodeUrl, setViewingProductBarcodeUrl] = useState<string | null>(null);
    const [activeStockTab, setActiveStockTab] = useState<'AVAILABLE' | 'SOLD'>('AVAILABLE');

    // Draggable Column Reordering State & Handlers
    const [columnOrder, setColumnOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('inventoryColumnOrder');
        return saved ? JSON.parse(saved) : [
            'image',
            'barcode',
            'name',
            'category',
            'costPrice',
            'retailPrice',
            'stockQty'
        ];
    });

    const handleDragStart = (e: any, index: number) => {
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', String(index));
        }
    };

    const handleDragOver = (e: any) => {
        e.preventDefault();
    };

    const handleDrop = (e: any, dropIndex: number) => {
        if (e.dataTransfer) {
            const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
            if (!isNaN(dragIndex) && dragIndex !== dropIndex) {
                const newOrder = [...columnOrder];
                const [draggedColumn] = newOrder.splice(dragIndex, 1);
                newOrder.splice(dropIndex, 0, draggedColumn);
                setColumnOrder(newOrder);
                localStorage.setItem('inventoryColumnOrder', JSON.stringify(newOrder));
            }
        }
    };

    const handleExportExcel = async () => {
        try {
            Swal.fire({
                title: 'Exporting...',
                text: 'Please wait while we generate the Excel spreadsheet.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                },
                background: '#1a1a2e',
                color: '#eee',
            });
            const res = await axios.get('/api/excel/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'inventory.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            Swal.close();
        } catch (err: any) {
            console.error(err);
            Swal.fire({
                icon: 'error',
                title: 'Export Failed',
                text: 'An error occurred while exporting the Excel spreadsheet.',
                background: '#1a1a2e',
                color: '#eee',
                confirmButtonColor: '#6c63ff',
            });
        }
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            Swal.fire({
                title: 'Importing...',
                text: 'Please wait while we process the Excel spreadsheet.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                },
                background: '#1a1a2e',
                color: '#eee',
            });

            const res = await axios.post('/api/excel/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            Swal.close();

            const { categoriesUpserted, productsCreated, productsUpdated } = res.data.summary;

            await Swal.fire({
                icon: 'success',
                title: 'Import Complete',
                html: `
                    <div style="text-align: left; font-size: 0.95em;">
                        <p>Spreadsheet processed successfully!</p>
                        <ul style="margin-top: 8px; padding-left: 20px;">
                            <li><b>New Products Created:</b> ${productsCreated}</li>
                            <li><b>Existing Products Updated:</b> ${productsUpdated}</li>
                            <li><b>Categories Added/Synced:</b> ${categoriesUpserted}</li>
                        </ul>
                    </div>
                `,
                background: '#1a1a2e',
                color: '#eee',
                confirmButtonColor: '#6c63ff',
            });

            fetchProducts();
        } catch (err: any) {
            Swal.close();
            Swal.fire({
                icon: 'error',
                title: 'Import Failed',
                text: err.response?.data?.error || 'An error occurred while uploading the file.',
                background: '#1a1a2e',
                color: '#eee',
                confirmButtonColor: '#6c63ff',
            });
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handlePrintBarcodeModal = async (product: Product) => {
        const serialSelectOptions = product.stockItems
            ? product.stockItems.filter(s => s.status === 'AVAILABLE').map(s => `<option value="sn:${s.serialNumber}">S/N: ${s.serialNumber}</option>`).join('')
            : '';

        const { value: printSettings } = await Swal.fire({
            title: 'Print Barcode Labels',
            html: `
                <div style="text-align: left; font-family: Inter, sans-serif; font-size: 0.95em;">
                    <p style="margin-bottom: 12px; color: #ccc;">Configure settings for printing barcode labels of <b>${product.name}</b>.</p>
                    
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 4px; color: #aaa;">Barcode Value Source</label>
                        <select id="print-barcode-source" class="swal2-select" style="margin: 0; width: 100%; box-sizing: border-box; padding: 8px; background: #16213e; color: #eee; border: 1px solid #333; border-radius: 8px;">
                            <option value="product">Product Barcode (${product.barcode})</option>
                            ${serialSelectOptions ? `
                                <option value="all-sns">All Available Serial Numbers (${product.stockItems?.filter(s => s.status === 'AVAILABLE').length})</option>
                                <optgroup label="Print Single Serial Number">
                                    ${serialSelectOptions}
                                </optgroup>
                            ` : ''}
                        </select>
                    </div>

                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 4px; color: #aaa;">Quantity to Print (Not applicable for "All S/Ns")</label>
                        <input id="print-qty" type="number" class="swal2-input" value="24" min="1" max="500" style="margin: 0; width: 100%; box-sizing: border-box;">
                    </div>

                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 4px; color: #aaa;">Paper Size / Layout</label>
                        <select id="print-size" class="swal2-select" style="margin: 0; width: 100%; box-sizing: border-box; padding: 8px; background: #16213e; color: #eee; border: 1px solid #333; border-radius: 8px;">
                            <option value="a4">A4 Sheet (Multi-label Grid)</option>
                            <option value="letter">Short / Letter Sheet (Multi-label Grid)</option>
                            <option value="folio">Long / Folio Sheet (Multi-label Grid)</option>
                            <option value="single-label">Single Label (50mm x 30mm)</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        <input id="print-show-name" type="checkbox" checked style="width: 16px; height: 16px; cursor: pointer;">
                        <label for="print-show-name" style="cursor: pointer; color: #eee; user-select: none;">Show Product Name</label>
                    </div>

                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input id="print-show-price" type="checkbox" checked style="width: 16px; height: 16px; cursor: pointer;">
                        <label for="print-show-price" style="cursor: pointer; color: #eee; user-select: none;">Show Price</label>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Generate & Print',
            confirmButtonColor: '#6c63ff',
            cancelButtonColor: '#555',
            background: '#1a1a2e',
            color: '#eee',
            preConfirm: () => {
                const quantity = parseInt((document.getElementById('print-qty') as HTMLInputElement).value, 10);
                const paperSize = (document.getElementById('print-size') as HTMLSelectElement).value;
                const barcodeSource = (document.getElementById('print-barcode-source') as HTMLSelectElement).value;
                const showName = (document.getElementById('print-show-name') as HTMLInputElement).checked;
                const showPrice = (document.getElementById('print-show-price') as HTMLInputElement).checked;

                if (isNaN(quantity) || quantity <= 0) {
                    Swal.showValidationMessage('Quantity must be at least 1');
                    return;
                }
                return { quantity, paperSize, barcodeSource, showName, showPrice };
            }
        });

        if (printSettings) {
            triggerBarcodePrint(product, printSettings);
        }
    };

    const triggerBarcodePrint = (product: Product, settings: any) => {
        const { quantity, paperSize, barcodeSource, showName, showPrice } = settings;

        let barcodesToPrint: string[] = [];
        if (barcodeSource === 'product') {
            for (let i = 0; i < quantity; i++) {
                barcodesToPrint.push(product.barcode);
            }
        } else if (barcodeSource === 'all-sns') {
            const available = product.stockItems?.filter(s => s.status === 'AVAILABLE') || [];
            barcodesToPrint = available.map(s => s.serialNumber);
        } else if (barcodeSource.startsWith('sn:')) {
            const snVal = barcodeSource.slice(3);
            for (let i = 0; i < quantity; i++) {
                barcodesToPrint.push(snVal);
            }
        }

        let labelsHtml = '';
        for (const code of barcodesToPrint) {
            // Generate inline vector SVG barcode using JsBarcode
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            try {
                JsBarcode(svg, code, {
                    format: "CODE128",
                    width: 1.8,
                    height: 50,
                    displayValue: true,
                    fontSize: 14,
                    textMargin: 2,
                });
            } catch (e) {
                console.error("JsBarcode generation failed:", e);
            }
            const svgHtml = svg.outerHTML;

            const isSn = code !== product.barcode;
            const priceVal = product.retailPrice > 0 ? product.retailPrice : product.price;

            labelsHtml += `
                <div class="barcode-label">
                    ${showName ? `<div class="product-title">${product.name}</div>` : ''}
                    <div class="barcode-svg">${svgHtml}</div>
                    <div style="display:flex; justify-content:space-between; width:100%; padding:0 10px; font-size:10px; margin-top:2px;">
                        ${isSn ? `<span style="font-weight:600;">S/N: ${code}</span>` : '<span></span>'}
                        ${showPrice ? `<span style="font-weight:700;">$${priceVal.toFixed(2)}</span>` : ''}
                    </div>
                </div>
            `;
        }

        let sizeStyle = '';
        if (paperSize === 'a4') {
            sizeStyle = '@page { size: A4; margin: 10mm; }';
        } else if (paperSize === 'letter') {
            sizeStyle = '@page { size: letter; margin: 0.5in; }';
        } else if (paperSize === 'folio') {
            sizeStyle = '@page { size: 8.5in 13in; margin: 0.5in; }';
        } else if (paperSize === 'single-label') {
            sizeStyle = '@page { size: 50mm 30mm; margin: 0; }';
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            Swal.fire({
                icon: 'error',
                title: 'Popup Blocked',
                text: 'Please allow popups to open the print screen.',
                background: '#1a1a2e',
                color: '#eee',
            });
            return;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Print Barcodes - ${product.name}</title>
                <style>
                    ${sizeStyle}
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        background: #fff;
                        color: #000;
                        padding: ${paperSize === 'single-label' ? '0' : '5mm'};
                    }
                    
                    /* Grid Layout for Sheet printing */
                    .barcode-sheet-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 0;
                        border-top: 1px dashed #ccc;
                        border-left: 1px dashed #ccc;
                    }
                    
                    /* Layout for Single Label roll printing */
                    .barcode-sheet-single {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    
                    .barcode-label {
                        border: none;
                        border-right: 1px dashed #ccc;
                        border-bottom: 1px dashed #ccc;
                        padding: 12px 6px;
                        text-align: center;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        background: #fff;
                        page-break-inside: avoid;
                        height: 32mm;
                    }
                    
                    /* Adjust for label rolls */
                    .barcode-sheet-single .barcode-label {
                        width: 50mm;
                        height: 30mm;
                        border: none;
                        page-break-after: always;
                        padding: 2px;
                    }

                    .product-title {
                        font-size: 10px;
                        font-weight: 600;
                        margin-bottom: 2px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        width: 100%;
                    }

                    .barcode-svg svg {
                        max-width: 100%;
                        height: auto;
                    }

                    .product-cost {
                        font-size: 11px;
                        font-weight: 700;
                        margin-top: 1px;
                    }
                </style>
            </head>
            <body>
                <div class="${paperSize === 'single-label' ? 'barcode-sheet-single' : 'barcode-sheet-grid'}">
                    ${labelsHtml}
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const fetchProducts = async () => {
        try {
            const params: any = {};
            if (search) params.q = search;
            if (categoryFilter) params.categoryId = categoryFilter;
            const res = await axios.get('/api/products/search', { params });
            setProducts(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        axios.get('/api/categories')
            .then((r) => setCategories(r.data))
            .catch((err) => console.error("Failed to fetch categories:", err));
    }, []);

    useEffect(() => {
        const timer = setTimeout(fetchProducts, 300);
        return () => clearTimeout(timer);
    }, [search, categoryFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, categoryFilter]);

    const handleDelete = async (product: Product) => {
        const result = await Swal.fire({
            title: 'Delete Product?',
            text: `Are you sure you want to delete "${product.name}"?`,
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
                await axios.delete(`/api/products/${product.id}`);
                setProducts((prev) => prev.filter((p) => p.id !== product.id));
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Product has been deleted.',
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#eee',
                });
                if (viewingProduct?.id === product.id) {
                    setViewingProduct(null);
                }
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.response?.data?.error || 'Failed to delete product',
                    background: '#1a1a2e',
                    color: '#eee',
                });
            }
        }
    };

    const toggleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
        setCurrentPage(1);
    };

    const renderSortIndicator = (field: string) => {
        if (sortBy !== field) {
            return <ArrowUpDown size={12} className="sort-icon" style={{ marginLeft: '4px', opacity: 0.4 }} />;
        }
        return sortOrder === 'asc' ? 
            <ChevronUp size={12} className="sort-icon" style={{ marginLeft: '4px', color: 'var(--accent)' }} /> : 
            <ChevronDown size={12} className="sort-icon" style={{ marginLeft: '4px', color: 'var(--accent)' }} />;
    };

    const handleOpenViewModal = async (product: Product) => {
        setViewingProduct(product);
        try {
            const res = await axios.get(`/api/products/${product.id}/barcode`);
            setViewingProductBarcodeUrl(res.data.barcodeImageUrl);
        } catch (err) {
            console.error("Failed to load barcode URL", err);
            setViewingProductBarcodeUrl(null);
        }
    };

    const getSortedProducts = () => {
        return [...products].sort((a, b) => {
            let valA: any = a[sortBy as keyof Product];
            let valB: any = b[sortBy as keyof Product];

            if (sortBy === 'category') {
                valA = a.category?.name || '';
                valB = b.category?.name || '';
            }

            if (typeof valA === 'string' && typeof valB === 'string') {
                const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
                return sortOrder === 'asc' ? cmp : -cmp;
            }

            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }

            // Fallback for dates/others
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const sortedProducts = getSortedProducts();
    const itemsPerPage = 50;
    const totalPages = Math.ceil(sortedProducts.length / itemsPerPage) || 1;
    const paginatedProducts = sortedProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const pages = [];
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        return (
            <div className="pagination-container">
                <div className="pagination-info">
                    Showing <strong>{sortedProducts.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, sortedProducts.length)}</strong> of <strong>{sortedProducts.length}</strong> products
                </div>
                <div className="pagination-controls">
                    <button
                        className="pagination-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(1)}
                        title="First Page"
                    >
                        <ChevronsLeft size={16} />
                    </button>
                    <button
                        className="pagination-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        title="Previous Page"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    {startPage > 1 && <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>...</span>}

                    {pages.map((p) => (
                        <button
                            key={p}
                            className={`pagination-btn ${currentPage === p ? 'active' : ''}`}
                            onClick={() => setCurrentPage(p)}
                        >
                            {p}
                        </button>
                    ))}

                    {endPage < totalPages && <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>...</span>}

                    <button
                        className="pagination-btn"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        title="Next Page"
                    >
                        <ChevronRight size={16} />
                    </button>
                    <button
                        className="pagination-btn"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        title="Last Page"
                    >
                        <ChevronsRight size={16} />
                    </button>
                </div>
            </div>
        );
    };

    const columns: Record<string, { label: string; header: React.ReactNode; cell: (p: Product) => React.ReactNode }> = {
        image: {
            label: 'Image',
            header: <span style={{ userSelect: 'none' }}>Image</span>,
            cell: (product) => (
                <motion.td
                    layout
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                >
                    {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="table-product-thumb" />
                    ) : (
                        <div className="table-product-placeholder">
                            <Package size={18} />
                        </div>
                    )}
                </motion.td>
            )
        },
        barcode: {
            label: 'Barcode/SKU',
            header: (
                <div className="th-content" onClick={(e) => { e.stopPropagation(); toggleSort('barcode'); }} style={{ userSelect: 'none', display: 'flex', alignItems: 'center' }}>
                    Barcode/SKU {renderSortIndicator('barcode')}
                </div>
            ),
            cell: (product) => (
                <motion.td
                    layout
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                >
                    {product.barcode}
                </motion.td>
            )
        },
        name: {
            label: 'Product Name',
            header: (
                <div className="th-content" onClick={(e) => { e.stopPropagation(); toggleSort('name'); }} style={{ userSelect: 'none', display: 'flex', alignItems: 'center' }}>
                    Product Name {renderSortIndicator('name')}
                </div>
            ),
            cell: (product) => (
                <motion.td
                    layout
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    style={{ fontWeight: '600' }}
                >
                    <span>{product.name}</span>
                </motion.td>
            )
        },
        category: {
            label: 'Category',
            header: (
                <div className="th-content" onClick={(e) => { e.stopPropagation(); toggleSort('category'); }} style={{ userSelect: 'none', display: 'flex', alignItems: 'center' }}>
                    Category {renderSortIndicator('category')}
                </div>
            ),
            cell: (product) => (
                <motion.td
                    layout
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                >
                    <span className="product-category">{product.category.name}</span>
                </motion.td>
            )
        },
        costPrice: {
            label: 'Cost Price',
            header: (
                <div className="th-content" onClick={(e) => { e.stopPropagation(); toggleSort('costPrice'); }} style={{ userSelect: 'none', display: 'flex', alignItems: 'center' }}>
                    Cost Price {renderSortIndicator('costPrice')}
                </div>
            ),
            cell: (product) => (
                <motion.td
                    layout
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    style={{ color: 'var(--text-muted)' }}
                >
                    ₱{product.costPrice ? product.costPrice.toFixed(2) : '0.00'}
                </motion.td>
            )
        },
        retailPrice: {
            label: 'Retail Price',
            header: (
                <div className="th-content" onClick={(e) => { e.stopPropagation(); toggleSort('retailPrice'); }} style={{ userSelect: 'none', display: 'flex', alignItems: 'center' }}>
                    Retail Price {renderSortIndicator('retailPrice')}
                </div>
            ),
            cell: (product) => (
                <motion.td
                    layout
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    className="text-green"
                    style={{ fontWeight: '700' }}
                >
                    ₱{product.retailPrice > 0 ? product.retailPrice.toFixed(2) : product.price.toFixed(2)}
                </motion.td>
            )
        },
        stockQty: {
            label: 'Stock Quantity',
            header: (
                <div className="th-content" onClick={(e) => { e.stopPropagation(); toggleSort('stockQty'); }} style={{ userSelect: 'none', display: 'flex', alignItems: 'center' }}>
                    Stock Quantity {renderSortIndicator('stockQty')}
                </div>
            ),
            cell: (product) => (
                <motion.td
                    layout
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                >
                    <span className={`stock-badge ${
                        product.stockQty === 0 
                            ? 'stock-out' 
                            : product.stockQty <= 10 
                                ? 'stock-low' 
                                : 'stock-good'
                    }`}>
                        {product.stockQty === 0 
                            ? 'Out of Stock' 
                            : product.stockQty <= 10 
                                ? `Low Stock (${product.stockQty})` 
                                : `${product.stockQty} in stock`
                        }
                    </span>
                </motion.td>
            )
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Inventory</h1>
                    <p className="text-[11px] text-slate-500 font-medium">{products.length} products total</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportExcel}
                        accept=".xlsx, .xls"
                        style={{ display: 'none' }}
                    />
                    <motion.button
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded flex items-center gap-2 text-[12px] font-bold transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Upload size={14} />
                        Import Excel
                    </motion.button>
                    <motion.button
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded flex items-center gap-2 text-[12px] font-bold transition-colors"
                        onClick={handleExportExcel}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Download size={14} />
                        Export Excel
                    </motion.button>
                    <motion.button
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded flex items-center gap-2 text-[12px] font-bold transition-colors"
                        onClick={() => navigate('/inventory/purchase')}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Package size={14} />
                        Stock Purchase
                    </motion.button>
                    <motion.button
                        className="bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded flex items-center gap-2 text-[12px] font-bold transition-colors"
                        onClick={() => navigate('/products/new')}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Plus size={14} />
                        Add Product
                    </motion.button>
                </div>
            </header>
            
            <main className="flex-1 p-5 overflow-y-auto w-full">

            <div className="filters-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search products, barcodes..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="filter-select">
                    <Filter size={18} />
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                        <option value="">All Categories</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-select">
                    <ArrowUpDown size={18} />
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="name">Sort by Name</option>
                        <option value="barcode">Sort by Barcode/SKU</option>
                        <option value="price">Sort by Price</option>
                        <option value="stockQty">Sort by Stock Qty</option>
                        <option value="category">Sort by Category</option>
                        <option value="createdAt">Sort by Date Added</option>
                    </select>
                </div>
                <div className="filter-select">
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}>
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : products.length === 0 ? (
                <div className="empty-state">
                    <Package size={48} />
                    <h3>No products found</h3>
                    <p>Add your first product to get started</p>
                </div>
            ) : (
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        {columnOrder.map((colKey, index) => (
                                            <motion.th
                                                key={colKey}
                                                layout
                                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                                draggable="true"
                                                onDragStartCapture={(e) => handleDragStart(e, index)}
                                                onDragOverCapture={(e) => handleDragOver(e)}
                                                onDropCapture={(e) => handleDrop(e, index)}
                                                style={{ cursor: 'grab' }}
                                                className={colKey !== 'image' ? 'sortable-th' : ''}
                                            >
                                                {columns[colKey].header}
                                            </motion.th>
                                        ))}
                                        <motion.th
                                            layout
                                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                            style={{ width: '150px', textAlign: 'right' }}
                                        >
                                            Actions
                                        </motion.th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedProducts.map((product) => (
                                        <tr
                                            key={product.id}
                                            onClick={() => handleOpenViewModal(product)}
                                            style={{ cursor: 'pointer' }}
                                            className="inventory-table-row"
                                        >
                                            {columnOrder.map((colKey) => (
                                                <Fragment key={colKey}>
                                                    {columns[colKey].cell(product)}
                                                </Fragment>
                                            ))}
                                            <motion.td
                                                layout
                                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                                style={{ textAlign: 'right' }}
                                            >
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        className="btn-icon btn-view"
                                                        title="View Details"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenViewModal(product);
                                                        }}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-edit"
                                                        title="Edit Product"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/products/${product.id}/edit`);
                                                        }}
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-delete"
                                                        title="Delete Product"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(product);
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </motion.td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {renderPagination()}
                </motion.div>
            )}

            {/* Custom Detail View Modal */}
            <AnimatePresence>
                {viewingProduct && (
                    <div className="modal-overlay" onClick={() => setViewingProduct(null)}>
                        <motion.div
                            className="modal-container"
                            onClick={(e) => e.stopPropagation()}
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <button className="modal-close-btn" onClick={() => setViewingProduct(null)}>
                                <X size={18} />
                            </button>
                            <div className="modal-body">
                                <div className="product-detail-grid">
                                    <div className="product-detail-image-section">
                                        {viewingProduct.imageUrl ? (
                                            <img src={viewingProduct.imageUrl} alt={viewingProduct.name} className="product-detail-image" />
                                        ) : (
                                            <div className="product-detail-image-placeholder">
                                                <Package size={48} />
                                            </div>
                                        )}
                                        <div className="product-detail-barcode-area">
                                            {viewingProductBarcodeUrl ? (
                                                <img src={viewingProductBarcodeUrl} alt={viewingProduct.barcode} style={{ maxWidth: '100%', height: 'auto' }} />
                                            ) : (
                                                <div style={{ color: '#000', fontSize: '0.8rem', fontFamily: 'monospace', textAlign: 'center' }}>
                                                    <Barcode size={32} style={{ margin: '0 auto 4px', opacity: 0.7 }} />
                                                    {viewingProduct.barcode}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="product-detail-info-section">
                                        <div className="product-detail-header">
                                            <h2>{viewingProduct.name}</h2>
                                            <span className="product-detail-category-badge">{viewingProduct.category.name}</span>
                                        </div>
                                        <div className="product-detail-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                            <div className="product-detail-meta-card">
                                                <div className="product-detail-meta-label">Cost Price</div>
                                                <div className="product-detail-meta-value" style={{ color: 'var(--text-muted)' }}>₱{viewingProduct.costPrice ? viewingProduct.costPrice.toFixed(2) : '0.00'}</div>
                                            </div>
                                            <div className="product-detail-meta-card">
                                                <div className="product-detail-meta-label">Retail Price</div>
                                                <div className="product-detail-meta-value text-green">₱{viewingProduct.retailPrice ? viewingProduct.retailPrice.toFixed(2) : viewingProduct.price.toFixed(2)}</div>
                                            </div>
                                            <div className="product-detail-meta-card">
                                                <div className="product-detail-meta-label">VAT</div>
                                                <div className="product-detail-meta-value" style={{ fontSize: '0.9rem' }}>
                                                    {viewingProduct.taxRate}% ({viewingProduct.taxInclusive ? 'Inclusive' : 'Exclusive'})
                                                </div>
                                            </div>
                                            <div className="product-detail-meta-card">
                                                <div className="product-detail-meta-label">Stock Status</div>
                                                <div className={`product-detail-meta-value ${
                                                    viewingProduct.stockQty === 0 
                                                        ? 'text-red' 
                                                        : viewingProduct.stockQty <= 10 
                                                            ? 'text-yellow' 
                                                            : 'text-green'
                                                }`}>
                                                    {viewingProduct.stockQty} Units
                                                </div>
                                            </div>
                                        </div>
                                        <div className="product-detail-description" style={{ marginBottom: '16px' }}>
                                            <h3>Description</h3>
                                            <p>{viewingProduct.description || 'No description provided.'}</p>
                                        </div>
                                        
                                        <div className="product-detail-stocks" style={{ marginBottom: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                            {(() => {
                                                const totalCount = viewingProduct.stockItems ? viewingProduct.stockItems.length : 0;
                                                const availCount = viewingProduct.stockItems ? viewingProduct.stockItems.filter((s: any) => s.status === 'AVAILABLE').length : 0;
                                                const soldCount = totalCount - availCount;
                                                
                                                const displayedItems = viewingProduct.stockItems 
                                                    ? viewingProduct.stockItems.filter((s: any) => s.status === activeStockTab) 
                                                    : [];
                                                    
                                                return (
                                                    <>
                                                        <h3 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>
                                                            Stock Items (S/Ns) — <span className="text-green" style={{ fontWeight: '700' }}>{availCount} Available</span> / {totalCount} Total
                                                        </h3>
                                                        
                                                        <div className="tabs mb-4" style={{ display: 'flex', gap: '8px' }}>
                                                            <button 
                                                                className={`btn ${activeStockTab === 'AVAILABLE' ? 'btn-primary' : 'btn-secondary'}`}
                                                                onClick={() => setActiveStockTab('AVAILABLE')}
                                                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                                            >
                                                                Available ({availCount})
                                                            </button>
                                                            <button 
                                                                className={`btn ${activeStockTab === 'SOLD' ? 'btn-primary' : 'btn-secondary'}`}
                                                                onClick={() => setActiveStockTab('SOLD')}
                                                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                                            >
                                                                Sold ({soldCount})
                                                            </button>
                                                        </div>

                                                        {displayedItems.length > 0 ? (
                                                            <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', maxHeight: '200px', overflowY: 'auto' }}>
                                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                                                        <tr style={{ background: 'var(--bg-primary)', textAlign: 'left' }}>
                                                                            <th style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>Serial Number (S/N)</th>
                                                                            <th style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Status</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {displayedItems.map((s, idx) => (
                                                                            <tr key={s.id} style={{ borderBottom: idx === displayedItems.length - 1 ? 'none' : '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)' }}>
                                                                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: '500' }}>{s.serialNumber}</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                                                    <span className={`stock-badge ${s.status === 'AVAILABLE' ? 'stock-good' : 'stock-out'}`} style={{ padding: '4px 8px', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                                                                        {s.status}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
                                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No {activeStockTab.toLowerCase()} serial numbers found.</p>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Date Added: {new Date(viewingProduct.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="product-detail-footer">
                                <button className="btn btn-secondary" onClick={() => handlePrintBarcodeModal(viewingProduct)}>
                                    <Printer size={16} /> Print Barcode Label
                                </button>
                                <button className="btn btn-secondary" onClick={() => {
                                    setViewingProduct(null);
                                    setActiveStockTab('AVAILABLE');
                                    navigate(`/products/${viewingProduct.id}/edit`);
                                }}>
                                    <Edit3 size={16} /> Edit Details
                                </button>
                                <button className="btn btn-primary" onClick={() => {
                                    setViewingProduct(null);
                                    setActiveStockTab('AVAILABLE');
                                }}>
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            </main>
        </div>
    );
}

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import {
    Search,
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    CreditCard,
    Barcode,
    Camera,
    Printer,
    X,
} from 'lucide-react';

interface Product {
    id: number;
    name: string;
    price: number;
    costPrice: number;
    retailPrice: number;
    taxRate: number;
    taxInclusive: boolean;
    barcode: string;
    imageUrl: string | null;
    stockQty: number;
    category: { name: string };
    stockItems?: Array<{ id: number; serialNumber: string; status: string }>;
}

interface CartItem extends Product {
    quantity: number;
    selectedSerialNumbers: string[];
}

const generateSeriesNumber = (txnId: number, dateStr: string) => {
    const date = new Date(dateStr);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const formattedId = String(txnId).padStart(5, '0');
    return `AP-${yyyy}${mm}${dd}-${formattedId}`;
};

export default function POS() {
    const { user } = useAuth();
    const { hasPosPin, posPinLength, maintenanceMode } = useBranding();
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>(() => {
        const saved = localStorage.getItem('pos_cart');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return [];
            }
        }
        return [];
    });

    useEffect(() => {
        localStorage.setItem('pos_cart', JSON.stringify(cart));
    }, [cart]);

    const requestAdminAuth = async (): Promise<boolean> => {
        if (user?.role === 'ADMIN') {
            return true;
        }

        const promptText = hasPosPin 
            ? `Please enter the ${posPinLength}-digit Admin POS PIN or Admin password to authorize this void.` 
            : 'Please enter the Admin password to authorize this void.';

        const { value: inputVal } = await Swal.fire({
            title: 'Admin Authorization Required',
            text: promptText,
            input: 'password',
            inputPlaceholder: hasPosPin ? 'Admin PIN or Password' : 'Admin Password',
            inputAttributes: {
                autocapitalize: 'off',
                autocorrect: 'off'
            },
            showCancelButton: true,
            confirmButtonText: 'Verify',
            confirmButtonColor: 'var(--accent)',
            cancelButtonColor: 'var(--bg-hover)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            inputValidator: (value) => {
                if (!value) {
                    return 'Verification code/password is required!';
                }
            }
        });

        if (!inputVal) {
            return false;
        }

        try {
            const verifyRes = await axios.post('/api/settings/verify-pin', { value: inputVal });
            if (verifyRes.data && verifyRes.data.valid) {
                return true;
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Access Denied',
                    text: 'Invalid Admin PIN or Password.',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    confirmButtonColor: 'var(--accent)'
                });
                return false;
            }
        } catch (err: any) {
            Swal.fire({
                icon: 'error',
                title: 'Verification Failed',
                text: err.response?.data?.error || 'Verification error',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                confirmButtonColor: 'var(--accent)'
            });
            return false;
        }
    };
    const [search, setSearch] = useState('');
    const [discount, setDiscount] = useState(0);
    const [showScanner, setShowScanner] = useState(false);
    const [paymentModes, setPaymentModes] = useState<any[]>([]);
    const searchRef = useRef<HTMLInputElement>(null);
    const scannerRef = useRef<any>(null);

    useEffect(() => {
        axios.get('/api/products').then((r) => setProducts(r.data));
        axios.get('/api/payment-modes?active=true').then((r) => setPaymentModes(r.data));
    }, []);

    const filteredProducts = products.filter(
        (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.barcode.includes(search) ||
            p.stockItems?.some(s => s.status === 'AVAILABLE' && s.serialNumber.toLowerCase().includes(search.toLowerCase()))
    );

    const addToCart = (product: Product, specificSn?: string) => {
        const availableSns = product.stockItems?.filter(s => s.status === 'AVAILABLE') || [];

        setCart((prev) => {
            const existing = prev.find((item) => item.id === product.id);

            let snToAttach = specificSn;
            if (!snToAttach) {
                const currentSelected = existing ? existing.selectedSerialNumbers : [];
                const firstFree = availableSns.find(s => !currentSelected.includes(s.serialNumber));
                if (firstFree) {
                    snToAttach = firstFree.serialNumber;
                }
            }

            if (existing) {
                if (existing.quantity >= product.stockQty) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Insufficient Stock',
                        text: `Only ${product.stockQty} available`,
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        confirmButtonColor: 'var(--accent)',
                    });
                    return prev;
                }
                const updatedSns = [...existing.selectedSerialNumbers];
                if (snToAttach && !updatedSns.includes(snToAttach)) {
                    updatedSns.push(snToAttach);
                }
                return prev.map((item) =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1, selectedSerialNumbers: updatedSns } : item
                );
            }

            const initialSns = snToAttach ? [snToAttach] : [];
            return [...prev, { ...product, quantity: 1, selectedSerialNumbers: initialSns }];
        });
    };

    const updateQuantity = (productId: number, delta: number) => {
        setCart((prev) => {
            return prev
                .map((item) => {
                    if (item.id === productId) {
                        const newQty = item.quantity + delta;
                        if (newQty <= 0) {
                            Swal.fire({
                                icon: 'info',
                                title: 'To Void Item',
                                text: 'Please use the "Void" button to remove items from the cart.',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                confirmButtonColor: 'var(--accent)',
                                timer: 2500,
                            });
                            return item;
                        }
                        if (newQty > item.stockQty) {
                             Swal.fire({
                                 icon: 'warning',
                                 title: 'Max stock reached',
                                 text: `Only ${item.stockQty} available`,
                                 background: 'var(--bg-secondary)',
                                 color: 'var(--text-primary)',
                                 timer: 1500,
                                 showConfirmButton: false,
                             });
                            return item;
                        }

                        let updatedSns = [...item.selectedSerialNumbers];
                        if (delta > 0) {
                            const availableSns = item.stockItems?.filter(s => s.status === 'AVAILABLE') || [];
                            const firstFree = availableSns.find(s => !updatedSns.includes(s.serialNumber));
                            if (firstFree) {
                                updatedSns.push(firstFree.serialNumber);
                            }
                        } else if (delta < 0) {
                            updatedSns.pop();
                        }

                        return { ...item, quantity: newQty, selectedSerialNumbers: updatedSns };
                    }
                    return item;
                })
                .filter(Boolean) as CartItem[];
        });
    };

    const removeFromCart = async (productId: number) => {
        const authorized = await requestAdminAuth();
        if (!authorized) return;
        setCart((prev) => prev.filter((item) => item.id !== productId));
    };

    // Computations for Prices and Tax
    const getPOSUnitPrice = (p: Product) => {
        const retail = p.retailPrice > 0 ? p.retailPrice : p.price;
        if (p.taxRate > 0 && !p.taxInclusive) {
            return retail * (1 + p.taxRate / 100);
        }
        return retail;
    };

    const netSubtotal = cart.reduce((sum, item) => {
        const retail = item.retailPrice > 0 ? item.retailPrice : item.price;
        return sum + retail * item.quantity;
    }, 0);

    const taxAmount = cart.reduce((sum, item) => {
        const retail = item.retailPrice > 0 ? item.retailPrice : item.price;
        const taxRate = item.taxRate || 0;
        if (taxRate > 0) {
            if (item.taxInclusive) {
                const netBase = retail / (1 + taxRate / 100);
                return sum + (retail - netBase) * item.quantity;
            } else {
                return sum + (retail * (taxRate / 100)) * item.quantity;
            }
        }
        return sum;
    }, 0);

    const exclusiveTaxAmount = cart.reduce((sum, item) => {
        const retail = item.retailPrice > 0 ? item.retailPrice : item.price;
        const taxRate = item.taxRate || 0;
        if (taxRate > 0 && !item.taxInclusive) {
            return sum + (retail * (taxRate / 100)) * item.quantity;
        }
        return sum;
    }, 0);

    const subtotal = netSubtotal + exclusiveTaxAmount;
    const total = subtotal - discount;

    const handleCheckout = async () => {
        if (cart.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Empty Cart',
                text: 'Add items before checkout',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                confirmButtonColor: 'var(--accent)',
            });
            return;
        }

        const result = await Swal.fire({
            title: 'Confirm Payment',
            html: `
        <div style="text-align:left; font-family: var(--font); color: var(--text-primary);">
          <p style="margin-bottom: 8px;">Items: <strong>${cart.length}</strong></p>
          <p style="margin-bottom: 8px;">Subtotal: <strong>₱${netSubtotal.toFixed(2)}</strong></p>
          ${exclusiveTaxAmount > 0 ? `<p style="margin-bottom: 8px;">VAT (Exclusive): <strong>₱${exclusiveTaxAmount.toFixed(2)}</strong></p>` : ''}
          ${taxAmount - exclusiveTaxAmount > 0 ? `<p style="margin-bottom: 8px; color: var(--text-muted); font-size: 0.9em;">VAT Included: ₱${(taxAmount - exclusiveTaxAmount).toFixed(2)}</p>` : ''}
          <p style="margin-bottom: 8px;">Discount: <strong>₱${discount.toFixed(2)}</strong></p>
          <hr style="border: 0; border-top: 1px solid var(--border); margin: 12px 0;" />
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">Payment Mode *</label>
            <select id="swal-payment-mode" style="width: 100%; padding: 10px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; outline: none; cursor: pointer;">
              ${paymentModes.length === 0 
                ? '<option value="" style="background: var(--bg-secondary); color: var(--text-primary);">(No Payment Modes Configured)</option>' 
                : paymentModes.map(pm => `<option value="${pm.id}" style="background: var(--bg-secondary); color: var(--text-primary);">${pm.name}</option>`).join('')}
            </select>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">Amount Tendered *</label>
            <input type="number" id="swal-amount-tendered" step="0.01" min="${total.toFixed(2)}" value="${total.toFixed(2)}" oninput="
                const t = ${total};
                const val = parseFloat(this.value) || 0;
                const change = val >= t ? val - t : 0;
                document.getElementById('swal-change-amount').innerText = '₱' + change.toFixed(2);
            " style="width: 100%; padding: 10px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; outline: none; box-sizing: border-box;" />
          </div>
          <hr style="border: 0; border-top: 1px solid var(--border); margin: 12px 0;" />
          <p style="font-size: 1.3em; display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Total:</span> <strong style="color: var(--green);">₱${total.toFixed(2)}</strong></p>
          <p style="font-size: 1.1em; display: flex; justify-content: space-between; margin: 0;"><span>Change:</span> <strong style="color: var(--accent);" id="swal-change-amount">₱0.00</strong></p>
        </div>
      `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Process Payment',
            confirmButtonColor: 'var(--accent)',
            cancelButtonColor: 'var(--bg-hover)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            preConfirm: () => {
                const selectEl = document.getElementById('swal-payment-mode') as HTMLSelectElement;
                const paymentModeId = selectEl ? selectEl.value : '';
                if (!paymentModeId && paymentModes.length > 0) {
                    Swal.showValidationMessage('Please select a payment mode.');
                    return false;
                }
                const amountEl = document.getElementById('swal-amount-tendered') as HTMLInputElement;
                const amountTendered = amountEl ? parseFloat(amountEl.value) : 0;
                
                if (isNaN(amountTendered) || amountTendered < total - 0.001) {
                    Swal.showValidationMessage(`Amount tendered must be at least ₱${total.toFixed(2)}.`);
                    return false;
                }
                const changeAmount = amountTendered - total;
                return { paymentModeId, amountTendered, changeAmount };
            }
        });

        if (result.isConfirmed) {
            try {
                const res = await axios.post('/api/transactions', {
                    items: cart.map((item) => ({
                        productId: item.id,
                        quantity: item.quantity,
                        serialNumbers: item.selectedSerialNumbers,
                    })),
                    discount,
                    paymentModeId: result.value.paymentModeId ? parseInt(result.value.paymentModeId) : null,
                    amountTendered: result.value.amountTendered,
                    changeAmount: result.value.changeAmount,
                });

                // Show receipt
                const txn = res.data;
                await Swal.fire({
                    title: '✅ Payment Successful!',
                    html: `
            <div style="font-family: var(--font); color: var(--text-primary); text-align: left;">
              <!-- Tab Buttons -->
              <div style="display: flex; gap: 6px; margin-bottom: 15px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                <button id="btn-tab-customer" onclick="
                  document.querySelectorAll('.receipt-tab').forEach(t => t.style.display = 'none');
                  document.getElementById('receipt-customer').style.display = 'block';
                  document.querySelectorAll('.receipt-btn').forEach(b => { b.style.background = 'var(--bg-hover)'; b.style.color = 'var(--text-primary)'; });
                  this.style.background = 'var(--accent)';
                  this.style.color = '#fff';
                " class="receipt-btn" style="flex: 1; padding: 6px; font-size: 0.8rem; background: var(--accent); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Customer</button>
                
                <button id="btn-tab-merchant" onclick="
                  document.querySelectorAll('.receipt-tab').forEach(t => t.style.display = 'none');
                  document.getElementById('receipt-merchant').style.display = 'block';
                  document.querySelectorAll('.receipt-btn').forEach(b => { b.style.background = 'var(--bg-hover)'; b.style.color = 'var(--text-primary)'; });
                  this.style.background = 'var(--accent)';
                  this.style.color = '#fff';
                " class="receipt-btn" style="flex: 1; padding: 6px; font-size: 0.8rem; background: var(--bg-hover); color: var(--text-primary); border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Cashier/Staff</button>
                
                ${user?.role === 'ADMIN' ? `
                <button id="btn-tab-audit" onclick="
                  document.querySelectorAll('.receipt-tab').forEach(t => t.style.display = 'none');
                  document.getElementById('receipt-audit').style.display = 'block';
                  document.querySelectorAll('.receipt-btn').forEach(b => { b.style.background = 'var(--bg-hover)'; b.style.color = 'var(--text-primary)'; });
                  this.style.background = 'var(--accent)';
                  this.style.color = '#fff';
                " class="receipt-btn" style="flex: 1; padding: 6px; font-size: 0.8rem; background: var(--bg-hover); color: var(--text-primary); border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Admin Audit</button>
                ` : ''}
              </div>

              <!-- Customer Tab Content -->
              <div id="receipt-customer" class="receipt-tab" style="display: block; font-size: 0.9em;">
                <h4 style="text-align: center; margin: 0 0 4px 0; font-size: 1.1em;">AZTECH POS</h4>
                <p style="text-align: center; margin: 0 0 10px 0; font-size: 0.8em; color: var(--text-muted);">Customer Copy</p>
                <p style="margin: 4px 0;"><strong>Receipt #:</strong> ${generateSeriesNumber(txn.id, txn.createdAt)}</p>
                <p style="margin: 4px 0;"><strong>Cashier:</strong> ${txn.cashier?.name || 'Unknown'}</p>
                <p style="margin: 4px 0;"><strong>Payment Mode:</strong> ${txn.paymentModeName || 'None'}</p>
                <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(txn.createdAt).toLocaleString()}</p>
                <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;" />
                ${txn.items.map((i: any) => `
                  <div style="margin: 6px 0;">
                    <div style="display: flex; justify-content: space-between;">
                      <span><b>${i.product?.name}</b> x${i.quantity}</span>
                      <span>₱${i.subtotal.toFixed(2)}</span>
                    </div>
                    ${i.stockItems && i.stockItems.length > 0 ? `
                      <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace; margin-top: 2px;">
                        S/Ns: ${i.stockItems.map((s: any) => s.serialNumber).join(', ')}
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
                <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;" />
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <span>Subtotal</span>
                  <span>₱${(txn.totalAmount + txn.discount - txn.taxAmount).toFixed(2)}</span>
                </div>
                ${txn.taxAmount > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin: 4px 0; color: var(--text-muted);">
                    <span>VAT</span>
                    <span>₱${txn.taxAmount.toFixed(2)}</span>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <span>Discount</span>
                  <span>-₱${txn.discount.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 1.15em; font-weight: bold; margin-top: 8px;">
                  <span>Total Paid</span>
                  <span style="color: var(--green);">₱${txn.totalAmount.toFixed(2)}</span>
                </div>
                ${txn.amountTendered !== null ? `
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <span>Amount Tendered</span>
                  <span>₱${txn.amountTendered.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <span>Change</span>
                  <span>₱${txn.changeAmount.toFixed(2)}</span>
                </div>
                ` : ''}
                <p style="text-align: center; margin-top: 15px; font-size: 0.8em; color: var(--text-muted);">Thank you for shopping with us!</p>
              </div>

              <!-- Cashier/Staff Tab Content -->
              <div id="receipt-merchant" class="receipt-tab" style="display: none; font-size: 0.9em;">
                <h4 style="text-align: center; margin: 0 0 4px 0; font-size: 1.1em;">AZTECH POS</h4>
                <p style="text-align: center; margin: 0 0 10px 0; font-size: 0.8em; color: var(--text-muted);">Merchant/Staff Copy</p>
                <p style="margin: 4px 0;"><strong>Receipt #:</strong> ${generateSeriesNumber(txn.id, txn.createdAt)}</p>
                <p style="margin: 4px 0;"><strong>Staff/Role:</strong> ${txn.cashier?.name || 'Unknown'} (${txn.cashier?.role || 'STAFF'})</p>
                <p style="margin: 4px 0;"><strong>Payment Mode:</strong> ${txn.paymentModeName || 'None'}</p>
                <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(txn.createdAt).toLocaleString()}</p>
                <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;" />
                ${txn.items.map((i: any) => `
                  <div style="margin: 6px 0;">
                    <div style="display: flex; justify-content: space-between;">
                      <span><b>${i.product?.name}</b> x${i.quantity}</span>
                      <span>₱${i.subtotal.toFixed(2)}</span>
                    </div>
                    ${i.stockItems && i.stockItems.length > 0 ? `
                      <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace; margin-top: 2px;">
                        S/Ns: ${i.stockItems.map((s: any) => s.serialNumber).join(', ')}
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
                <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;" />
                <div style="display: flex; justify-content: space-between; margin: 4px 0; font-weight: bold;">
                  <span>Total Charged</span>
                  <span>₱${txn.totalAmount.toFixed(2)}</span>
                </div>
                ${txn.amountTendered !== null ? `
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <span>Amount Tendered</span>
                  <span>₱${txn.amountTendered.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <span>Change</span>
                  <span>₱${txn.changeAmount.toFixed(2)}</span>
                </div>
                ` : ''}
                
                <div style="margin-top: 30px; display: flex; flex-direction: column; gap: 20px;">
                  <div style="text-align: center;">
                    <div style="border-bottom: 1px solid var(--text-muted); width: 80%; margin: 0 auto 4px auto; height: 20px;"></div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Customer Signature</span>
                  </div>
                  <div style="text-align: center;">
                    <div style="border-bottom: 1px solid var(--text-muted); width: 80%; margin: 0 auto 4px auto; height: 20px;"></div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Authorized Cashier: ${txn.cashier?.name || 'Unknown'}</span>
                  </div>
                </div>
              </div>

              <!-- Admin Audit Tab Content -->
              <div id="receipt-audit" class="receipt-tab" style="display: none; font-size: 0.9em;">
                <h4 style="text-align: center; margin: 0 0 4px 0; font-size: 1.1em;">AZTECH POS</h4>
                <p style="text-align: center; margin: 0 0 10px 0; font-size: 0.8em; color: var(--text-muted);">Internal Administration Audit Copy</p>
                <p style="margin: 4px 0;"><strong>Receipt #:</strong> ${generateSeriesNumber(txn.id, txn.createdAt)}</p>
                <p style="margin: 4px 0;"><strong>Cashier ID:</strong> #${txn.cashierId} (${txn.cashier?.name || 'Unknown'})</p>
                <p style="margin: 4px 0;"><strong>Payment Mode:</strong> ${txn.paymentModeName || 'None'} (ID: ${txn.paymentModeId || 'N/A'})</p>
                <p style="margin: 4px 0;"><strong>Transaction ID:</strong> #${txn.id}</p>
                <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(txn.createdAt).toISOString()}</p>
                <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;" />
                
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 10px;">
                  <thead>
                    <tr style="border-bottom: 1px solid var(--border); text-align: left;">
                      <th style="padding: 4px 0;">Product</th>
                      <th style="padding: 4px 0; text-align: right;">Cost</th>
                      <th style="padding: 4px 0; text-align: right;">Retail</th>
                      <th style="padding: 4px 0; text-align: right;">Qty</th>
                      <th style="padding: 4px 0; text-align: right;">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${txn.items.map((i: any) => {
                      const cost = i.product?.costPrice || 0;
                      const retail = i.price || 0;
                      const itemCostTotal = cost * i.quantity;
                      const itemProfit = i.subtotal - itemCostTotal;
                      return `
                        <tr style="border-bottom: 1px dashed var(--border);">
                          <td style="padding: 6px 0;"><b>${i.product?.name}</b></td>
                          <td style="padding: 6px 0; text-align: right;">₱${cost.toFixed(2)}</td>
                          <td style="padding: 6px 0; text-align: right;">₱${retail.toFixed(2)}</td>
                          <td style="padding: 6px 0; text-align: right;">x${i.quantity}</td>
                          <td style="padding: 6px 0; text-align: right; color: ${itemProfit >= 0 ? 'var(--green)' : 'red'};">₱${itemProfit.toFixed(2)}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>

                <div style="border-top: 1px solid var(--border); padding-top: 6px;">
                  <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                    <span>Total Gross Retail</span>
                    <span>₱${(txn.totalAmount + txn.discount).toFixed(2)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                    <span>Total Cost of Goods</span>
                    <span>₱${txn.items.reduce((sum: number, i: any) => sum + (i.product?.costPrice || 0) * i.quantity, 0).toFixed(2)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                    <span>Total Discount Given</span>
                    <span style="color: red;">-₱${txn.discount.toFixed(2)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                    <span>Total VAT collected</span>
                    <span>₱${txn.taxAmount.toFixed(2)}</span>
                  </div>
                  <hr style="border: 0; border-top: 1px dashed var(--border); margin: 6px 0;" />
                  <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em;">
                    <span>Net Profit Margin</span>
                    <span style="color: var(--green);">₱${(
                      txn.totalAmount - 
                      txn.items.reduce((sum: number, i: any) => sum + (i.product?.costPrice || 0) * i.quantity, 0)
                    ).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          `,
                    confirmButtonText: 'Done',
                    confirmButtonColor: 'var(--accent)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    width: 480,
                });

                // Reset state
                setCart([]);
                setDiscount(0);
                // Refresh product stock
                const prodRes = await axios.get('/api/products');
                setProducts(prodRes.data);
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Transaction Failed',
                    text: err.response?.data?.error || 'Something went wrong',
                    background: '#1a1a2e',
                    color: '#eee',
                    confirmButtonColor: '#6c63ff',
                });
            }
        }
    };

    const handleBarcodeInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && search) {
            let matchedProduct = products.find((p) => p.barcode === search);
            let specificSn: string | undefined = undefined;

            if (!matchedProduct) {
                // Try to resolve search as a serial number instead
                for (const p of products) {
                    const match = p.stockItems?.find(
                        (s) => s.serialNumber.toLowerCase() === search.toLowerCase() && s.status === 'AVAILABLE'
                    );
                    if (match) {
                        matchedProduct = p;
                        specificSn = match.serialNumber;
                        break;
                    }
                }
            }

            if (matchedProduct) {
                addToCart(matchedProduct, specificSn);
                setSearch('');
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Not Found',
                    text: `No product or serial number matches: ${search}`,
                    background: '#1a1a2e',
                    color: '#eee',
                    timer: 2000,
                    showConfirmButton: false,
                });
            }
        }
    };

    const startScanner = async () => {
        setShowScanner(true);
        try {
            const { Html5Qrcode } = await import('html5-qrcode');
            const scanner = new Html5Qrcode('barcode-scanner');
            scannerRef.current = scanner;
            await scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 150 } },
                (decodedText) => {
                    let matchedProduct = products.find((p) => p.barcode === decodedText);
                    let specificSn: string | undefined = undefined;

                    if (!matchedProduct) {
                        for (const p of products) {
                            const match = p.stockItems?.find(
                                (s) => s.serialNumber.toLowerCase() === decodedText.toLowerCase() && s.status === 'AVAILABLE'
                            );
                            if (match) {
                                matchedProduct = p;
                                specificSn = match.serialNumber;
                                break;
                            }
                        }
                    }

                    if (matchedProduct) {
                        addToCart(matchedProduct, specificSn);
                        Swal.fire({
                            icon: 'success',
                            title: 'Added!',
                            text: matchedProduct.name + (specificSn ? ` (S/N: ${specificSn})` : ''),
                            timer: 1000,
                            showConfirmButton: false,
                            background: '#1a1a2e',
                            color: '#eee',
                        });
                    }
                },
                () => { }
            );
        } catch (err) {
            console.error('Scanner error:', err);
            setShowScanner(false);
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
            } catch { }
        }
        setShowScanner(false);
    };

    return (
        <div className="pos-page" style={maintenanceMode ? { gridTemplateRows: 'auto 1fr' } : {}}>
            {maintenanceMode && (
                <div style={{
                    gridColumn: '1 / -1',
                    background: 'linear-gradient(90deg, #ff4b4b, #e63946)',
                    color: 'white',
                    padding: '10px 16px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    zIndex: 100
                }}>
                    <span>⚠️ SYSTEM UNDER MAINTENANCE — Price Check / Inventory Check Mode Only (Checkout/Payments Disabled)</span>
                </div>
            )}
            {/* Products Panel */}
            <div className="pos-products">
                <div className="pos-search-bar">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Scan barcode/serial or search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={handleBarcodeInput}
                            autoFocus
                        />
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={showScanner ? stopScanner : startScanner}
                    >
                        {showScanner ? <X size={18} /> : <Camera size={18} />}
                    </button>
                </div>

                {showScanner && (
                    <motion.div
                        className="scanner-container"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <div id="barcode-scanner" />
                    </motion.div>
                )}

                <div className="pos-product-grid">
                    {filteredProducts.map((product) => (
                        <motion.button
                            key={product.id}
                            className="pos-product-btn"
                            onClick={() => addToCart(product)}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            disabled={product.stockQty <= 0}
                        >
                            {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} />
                            ) : (
                                <div className="pos-product-icon"><Barcode size={24} /></div>
                            )}
                            <span className="pos-product-name">{product.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{product.barcode}</span>
                            <span className="pos-product-price">
                                ₱{getPOSUnitPrice(product).toFixed(2)}
                                {product.taxRate > 0 && (
                                    <span style={{
                                        fontSize: '0.65rem',
                                        marginLeft: '6px',
                                        padding: '2px 5px',
                                        borderRadius: '4px',
                                        fontWeight: 'bold',
                                        background: product.taxInclusive ? 'rgba(107, 203, 119, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                                        color: product.taxInclusive ? '#6bcb77' : '#ff6b6b',
                                        border: product.taxInclusive ? '1px solid rgba(107, 203, 119, 0.3)' : '1px solid rgba(255, 107, 107, 0.3)',
                                    }}>
                                        {product.taxInclusive ? 'Incl' : 'Excl'}
                                    </span>
                                )}
                            </span>
                            <span className="pos-product-stock">{product.stockQty} left</span>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Cart Panel */}
            <div className="pos-cart">
                <div className="pos-cart-header" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <ShoppingCart size={20} />
                    <h2 style={{ flexGrow: 1, marginLeft: '8px' }}>Cart</h2>
                    <span className="cart-count" style={{ marginRight: '12px' }}>{cart.length}</span>
                    {cart.length > 0 && (
                        <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border)' }}
                            onClick={async () => {
                                const authorized = await requestAdminAuth();
                                if (!authorized) return;

                                Swal.fire({
                                    title: 'Void Entire Cart?',
                                    text: 'Are you sure you want to void all items in the current transaction?',
                                    icon: 'warning',
                                    showCancelButton: true,
                                    confirmButtonText: 'Yes, Void All',
                                    confirmButtonColor: 'var(--accent)',
                                    cancelButtonColor: 'var(--bg-hover)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)'
                                }).then((res) => {
                                    if (res.isConfirmed) {
                                        setCart([]);
                                        setDiscount(0);
                                    }
                                });
                            }}
                        >
                            Void Cart
                        </button>
                    )}
                </div>

                <div className="pos-cart-items">
                    <AnimatePresence>
                        {cart.length === 0 ? (
                            <div className="empty-cart">
                                <ShoppingCart size={32} />
                                <p>Cart is empty</p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <motion.div
                                    key={item.id}
                                    className="cart-item"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    layout
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px', height: 'auto', padding: '12px' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
                                        <div className="cart-item-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0, margin: 0 }}>
                                            <span className="cart-item-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{item.name}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{item.barcode}</span>
                                            <span className="cart-item-price">
                                                ₱{getPOSUnitPrice(item).toFixed(2)}
                                                {item.taxRate > 0 && (
                                                    <span style={{
                                                        fontSize: '0.6rem',
                                                        marginLeft: '4px',
                                                        padding: '1px 4px',
                                                        borderRadius: '3px',
                                                        fontWeight: 'bold',
                                                        background: item.taxInclusive ? 'rgba(107, 203, 119, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                                                        color: item.taxInclusive ? '#6bcb77' : '#ff6b6b',
                                                        border: item.taxInclusive ? '1px solid rgba(107, 203, 119, 0.2)' : '1px solid rgba(255, 107, 107, 0.2)',
                                                    }}>
                                                        {item.taxInclusive ? 'Incl' : 'Excl'}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="cart-item-controls" style={{ flexShrink: 0 }}>
                                            <button onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button>
                                            <span className="cart-item-qty">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)}><Plus size={14} /></button>
                                            <button className="cart-item-remove" onClick={() => removeFromCart(item.id)} title="Void Item" style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px', border: 'none', background: 'transparent', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', marginLeft: '4px' }}>
                                                <Trash2 size={14} /> <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Void</span>
                                            </button>
                                        </div>
                                         <div className="cart-item-subtotal" style={{ flexShrink: 0, fontWeight: 'bold', textAlign: 'right', minWidth: '70px' }}>
                                             ₱{(getPOSUnitPrice(item) * item.quantity).toFixed(2)}
                                         </div>
                                    </div>

                                    {/* Serial Number Selection Dropdowns */}
                                    {item.selectedSerialNumbers && item.selectedSerialNumbers.length > 0 && (
                                        <div style={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: 'repeat(2, 1fr)', 
                                            gap: '8px', 
                                            marginTop: '12px', 
                                            paddingTop: '12px', 
                                            borderTop: '1px dashed var(--border)' 
                                        }}>
                                            {item.selectedSerialNumbers.map((sn, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, width: '45px', textAlign: 'right' }}>S/N #{idx + 1}:</span>
                                                    <select
                                                        value={sn}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            setCart(prev => prev.map(cItem => {
                                                                if (cItem.id === item.id) {
                                                                    const newSns = [...cItem.selectedSerialNumbers];
                                                                    newSns[idx] = newVal;
                                                                    return { ...cItem, selectedSerialNumbers: newSns };
                                                                }
                                                                return cItem;
                                                            }));
                                                        }}
                                                        style={{ 
                                                            flex: 1,
                                                            fontSize: '0.75rem', 
                                                            padding: '4px 6px', 
                                                            background: 'var(--bg-primary)', 
                                                            border: '1px solid var(--border)', 
                                                            color: 'var(--text-primary)', 
                                                            borderRadius: '4px',
                                                            minWidth: 0,
                                                            outline: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <option value={sn} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{sn}</option>
                                                        {item.stockItems?.filter(s => s.status === 'AVAILABLE' && !item.selectedSerialNumbers.includes(s.serialNumber)).map(s => (
                                                            <option key={s.id} value={s.serialNumber} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{s.serialNumber}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>

                <div className="pos-cart-footer">
                    <div className="cart-discount">
                        <label>Discount (₱)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={discount || ''}
                            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="cart-totals">
                        <div className="cart-total-row">
                            <span>Subtotal</span>
                            <span>₱{netSubtotal.toFixed(2)}</span>
                        </div>
                        {exclusiveTaxAmount > 0 && (
                            <div className="cart-total-row">
                                <span>VAT (Exclusive)</span>
                                <span>₱{exclusiveTaxAmount.toFixed(2)}</span>
                            </div>
                        )}
                        {taxAmount - exclusiveTaxAmount > 0 && (
                            <div className="cart-total-row" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                <span>VAT Included</span>
                                <span>₱{(taxAmount - exclusiveTaxAmount).toFixed(2)}</span>
                            </div>
                        )}
                        {discount > 0 && (
                            <div className="cart-total-row discount-row">
                                <span>Discount</span>
                                <span>-₱{discount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="cart-total-row total-row">
                            <span>Total</span>
                            <span>₱{total.toFixed(2)}</span>
                        </div>
                    </div>
                    <motion.button
                        className={`btn ${maintenanceMode ? 'btn-secondary' : 'btn-checkout'}`}
                        onClick={maintenanceMode ? undefined : handleCheckout}
                        whileHover={maintenanceMode ? {} : { scale: 1.02 }}
                        whileTap={maintenanceMode ? {} : { scale: 0.98 }}
                        disabled={cart.length === 0 || !!maintenanceMode}
                        style={maintenanceMode ? { opacity: 0.6, cursor: 'not-allowed', backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)' } : {}}
                    >
                        <CreditCard size={20} />
                        {maintenanceMode ? 'Price Check Mode Only' : 'Process Payment'}
                    </motion.button>
                </div>
            </div>
        </div>
    );
}

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
    Clock,
    Send,
    List,
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
    categoryId?: number;
    category: { id?: number; name: string };
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
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

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
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [discountType, setDiscountType] = useState<string>('FIXED');
    const [discountValue, setDiscountValue] = useState<number>(0);
    const [showScanner, setShowScanner] = useState(false);
    const [paymentModes, setPaymentModes] = useState<any[]>([]);
    const [promotions, setPromotions] = useState<any[]>([]);
    const [queuedTransactions, setQueuedTransactions] = useState<any[]>([]);
    const [showQueueModal, setShowQueueModal] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const scannerRef = useRef<any>(null);

    const fetchQueue = () => {
        axios.get('/api/transactions?status=PENDING').then((r) => setQueuedTransactions(r.data));
    };

    useEffect(() => {
        axios.get('/api/products').then((r) => setProducts(r.data));
        axios.get('/api/payment-modes?active=true').then((r) => setPaymentModes(r.data));
        axios.get('/api/customers').then((r) => setCustomers(r.data));
        axios.get('/api/promotions').then((r) => setPromotions(r.data.filter((p: any) => p.isActive)));
        if (user?.role !== 'STAFF') {
            fetchQueue();
            const interval = setInterval(fetchQueue, 10000); // refresh queue every 10s
            return () => clearInterval(interval);
        }
    }, [user]);

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

    const autoDiscount = cart.reduce((sum, item) => {
        let itemDiscount = 0;
        const retail = item.retailPrice > 0 ? item.retailPrice : item.price;
        const matchingPromo = promotions.find(p => p.targetType === 'ALL' || (p.targetType === 'PRODUCT' && p.targetId === item.id) || (p.targetType === 'CATEGORY' && (p.targetId === item.categoryId || p.targetId === item.category?.id)));
        
        if (matchingPromo) {
            if (matchingPromo.type === 'PERCENTAGE') {
                itemDiscount += (retail * (matchingPromo.value / 100)) * item.quantity;
            } else if (matchingPromo.type === 'FIXED') {
                itemDiscount += matchingPromo.value * item.quantity;
            }
        }
        return sum + itemDiscount;
    }, 0);

    const subtotal = netSubtotal + exclusiveTaxAmount;
    const manualDiscount = discountType === 'PERCENTAGE' ? (subtotal * discountValue) / 100 : discountValue;
    const discount = manualDiscount + autoDiscount;
    const total = subtotal - discount;

    const handleQueue = async () => {
        if (cart.length === 0) return;

        const { value: queueNumber } = await Swal.fire({
            title: 'Customer Name / Number',
            input: 'text',
            inputPlaceholder: 'e.g. John or 14',
            showCancelButton: true,
            confirmButtonText: 'Send to Cashier',
            confirmButtonColor: 'var(--accent)',
            cancelButtonColor: 'var(--bg-hover)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            inputValidator: (value) => {
                if (!value) {
                    return 'Please enter a name or number!';
                }
            }
        });

        if (!queueNumber) return;

        try {
            await axios.post('/api/transactions/queue', {
                items: cart.map((item) => ({
                    productId: item.id,
                    quantity: item.quantity,
                })),
                discount,
                discountType,
                discountValue,
                customerId: selectedCustomerId,
                queueNumber
            });

            Swal.fire({
                icon: 'success',
                title: 'Sent to Cashier',
                text: 'Order has been queued successfully.',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                timer: 2000,
                showConfirmButton: false,
            });

            setCart([]);
            setDiscountValue(0);
            setSelectedCustomerId(null);
        } catch (err: any) {
            Swal.fire({
                icon: 'error',
                title: 'Failed to Queue',
                text: err.response?.data?.error || 'Something went wrong',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
            });
        }
    };

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
          
          <label style="display: block; margin-bottom: 6px; font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">Payments</label>
          <div id="swal-payments-container">
            <div class="swal-payment-row" style="display:flex; gap:8px; margin-bottom:8px;">
                <select class="swal-pmode" style="flex:1; padding: 10px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; outline: none; cursor: pointer;">
                ${paymentModes.length === 0
                    ? '<option value="" style="background: var(--bg-secondary); color: var(--text-primary);">(No Payment Modes)</option>'
                    : paymentModes.map(pm => `<option value="${pm.id}" style="background: var(--bg-secondary); color: var(--text-primary);">${pm.name}</option>`).join('')}
                </select>
                <input type="number" class="swal-pamt" step="0.01" value="${total.toFixed(2)}" style="flex:1; padding: 10px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; outline: none; box-sizing: border-box;" />
            </div>
          </div>
          <button type="button" id="swal-add-payment" style="width: 100%; padding: 8px; background: var(--bg-hover); color: var(--text-primary); border: 1px dashed var(--border); border-radius: var(--radius-sm); cursor: pointer; margin-bottom: 12px; font-weight: bold;">+ Split Payment</button>

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
            didOpen: () => {
                const addBtn = document.getElementById('swal-add-payment');
                const container = document.getElementById('swal-payments-container');
                const changeEl = document.getElementById('swal-change-amount');
                const t = total;

                const calcChange = () => {
                    const inputs = document.querySelectorAll('.swal-pamt');
                    let sum = 0;
                    inputs.forEach(input => sum += (parseFloat((input as HTMLInputElement).value) || 0));
                    const change = sum >= t ? sum - t : 0;
                    if(changeEl) changeEl.innerText = '₱' + change.toFixed(2);
                };

                const bindInputs = () => {
                    document.querySelectorAll('.swal-pamt').forEach(input => {
                        input.removeEventListener('input', calcChange);
                        input.addEventListener('input', calcChange);
                    });
                };
                bindInputs();
                calcChange();

                if(addBtn && container) {
                    addBtn.addEventListener('click', () => {
                        const row = document.createElement('div');
                        row.className = 'swal-payment-row';
                        row.style.cssText = 'display:flex; gap:8px; margin-bottom:8px;';
                        row.innerHTML = `
                            <select class="swal-pmode" style="flex:1; padding: 10px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); outline: none;">
                                ${paymentModes.map(pm => `<option value="${pm.id}">${pm.name}</option>`).join('')}
                            </select>
                            <input type="number" class="swal-pamt" step="0.01" placeholder="Amount" style="flex:1; padding: 10px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); outline: none; box-sizing: border-box;" />
                            <button type="button" onclick="this.parentElement.remove(); document.querySelector('.swal-pamt').dispatchEvent(new Event('input'));" style="padding: 10px; background: var(--bg-hover); color: #ff4b4b; border: none; border-radius: var(--radius-sm); cursor: pointer;">X</button>
                        `;
                        container.appendChild(row);
                        bindInputs();
                    });
                }
            },
            preConfirm: () => {
                const rows = document.querySelectorAll('.swal-payment-row');
                const payments: { paymentModeId: string, paymentModeName: string, amount: number }[] = [];
                let totalTendered = 0;

                rows.forEach(row => {
                    const select = row.querySelector('.swal-pmode') as HTMLSelectElement;
                    const input = row.querySelector('.swal-pamt') as HTMLInputElement;
                    const amount = parseFloat(input.value) || 0;
                    
                    if(amount > 0) {
                        payments.push({
                            paymentModeId: select.value,
                            paymentModeName: select.options[select.selectedIndex]?.text || 'Unknown',
                            amount
                        });
                        totalTendered += amount;
                    }
                });

                if (payments.length === 0) {
                    Swal.showValidationMessage('Please enter at least one payment amount.');
                    return false;
                }

                if (totalTendered < total - 0.001) {
                    Swal.showValidationMessage(`Total tendered (₱${totalTendered.toFixed(2)}) is less than total due (₱${total.toFixed(2)}).`);
                    return false;
                }

                const changeAmount = totalTendered - total;
                return { payments, amountTendered: totalTendered, changeAmount };
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
                    discountType,
                    discountValue,
                    customerId: selectedCustomerId,
                    payments: result.value.payments,
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
                setDiscountValue(0);
                setSelectedCustomerId(null);
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
                <div className="pos-cart-header" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
                    <ShoppingCart size={20} />
                    <h2 style={{ flexGrow: 1, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Cart
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal', fontFamily: 'monospace', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            {currentTime.toLocaleTimeString()}
                        </span>
                    </h2>

                    {user?.role !== 'STAFF' && (
                        <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border)', position: 'relative' }}
                            onClick={() => { setShowQueueModal(true); fetchQueue(); }}
                        >
                            <List size={14} /> Queue
                            {queuedTransactions.length > 0 && (
                                <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--accent)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                                    {queuedTransactions.length}
                                </span>
                            )}
                        </button>
                    )}

                    <span className="cart-count">{cart.length}</span>
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
                                        setDiscountValue(0);
                                        setSelectedCustomerId(null);
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
                                                    <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
                                                        <input
                                                            list={`sn-list-${item.id}-${idx}`}
                                                            value={sn}
                                                            placeholder="Type or search S/N..."
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
                                                                outline: 'none'
                                                            }}
                                                        />
                                                        <datalist id={`sn-list-${item.id}-${idx}`}>
                                                            {item.stockItems?.filter(s => s.status === 'AVAILABLE' && (!item.selectedSerialNumbers.includes(s.serialNumber) || s.serialNumber === sn)).map(s => (
                                                                <option key={s.id} value={s.serialNumber} />
                                                            ))}
                                                        </datalist>
                                                    </div>
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
                    <div className="cart-discount" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Customer</label>
                                <select 
                                    className="input" 
                                    value={selectedCustomerId || ''} 
                                    onChange={(e) => setSelectedCustomerId(e.target.value ? parseInt(e.target.value) : null)}
                                    style={{ padding: '6px', fontSize: '0.9rem', width: '100%' }}
                                >
                                    <option value="">Guest (No Customer)</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Discount Type</label>
                                <select 
                                    className="input" 
                                    value={discountType} 
                                    onChange={(e) => setDiscountType(e.target.value)}
                                    style={{ padding: '6px', fontSize: '0.9rem', width: '100%' }}
                                >
                                    <option value="FIXED">Fixed (₱)</option>
                                    <option value="PERCENTAGE">Percentage (%)</option>
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Value</label>
                                <input
                                    type="number"
                                    className="input"
                                    min="0"
                                    step="0.01"
                                    value={discountValue || ''}
                                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    style={{ padding: '6px', fontSize: '0.9rem', width: '100%' }}
                                />
                            </div>
                        </div>
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
                        {autoDiscount > 0 && (
                            <div className="cart-total-row discount-row" style={{ color: 'var(--accent)' }}>
                                <span>Promo Discount</span>
                                <span>-₱{autoDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        {manualDiscount > 0 && (
                            <div className="cart-total-row discount-row">
                                <span>Manual Discount</span>
                                <span>-₱{manualDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="cart-total-row total-row">
                            <span>Total</span>
                            <span>₱{total.toFixed(2)}</span>
                        </div>
                    </div>
                    {user?.role === 'STAFF' ? (
                        <motion.button
                            className="btn btn-accent"
                            onClick={handleQueue}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={cart.length === 0}
                            style={{ width: '100%', padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 'bold' }}
                        >
                            <Send size={20} />
                            Send to Cashier
                        </motion.button>
                    ) : (
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
                    )}
                </div>
            </div>

            {/* Queue Modal for Cashier/Admin */}
            <AnimatePresence>
                {showQueueModal && (
                    <div className="modal-overlay" onClick={() => setShowQueueModal(false)} style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.div
                            className="modal-content"
                            onClick={e => e.stopPropagation()}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            style={{ background: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={24} /> Pending Queue</h2>
                                <button className="btn-icon" onClick={() => setShowQueueModal(false)}><X size={24} /></button>
                            </div>

                            {queuedTransactions.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No pending orders in the queue.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {queuedTransactions.map(txn => (
                                        <div key={txn.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', background: 'var(--bg-secondary)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <div>
                                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: 'var(--accent)' }}>
                                                        {txn.paymentModeName?.startsWith('Queue: ') ? txn.paymentModeName.replace('Queue: ', 'Customer: ') : `Order #${txn.id}`}
                                                    </h3>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>From: {txn.cashier?.name} • {new Date(txn.createdAt).toLocaleTimeString()}</span>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 'bold', color: 'var(--green)', fontSize: '1.1rem' }}>₱{(txn.totalAmount + txn.discount).toFixed(2)}</div>
                                                    {txn.discount > 0 && <div style={{ fontSize: '0.75rem', color: 'red' }}>Disc: -₱{txn.discount.toFixed(2)}</div>}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '16px' }}>
                                                {txn.items.map((i: any, idx: number) => (
                                                    <div key={idx}>• {i.quantity}x {i.product?.name}</div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#ff4b4b' }}
                                                    onClick={async () => {
                                                        if (await Swal.fire({ title: 'Remove?', icon: 'warning', showCancelButton: true }).then(r => r.isConfirmed)) {
                                                            await axios.delete(`/api/transactions/${txn.id}`);
                                                            fetchQueue();
                                                        }
                                                    }}
                                                >
                                                    <Trash2 size={14} /> Remove
                                                </button>
                                                <button
                                                    className="btn btn-primary"
                                                    style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                                                    onClick={async () => {
                                                        // Load items into cart
                                                        const newCart: any[] = [];
                                                        for (const i of txn.items) {
                                                            // We just push the product with quantity. Sn selection will be auto later or skipped.
                                                            newCart.push({
                                                                ...i.product,
                                                                quantity: i.quantity,
                                                                selectedSerialNumbers: []
                                                            });
                                                        }
                                                        setCart(newCart);
                                                        setDiscountType(txn.discountType || 'FIXED');
                                                        setDiscountValue(txn.discountValue || txn.discount);
                                                        setSelectedCustomerId(txn.customerId || null);
                                                        setShowQueueModal(false);
                                                        // Delete it from queue since we're picking it up
                                                        await axios.delete(`/api/transactions/${txn.id}`);
                                                        fetchQueue();
                                                    }}
                                                >
                                                    Load Order
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

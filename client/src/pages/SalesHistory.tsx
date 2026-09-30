import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Search, Receipt, Calendar, Eye, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

interface Transaction {
    id: number;
    cashierId: number;
    totalAmount: number;
    taxAmount: number;
    discount: number;
    paymentModeId?: number | null;
    paymentModeName?: string | null;
    amountTendered?: number | null;
    changeAmount?: number | null;
    status: string;
    createdAt: string;
    cashier: { name: string; email: string; role: string };
    items: Array<{
        id: number;
        quantity: number;
        price: number;
        subtotal: number;
        product: { name: string; barcode: string; costPrice?: number };
        stockItems?: Array<{ id: number; serialNumber: string }>;
    }>;
}

const generateSeriesNumber = (txnId: number, dateStr: string) => {
    const date = new Date(dateStr);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const formattedId = String(txnId).padStart(5, '0');
    return `AP-${yyyy}${mm}${dd}-${formattedId}`;
};

export default function SalesHistory() {
    const { user } = useAuth();
    const { hasPosPin, posPinLength } = useBranding();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchTransactions = () => {
        setLoading(true);
        axios
            .get('/api/transactions')
            .then((r) => setTransactions(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const filtered = transactions.filter(
        (t) =>
            t.id.toString().includes(search) ||
            generateSeriesNumber(t.id, t.createdAt).toLowerCase().includes(search.toLowerCase()) ||
            t.cashier.name.toLowerCase().includes(search.toLowerCase()) ||
            t.items.some((i) =>
                i.product.name.toLowerCase().includes(search.toLowerCase()) ||
                i.product.barcode.includes(search)
            )
    );

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

    const handleVoidTransaction = async (txnId: number) => {
        const authorized = await requestAdminAuth();
        if (!authorized) return;

        Swal.fire({
            title: 'Void Transaction?',
            text: 'Are you sure you want to void this transaction? This will restore the product stock quantities and release their serial numbers.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, Void Transaction',
            confirmButtonColor: 'var(--red)',
            cancelButtonColor: 'var(--bg-hover)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await axios.post(`/api/transactions/${txnId}/void`);
                    Swal.fire({
                        icon: 'success',
                        title: 'Voided!',
                        text: 'Transaction has been voided successfully.',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        confirmButtonColor: 'var(--accent)'
                    });
                    fetchTransactions();
                } catch (err: any) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Void Failed',
                        text: err.response?.data?.error || 'Something went wrong',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        confirmButtonColor: 'var(--accent)'
                    });
                }
            }
        });
    };

    const viewReceipt = (txn: Transaction) => {
        Swal.fire({
            title: `Receipt Details`,
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
            <p style="text-align: center; margin: 0 0 10px 0; font-size: 0.8em; color: var(--text-muted);">${txn.status === 'VOIDED' ? 'VOIDED TRANSACTION' : 'Customer Copy'}</p>
            <p style="margin: 4px 0;"><strong>Receipt #:</strong> ${generateSeriesNumber(txn.id, txn.createdAt)}</p>
            <p style="margin: 4px 0;"><strong>Cashier:</strong> ${txn.cashier?.name || 'Unknown'}</p>
            <p style="margin: 4px 0;"><strong>Payment Mode:</strong> ${txn.paymentModeName || 'None'}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(txn.createdAt).toLocaleString()}</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> <span style="font-weight: bold; color: ${txn.status === 'VOIDED' ? 'red' : 'var(--green)'};">${txn.status}</span></p>
            <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;" />
            ${txn.items.map((i) => `
              <div style="margin: 6px 0;">
                <div style="display: flex; justify-content: space-between;">
                  <span><b>${i.product?.name}</b> x${i.quantity}</span>
                  <span>₱${i.subtotal.toFixed(2)}</span>
                </div>
                ${i.stockItems && i.stockItems.length > 0 ? `
                  <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace; margin-top: 2px;">
                    S/Ns: ${i.stockItems.map((s) => s.serialNumber).join(', ')}
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
            ${txn.amountTendered !== null && txn.amountTendered !== undefined ? `
            <div style="display: flex; justify-content: space-between; margin: 4px 0;">
              <span>Amount Tendered</span>
              <span>₱${txn.amountTendered.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 4px 0;">
              <span>Change</span>
              <span>₱${(txn.changeAmount || 0).toFixed(2)}</span>
            </div>
            ` : ''}
          </div>

          <!-- Cashier/Staff Tab Content -->
          <div id="receipt-merchant" class="receipt-tab" style="display: none; font-size: 0.9em;">
            <h4 style="text-align: center; margin: 0 0 4px 0; font-size: 1.1em;">AZTECH POS</h4>
            <p style="text-align: center; margin: 0 0 10px 0; font-size: 0.8em; color: var(--text-muted);">${txn.status === 'VOIDED' ? 'VOIDED TRANSACTION' : 'Merchant/Staff Copy'}</p>
            <p style="margin: 4px 0;"><strong>Receipt #:</strong> ${generateSeriesNumber(txn.id, txn.createdAt)}</p>
            <p style="margin: 4px 0;"><strong>Staff/Role:</strong> ${txn.cashier?.name || 'Unknown'} (${txn.cashier?.role || 'STAFF'})</p>
            <p style="margin: 4px 0;"><strong>Payment Mode:</strong> ${txn.paymentModeName || 'None'}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(txn.createdAt).toLocaleString()}</p>
            <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;" />
            ${txn.items.map((i) => `
              <div style="margin: 6px 0;">
                <div style="display: flex; justify-content: space-between;">
                  <span><b>${i.product?.name}</b> x${i.quantity}</span>
                  <span>₱${i.subtotal.toFixed(2)}</span>
                </div>
                ${i.stockItems && i.stockItems.length > 0 ? `
                  <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace; margin-top: 2px;">
                    S/Ns: ${i.stockItems.map((s) => s.serialNumber).join(', ')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
            <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;" />
            <div style="display: flex; justify-content: space-between; margin: 4px 0; font-weight: bold;">
              <span>Total Charged</span>
              <span>₱${txn.totalAmount.toFixed(2)}</span>
            </div>
            ${txn.amountTendered !== null && txn.amountTendered !== undefined ? `
            <div style="display: flex; justify-content: space-between; margin: 4px 0;">
              <span>Amount Tendered</span>
              <span>₱${txn.amountTendered.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 4px 0;">
              <span>Change</span>
              <span>₱${(txn.changeAmount || 0).toFixed(2)}</span>
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
                ${txn.items.map((i) => {
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
            confirmButtonText: 'Close',
            confirmButtonColor: 'var(--accent)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            width: 480,
        });
    };

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1>Sales History</h1>
                    <p>{transactions.length} transactions</p>
                </div>
            </div>

            <div className="filters-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search by series #, cashier, product..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <Receipt size={48} />
                    <h3>No transactions found</h3>
                </div>
            ) : (
                <motion.div
                    className="card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Receipt Series</th>
                                    <th>Cashier</th>
                                    <th>Items</th>
                                    <th>Discount</th>
                                    <th>Total</th>
                                    <th>Payment Mode</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((txn) => (
                                    <tr key={txn.id} style={{ opacity: txn.status === 'VOIDED' ? 0.6 : 1 }}>
                                        <td><strong>{generateSeriesNumber(txn.id, txn.createdAt)}</strong></td>
                                        <td>
                                            {txn.cashier.name}
                                            <span style={{ fontSize: '0.65rem', marginLeft: '6px', padding: '2px 4px', background: 'var(--bg-hover)', color: 'var(--text-secondary)', borderRadius: '3px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                                {txn.cashier.role}
                                            </span>
                                        </td>
                                        <td>{txn.items.length} items</td>
                                        <td>{txn.discount > 0 ? <span className="text-red">-₱{txn.discount.toFixed(2)}</span> : '-'}</td>
                                        <td>
                                            <span className={txn.status === 'VOIDED' ? 'text-red' : 'text-green'} style={{ textDecoration: txn.status === 'VOIDED' ? 'line-through' : 'none' }}>
                                                ₱{txn.totalAmount.toFixed(2)}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.85rem', padding: '4px 8px', background: 'rgba(108, 99, 255, 0.15)', color: '#a29bfe', borderRadius: '4px', border: '1px solid rgba(108, 99, 255, 0.3)' }}>
                                                {txn.paymentModeName || 'None'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="date-cell">
                                                <Calendar size={14} />
                                                {new Date(txn.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td>
                                            {txn.status === 'VOIDED' ? (
                                                <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255, 107, 107, 0.15)', color: '#ff6b6b', borderRadius: '4px', border: '1px solid rgba(255, 107, 107, 0.3)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                                    Voided
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(107, 203, 119, 0.15)', color: '#2b8a3e', borderRadius: '4px', border: '1px solid rgba(107, 203, 119, 0.3)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                                    Completed
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button className="btn-icon btn-view" onClick={() => viewReceipt(txn)} title="View Receipt Copies">
                                                    <Eye size={16} />
                                                </button>
                                                {(user?.role === 'ADMIN' || user?.role === 'STAFF') && txn.status !== 'VOIDED' && (
                                                    <button className="btn-icon btn-delete" onClick={() => handleVoidTransaction(txn.id)} title="Void Transaction">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

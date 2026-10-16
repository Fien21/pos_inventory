import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBranding } from '../context/BrandingContext';
import Swal from 'sweetalert2';
import { Save, Upload, Trash2, Shield, MonitorSmartphone, XCircle } from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import axios from 'axios';

export default function Settings() {
    const { name, subtitle, logoIcon, logoUrl, posPinLength, hasPosPin, emailDomain, maintenanceMode, receiptFooter, receiptPolicy, updateSettings } = useBranding();
    const [appName, setAppName] = useState(name);
    const [appSubtitle, setAppSubtitle] = useState(subtitle);
    const [appLogoIcon, setAppLogoIcon] = useState(logoIcon);
    const [maintenanceModeState, setMaintenanceModeState] = useState<boolean>(maintenanceMode || false);
    const [receiptFooterState, setReceiptFooterState] = useState<string>(receiptFooter || '');
    const [receiptPolicyState, setReceiptPolicyState] = useState<string>(receiptPolicy || '');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl);
    const [removeLogo, setRemoveLogo] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // POS PIN states
    const [pinLength, setPinLength] = useState<number>(posPinLength || 4);
    const [pinValue, setPinValue] = useState<string>('');
    const [shouldClearPin, setShouldClearPin] = useState<boolean>(false);

    // Default Email Domain state
    const [domainName, setDomainName] = useState<string>(emailDomain || 'shadow.com');

    // Break Time Limit
    const [breakTimeLimit, setBreakTimeLimit] = useState<number>(() => {
        const limit = localStorage.getItem('shadow-apollo-break-limit');
        return limit ? parseInt(limit) : 15;
    });

    // Device Management
    const { expiry, clientInfo, deviceId: currentDeviceId } = useLicense();
    const [registeredDevices, setRegisteredDevices] = useState<any[]>([]);
    const [loadingDevices, setLoadingDevices] = useState(false);

    const fetchDevices = async () => {
        try {
            setLoadingDevices(true);
            const res = await axios.get('/api/license/devices');
            if (res.data.success) {
                setRegisteredDevices(res.data.devices);
            }
        } catch (error) {
            console.error('Failed to fetch devices', error);
        } finally {
            setLoadingDevices(false);
        }
    };

    useEffect(() => {
        fetchDevices();
    }, []);

    const revokeDevice = async (id: string) => {
        const result = await Swal.fire({
            title: 'Revoke Device Access?',
            text: 'If you revoke this device, it will immediately lose access to the POS and will require the license key to re-register.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: 'var(--bg-hover)',
            confirmButtonText: 'Yes, Revoke Access'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`/api/license/devices/${id}`);
                Swal.fire('Revoked!', 'The device has been revoked.', 'success');
                fetchDevices();
                
                // If they revoked themselves, reload page to trigger lockout
                if (id === currentDeviceId) {
                    window.location.reload();
                }
            } catch (error) {
                Swal.fire('Error', 'Failed to revoke device.', 'error');
            }
        }
    };

    // Sync state when context values load
    useEffect(() => {
        setAppName(name);
        setAppSubtitle(subtitle);
        setAppLogoIcon(logoIcon);
        setLogoPreview(logoUrl);
        setPinLength(posPinLength || 4);
        setDomainName(emailDomain || 'shadow.com');
        setMaintenanceModeState(maintenanceMode || false);
        setReceiptFooterState(receiptFooter || '');
        setReceiptPolicyState(receiptPolicy || '');
    }, [name, subtitle, logoIcon, logoUrl, posPinLength, emailDomain, maintenanceMode, receiptFooter, receiptPolicy]);

    // Cleanup object URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            if (logoPreview && logoPreview.startsWith('blob:')) {
                URL.revokeObjectURL(logoPreview);
            }
        };
    }, [logoPreview]);

    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith('image/')) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid File',
                text: 'Please upload an image file.',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                confirmButtonColor: 'var(--accent)',
            });
            return;
        }
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
        setRemoveLogo(false);
    };

    const handleRemoveLogo = () => {
        setLogoFile(null);
        setLogoPreview(null);
        setRemoveLogo(true);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClearData = async () => {
        const result = await Swal.fire({
            title: 'Are you absolutely sure?',
            text: 'This will PERMANENTLY DELETE all products, categories, transactions, stock items, and audit logs. You cannot undo this!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: 'var(--bg-hover)',
            confirmButtonText: 'Yes, DELETE ALL DATA',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                await axios.post('/api/settings/clear-data', {});
                
                await Swal.fire({
                    icon: 'success',
                    title: 'Data Cleared!',
                    text: 'All product and transaction data has been removed.',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    confirmButtonColor: 'var(--accent)',
                });
                
                // Force a page reload so state/cache is cleared across the dashboard and POS
                window.location.reload();
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Failed to Clear Data',
                    text: err.response?.data?.error || 'An error occurred.',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    confirmButtonColor: 'var(--accent)',
                });
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        // Validate PIN length if a new PIN value is provided
        if (pinValue && pinValue.length !== pinLength) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid PIN Length',
                text: `Please enter a valid ${pinLength}-digit PIN.`,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                confirmButtonColor: 'var(--accent)',
            });
            setSaving(false);
            return;
        }

        try {
            // Determine PIN payload
            let targetPin: string | null | undefined = undefined;
            if (shouldClearPin) {
                targetPin = ''; // Clearing PIN
            } else if (pinValue) {
                targetPin = pinValue;
            }

            // Sanitize email domain
            let cleanDomain = domainName.trim().toLowerCase();
            if (cleanDomain.startsWith('@')) {
                cleanDomain = cleanDomain.substring(1);
            }
            if (!cleanDomain) {
                cleanDomain = 'shadow.com';
            }

            // Save break time limit to localStorage (since it's a frontend enforced rule for now)
            localStorage.setItem('shadow-apollo-break-limit', breakTimeLimit.toString());
            window.dispatchEvent(new Event('storage')); // Trigger update across components

            await updateSettings(appName, appSubtitle, appLogoIcon, logoFile, removeLogo, targetPin, pinLength, cleanDomain, maintenanceModeState, receiptFooterState, receiptPolicyState);
            
            await Swal.fire({
                icon: 'success',
                title: 'Settings Saved!',
                text: 'System settings have been updated successfully.',
                timer: 1500,
                showConfirmButton: false,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
            });

            setLogoFile(null);
            setPinValue('');
            setShouldClearPin(false);
        } catch (err: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.response?.data?.error || 'Something went wrong',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                confirmButtonColor: 'var(--accent)',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">System Settings</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Configure global application branding and security</p>
                </div>
            </header>
            <main className="flex-1 p-5 overflow-y-auto w-full">

            <motion.div
                className="card form-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ maxWidth: '600px', margin: '0 auto' }}
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="form-group">
                        <label>Application Name *</label>
                        <input
                            type="text"
                            value={appName}
                            onChange={(e) => setAppName(e.target.value)}
                            required
                            placeholder="e.g. Shadow Apollo"
                        />
                    </div>

                    <div className="form-group">
                        <label>Subtitle / Description *</label>
                        <input
                            type="text"
                            value={appSubtitle}
                            onChange={(e) => setAppSubtitle(e.target.value)}
                            required
                            placeholder="e.g. Inventory & POS System"
                        />
                    </div>

                    <div className="form-group">
                        <label>Custom Brand Logo Image</label>
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragActive(true);
                            }}
                            onDragLeave={() => setIsDragActive(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragActive(false);
                                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                    handleFileSelect(e.dataTransfer.files[0]);
                                }
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: isDragActive ? '2px dashed var(--accent)' : '2px dashed var(--border)',
                                borderRadius: '8px',
                                padding: '30px',
                                textAlign: 'center',
                                background: isDragActive ? 'var(--bg-hover)' : 'var(--bg-primary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px'
                            }}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        handleFileSelect(e.target.files[0]);
                                    }
                                }}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                            
                            {logoPreview ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                                    <img
                                        src={logoPreview}
                                        alt="Logo Preview"
                                        style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border)' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={handleRemoveLogo}
                                        style={{ color: '#ff4d4d', padding: '4px 8px', fontSize: '0.9em' }}
                                    >
                                        <Trash2 size={16} /> Remove Custom Logo
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Upload size={32} style={{ color: 'var(--accent)' }} />
                                    <div>
                                        <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Click to upload</span> or drag and drop
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8em' }}>PNG, JPG, SVG, or WEBP (max. 5MB)</div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Fallback Logo Icon (Emoji or single character) *</label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                                type="text"
                                maxLength={2}
                                value={appLogoIcon}
                                onChange={(e) => setAppLogoIcon(e.target.value)}
                                required
                                placeholder="⚡"
                                style={{ width: '80px', textAlign: 'center', fontSize: '1.5em' }}
                            />
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>
                                Used if no custom brand image logo is uploaded above.
                            </div>
                        </div>
                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {['⚡', '🏪', '📦', '🛍️', '💻', '💼', '🚀', '🛒', '💰'].map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => setAppLogoIcon(emoji)}
                                    style={{
                                        padding: '8px 12px',
                                        background: appLogoIcon === emoji ? 'var(--accent)' : 'var(--bg-primary)',
                                        color: appLogoIcon === emoji ? '#fff' : 'var(--text-primary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '1.2em',
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    <hr style={{ border: '0', borderTop: '1px solid var(--border)', margin: '10px 0' }} />
                    
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Default Email Suffix</h3>
                    
                    <div className="form-group">
                        <label>Default Email Domain for Cashiers/Users</label>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ padding: '10px 12px', background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: '1rem' }}>@</span>
                            <input
                                type="text"
                                value={domainName}
                                onChange={(e) => setDomainName(e.target.value)}
                                placeholder="e.g. shadow.com"
                                style={{ borderRadius: '0 8px 8px 0' }}
                            />
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                            New users created without an email suffix will automatically be assigned this domain.
                        </p>
                    </div>

                    <hr style={{ border: '0', borderTop: '1px solid var(--border)', margin: '10px 0' }} />
                    
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>POS Security PIN Setup</h3>
                    
                    <div className="form-group">
                        <label>PIN Code Digits</label>
                        <select 
                            value={pinLength} 
                            onChange={(e) => {
                                const len = Number(e.target.value);
                                setPinLength(len);
                                setPinValue('');
                            }}
                        >
                            <option value="4">4-Digit PIN</option>
                            <option value="6">6-Digit PIN</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Admin POS PIN Code</label>
                        <input
                            type="password"
                            maxLength={pinLength}
                            value={pinValue}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d+$/.test(val)) {
                                    setPinValue(val);
                                }
                            }}
                            placeholder={hasPosPin ? "•••••••• (PIN Configured)" : `Enter ${pinLength}-digit PIN`}
                        />
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                            {hasPosPin 
                                ? "A POS security PIN is currently active. To update it, type a new PIN. To keep it, leave this field blank."
                                : "If set, cashiers will be prompted for this PIN (or the Admin's login password) when performing Void actions."
                            }
                        </p>
                    </div>

                    {hasPosPin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                                type="checkbox" 
                                id="clear-pin-checkbox" 
                                checked={shouldClearPin} 
                                onChange={(e) => {
                                    setShouldClearPin(e.target.checked);
                                    if (e.target.checked) setPinValue('');
                                }}
                            />
                            <label htmlFor="clear-pin-checkbox" style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                Remove POS PIN security verification (Allow any cashier to void without auth)
                            </label>
                        </div>
                    )}

                    <hr style={{ border: '0', borderTop: '1px solid var(--border)', margin: '10px 0' }} />
                    
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>System Maintenance Mode</h3>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <input 
                            type="checkbox" 
                            id="maintenance-mode-checkbox" 
                            checked={maintenanceModeState} 
                            onChange={(e) => setMaintenanceModeState(e.target.checked)}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label htmlFor="maintenance-mode-checkbox" style={{ fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer', color: 'var(--text-primary)' }}>
                                Enable Inventory Check / Price Check Only Mode
                            </label>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                When enabled, cashiers can search products and check prices, but payment processing (checkout) is disabled.
                            </span>
                        </div>
                    </div>

                    <hr style={{ border: '0', borderTop: '1px solid var(--border)', margin: '10px 0' }} />
                    
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Break Rules & Time limits</h3>
                    
                    <div className="form-group">
                        <label>Maximum Break Time (Minutes)</label>
                        <input
                            type="number"
                            min="1"
                            max="120"
                            value={breakTimeLimit}
                            onChange={(e) => setBreakTimeLimit(parseInt(e.target.value) || 15)}
                            placeholder="e.g. 15"
                            style={{ maxWidth: '200px' }}
                        />
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                            Sets the allowed time duration for cashier breaks. Exceeding this limit will mark the break as OVERTIME.
                        </p>
                    </div>

                    <hr style={{ border: '0', borderTop: '1px solid var(--border)', margin: '10px 0' }} />
                    
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Receipt Customization</h3>
                    
                    <div className="form-group">
                        <label>Receipt Footer Message</label>
                        <textarea
                            value={receiptFooterState}
                            onChange={(e) => setReceiptFooterState(e.target.value)}
                            placeholder="e.g. Thank you for shopping with us!"
                            rows={2}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical' }}
                        />
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                            This message appears at the bottom of the printed receipt, above the return policy.
                        </p>
                    </div>

                    <div className="form-group">
                        <label>Return Policy Text</label>
                        <textarea
                            value={receiptPolicyState}
                            onChange={(e) => setReceiptPolicyState(e.target.value)}
                            placeholder="e.g. No return, no exchange after 7 days."
                            rows={2}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical' }}
                        />
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                            This text appears at the very bottom of the receipt to outline your store's return policy.
                        </p>
                    </div>

                    <hr style={{ border: '0', borderTop: '1px solid var(--border)', margin: '10px 0' }} />
                    
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={20} style={{ color: 'var(--accent)' }}/> License & Device Management
                    </h3>
                    
                    <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>Active Subscription</div>
                            {expiry ? (
                                <div style={{ color: 'var(--success)' }}>Valid until {new Date(expiry).toLocaleDateString()}</div>
                            ) : (
                                <div style={{ color: 'var(--danger)' }}>No active subscription</div>
                            )}
                            {clientInfo?.name && (
                                <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    Registered to: {clientInfo.name} ({clientInfo.address})
                                </div>
                            )}
                        </div>

                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>Registered Devices ({registeredDevices.length})</div>
                        {loadingDevices ? (
                            <div style={{ color: 'var(--text-muted)' }}>Loading devices...</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {registeredDevices.map(device => (
                                    <div key={device.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <MonitorSmartphone size={20} style={{ color: device.id === currentDeviceId ? 'var(--accent)' : 'var(--text-muted)' }} />
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                                                    Device ID: {device.id.substring(0, 12)}...
                                                    {device.id === currentDeviceId && <span style={{ marginLeft: '8px', background: 'var(--accent)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>THIS DEVICE</span>}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    Browser: {device.userAgent?.split(' ')[0] || 'Unknown'} | Registered: {new Date(device.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => revokeDevice(device.id)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <XCircle size={16} /> Revoke
                                        </button>
                                    </div>
                                ))}
                                {registeredDevices.length === 0 && (
                                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No devices registered.</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="form-actions" style={{ marginTop: '20px' }}>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            <Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </form>

                <div style={{ marginTop: '40px', background: '#fef2f2', border: '1px solid #fca5a5', padding: '20px', borderRadius: '8px' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#b91c1c', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={24} /> Danger Zone
                    </h3>
                    <p style={{ color: '#991b1b', marginBottom: '16px', fontSize: '0.95rem' }}>
                        Wipe all product, category, stock, and transaction data from the database. Settings and user accounts will be kept. This cannot be undone!
                    </p>
                    <button 
                        type="button" 
                        onClick={handleClearData} 
                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <XCircle size={18} /> Delete All Data
                    </button>
                </div>
            </motion.div>
        </main>
        </div>
    );
}

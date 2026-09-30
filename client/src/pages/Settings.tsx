import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBranding } from '../context/BrandingContext';
import Swal from 'sweetalert2';
import { Save, Upload, Trash2 } from 'lucide-react';

export default function Settings() {
    const { name, subtitle, logoIcon, logoUrl, posPinLength, hasPosPin, emailDomain, maintenanceMode, updateSettings } = useBranding();
    const [appName, setAppName] = useState(name);
    const [appSubtitle, setAppSubtitle] = useState(subtitle);
    const [appLogoIcon, setAppLogoIcon] = useState(logoIcon);
    const [maintenanceModeState, setMaintenanceModeState] = useState<boolean>(maintenanceMode || false);
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

    // Sync state when context values load
    useEffect(() => {
        setAppName(name);
        setAppSubtitle(subtitle);
        setAppLogoIcon(logoIcon);
        setLogoPreview(logoUrl);
        setPinLength(posPinLength || 4);
        setDomainName(emailDomain || 'shadow.com');
        setMaintenanceModeState(maintenanceMode || false);
    }, [name, subtitle, logoIcon, logoUrl, posPinLength, emailDomain, maintenanceMode]);

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

            await updateSettings(appName, appSubtitle, appLogoIcon, logoFile, removeLogo, targetPin, pinLength, cleanDomain, maintenanceModeState);
            
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
        <div className="page">
            <div className="page-header">
                <div>
                    <h1>System Settings</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Configure global application branding and security</p>
                </div>
            </div>

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

                    <div className="form-actions" style={{ marginTop: '10px' }}>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            <Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

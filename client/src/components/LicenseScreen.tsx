import React, { useState } from 'react';
import { useLicense } from '../context/LicenseContext';

interface LicenseScreenProps {
    onSuccess: (expiryDate: string) => void;
}

export default function LicenseScreen({ onSuccess }: LicenseScreenProps) {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCongrats, setShowCongrats] = useState(false);
    const [expiry, setExpiry] = useState<string | null>(null);
    
    const { deviceId, status } = useLicense();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/license/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    licenseKey: key,
                    deviceId: deviceId,
                    userAgent: navigator.userAgent
                })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setExpiry(data.licenseExpiry);
                setShowCongrats(true);
                // Wait for user to read the congrats before dismissing
                setTimeout(() => {
                    onSuccess(data.licenseExpiry);
                }, 3000);
            } else {
                setError(data.error || 'Invalid License Key or Device Limit Reached');
            }
        } catch (err) {
            setError('Failed to contact server');
        } finally {
            setLoading(false);
        }
    };

    if (showCongrats) {
        return (
            <div className="license-screen-overlay">
                <div className="license-card congrats-card">
                    <h2>🎉 Congratulations!</h2>
                    <p>Your license has been activated and this device is now registered successfully.</p>
                    {expiry && (
                        <p className="expiry-text">
                            Valid until: {new Date(expiry).toLocaleDateString(undefined, {
                                year: 'numeric', month: 'long', day: 'numeric',
                                hour: '2-digit', minute:'2-digit'
                            })}
                        </p>
                    )}
                    <p className="redirect-text">Loading POS Inventory...</p>
                </div>
                <style>{`
                    .license-screen-overlay {
                        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0, 0, 0, 0.85); display: flex;
                        justify-content: center; align-items: center; z-index: 9999;
                        font-family: system-ui, -apple-system, sans-serif;
                    }
                    .license-card {
                        background: #1e1e1e; color: #fff; padding: 2.5rem;
                        border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                        width: 100%; max-width: 400px; text-align: center;
                        border: 1px solid #333;
                    }
                    .congrats-card h2 { color: #4ade80; margin-top: 0; font-size: 2rem; }
                    .expiry-text { color: #94a3b8; font-size: 0.95rem; margin: 1.5rem 0; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; }
                    .redirect-text { font-size: 0.85rem; color: #64748b; animation: pulse 1.5s infinite; }
                    @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
                `}</style>
            </div>
        );
    }

    if (status === 'LOCKED_DOWN') {
        return (
            <div className="license-screen-overlay">
                <div className="license-card" style={{ border: '2px solid #ef4444' }}>
                    <div style={{ color: '#ef4444', marginBottom: '1rem' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <h2 style={{ color: '#ef4444' }}>System Locked Down</h2>
                    <p style={{ color: '#fca5a5' }}>
                        This POS System has been remotely locked down by your Administrator. 
                        Please contact IT Support immediately to restore access.
                    </p>
                    <div style={{marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b'}}>Device ID: {deviceId}</div>
                </div>
                <style>{`
                    .license-screen-overlay {
                        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0, 0, 0, 0.95); display: flex;
                        justify-content: center; align-items: center; z-index: 9999;
                        font-family: system-ui, -apple-system, sans-serif;
                    }
                    .license-card {
                        background: #1e1e1e; color: #fff; padding: 2.5rem;
                        border-radius: 12px; box-shadow: 0 10px 40px rgba(239,68,68,0.2);
                        width: 100%; max-width: 400px; text-align: center;
                    }
                    .license-card h2 { margin-top: 0; font-size: 1.75rem; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="license-screen-overlay">
            <div className="license-card">
                <h2 style={{ color: status === 'EXPIRED' ? '#ef4444' : '#fff' }}>
                    {status === 'EXPIRED' ? 'License Expired' : 'Activate Device'}
                </h2>
                <p>
                    {status === 'EXPIRED' 
                        ? 'Your software subscription has expired. Please enter a renewed license key to continue.' 
                        : 'Please enter a valid license key to register this device and continue.'}
                </p>
                
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        value={key} 
                        onChange={(e) => setKey(e.target.value)} 
                        placeholder="Enter your license key..."
                        required
                        className="license-input"
                    />
                    {error && <div className="license-error">{error}</div>}
                    <button type="submit" disabled={loading} className="license-btn">
                        {loading ? 'Verifying...' : 'Register Device'}
                    </button>
                </form>
                <div style={{marginTop: '1rem', fontSize: '0.8rem', color: '#64748b'}}>Device ID: {deviceId}</div>
            </div>
            <style>{`
                .license-screen-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.85); display: flex;
                    justify-content: center; align-items: center; z-index: 9999;
                    font-family: system-ui, -apple-system, sans-serif;
                }
                .license-card {
                    background: #1e1e1e; color: #fff; padding: 2.5rem;
                    border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    width: 100%; max-width: 400px; text-align: center;
                    border: 1px solid #333;
                }
                .license-card h2 { margin-top: 0; margin-bottom: 0.5rem; font-size: 1.75rem; }
                .license-card p { color: #94a3b8; font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5; }
                .license-input {
                    width: 100%; box-sizing: border-box; padding: 0.75rem 1rem;
                    border-radius: 8px; border: 1px solid #333; background: #2d2d2d;
                    color: #fff; font-size: 1rem; margin-bottom: 1rem; outline: none;
                    transition: border-color 0.2s;
                }
                .license-input:focus { border-color: #3b82f6; }
                .license-btn {
                    width: 100%; padding: 0.875rem; border-radius: 8px;
                    border: none; background: #3b82f6; color: #fff;
                    font-size: 1rem; font-weight: 600; cursor: pointer;
                    transition: background 0.2s;
                }
                .license-btn:hover { background: #2563eb; }
                .license-btn:disabled { background: #475569; cursor: not-allowed; }
                .license-error {
                    color: #ef4444; background: rgba(239, 68, 68, 0.1);
                    padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem;
                    font-size: 0.9rem; text-align: left; border: 1px solid rgba(239, 68, 68, 0.2);
                }
            `}</style>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, Zap, Eye, EyeOff, CreditCard } from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';
import { useBranding } from '../context/BrandingContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login, rfidLogin } = useAuth();
    const navigate = useNavigate();
    const { name, subtitle, logoUrl, emailDomain } = useBranding();

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour === 12) return 'Good noon';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            await Swal.fire({
                icon: 'success',
                title: `${getGreeting()}!`,
                text: 'Login successful',
                timer: 1500,
                showConfirmButton: false,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
            });
            navigate('/');
        } catch (err: any) {
            Swal.fire({
                icon: 'error',
                title: 'Login Failed',
                text: err.response?.data?.error || 'Invalid credentials',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                confirmButtonColor: 'var(--accent)',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRfidLogin = async (rfidUid: string) => {
        const { value: pin } = await Swal.fire({
            title: 'Enter 4-Digit PIN',
            input: 'password',
            inputAttributes: {
                maxlength: '4',
                autocapitalize: 'off',
                autocorrect: 'off'
            },
            showCancelButton: true,
            confirmButtonText: 'Login',
            confirmButtonColor: 'var(--accent)',
            cancelButtonColor: 'var(--bg-hover)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            preConfirm: (pin) => {
                if (!pin || pin.length !== 4) {
                    Swal.showValidationMessage('Please enter a 4-digit PIN');
                }
                return pin;
            }
        });

        if (pin) {
            try {
                await rfidLogin(rfidUid, pin);
                await Swal.fire({
                    icon: 'success',
                    title: `${getGreeting()}!`,
                    timer: 1000,
                    showConfirmButton: false,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                });
                navigate('/pos');
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Login Failed',
                    text: err.response?.data?.error || 'Invalid RFID card or PIN',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    confirmButtonColor: 'var(--accent)',
                });
            }
        }
    };

    const promptManualRfid = async () => {
        const { value: rfidUid } = await Swal.fire({
            title: 'Scan or Type RFID UID',
            input: 'text',
            showCancelButton: true,
            confirmButtonText: 'Next',
            confirmButtonColor: 'var(--accent)',
            cancelButtonColor: 'var(--bg-hover)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
        });
        
        if (rfidUid) {
            handleRfidLogin(rfidUid);
        }
    };

    useEffect(() => {
        let rfidBuffer = '';
        let lastKeyTime = Date.now();

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                if (!target.id.includes('swal')) return;
            }

            const now = Date.now();
            if (now - lastKeyTime > 80) rfidBuffer = '';
            lastKeyTime = now;

            if (e.key === 'Enter' && rfidBuffer.length > 2) {
                if (target.tagName !== 'INPUT' || target.id === 'swal2-input' || !target.id) {
                    handleRfidLogin(rfidBuffer);
                }
                rfidBuffer = '';
            } else if (e.key.length === 1) {
                rfidBuffer += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="login-page">
            <div className="login-bg-effects">
                <div className="orb orb-1" />
                <div className="orb orb-2" />
                <div className="orb orb-3" />
            </div>
            <motion.div
                className="login-card"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            >
                <div className="login-header">
                    {logoUrl ? (
                        <motion.img
                            src={logoUrl}
                            alt="Logo"
                            style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border)', marginBottom: '16px' }}
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.5 }}
                        />
                    ) : (
                        <motion.div
                            className="login-logo"
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                        >
                            <Zap size={40} />
                        </motion.div>
                    )}
                    <h1>{name}</h1>
                    <p>{subtitle}</p>
                </div>

                <div style={{ marginBottom: '20px', width: '100%' }}>
                    <button 
                        type="button" 
                        onClick={promptManualRfid}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'var(--accent)',
                            color: 'var(--bg-primary)',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <CreditCard size={18} />
                        Cashier RFID Tap-In / Quick PIN
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 20px 0', color: 'var(--text-muted)' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                    <span style={{ padding: '0 10px', fontSize: '0.85rem', fontWeight: 600 }}>OR ADMIN LOGIN</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <Mail size={18} className="input-icon" />
                        <input
                            type="text"
                            placeholder="Username or Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="input-group">
                        <Lock size={18} className="input-icon" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            style={{ paddingRight: '42px' }}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '14px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                padding: 0,
                                outline: 'none',
                                transition: 'color 0.2s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <motion.button
                        type="submit"
                        className="login-btn"
                        disabled={loading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {loading ? (
                            <div className="spinner-small" />
                        ) : (
                            <>
                                <LogIn size={18} />
                                Sign In
                            </>
                        )}
                    </motion.button>
                </form>

                <div className="login-footer">
                    <p>Demo: admin@{emailDomain || 'shadow.com'} / admin123</p>
                </div>
            </motion.div>
        </div>
    );
}

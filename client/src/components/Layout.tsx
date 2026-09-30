import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Receipt,
    Users,
    LogOut,
    Menu,
    X,
    Settings,
    Layers,
    CreditCard,
    ShieldAlert,
    FileText,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useBranding } from '../context/BrandingContext';

export default function Layout() {
    const { user, logout, logActivity } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isOnBreak, setIsOnBreak] = useState(() => localStorage.getItem('shadow-apollo-break') === 'true');
    const [breakStartTime, setBreakStartTime] = useState<number | null>(() => {
        const time = localStorage.getItem('shadow-apollo-break-time');
        return time ? parseInt(time) : null;
    });
    const [breakTimeLimit, setBreakTimeLimit] = useState(() => {
        const limit = localStorage.getItem('shadow-apollo-break-limit');
        return limit ? parseInt(limit) : 15;
    });
    const [notepadOpen, setNotepadOpen] = useState(false);
    const [notes, setNotes] = useState(() => localStorage.getItem('shadow-apollo-notes') || '');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const { name, subtitle, logoIcon, logoUrl, hasPosPin, posPinLength } = useBranding();

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        
        // Listen for storage events in case admin changes break limit in another tab
        const handleStorageChange = () => {
            const limit = localStorage.getItem('shadow-apollo-break-limit');
            if (limit) setBreakTimeLimit(parseInt(limit));
        };
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('shadow-apollo-notes', notes);
    }, [notes]);

    useEffect(() => {
        localStorage.setItem('shadow-apollo-break', isOnBreak.toString());
        if (breakStartTime) {
            localStorage.setItem('shadow-apollo-break-time', breakStartTime.toString());
        } else {
            localStorage.removeItem('shadow-apollo-break-time');
        }
    }, [isOnBreak, breakStartTime]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleBreak = async (action: 'BREAK_IN' | 'BREAK_OUT') => {
        const { value: inputVal } = await Swal.fire({
            title: 'Admin Authorization Required',
            text: 'Swipe Admin RFID Card or enter Admin PIN code to authorize this break log.',
            input: 'password',
            inputPlaceholder: 'RFID Swipe / Admin PIN',
            inputAttributes: {
                autocapitalize: 'off',
                autocorrect: 'off',
                autocomplete: 'new-password'
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
            return;
        }

        try {
            const verifyRes = await axios.post('/api/settings/verify-pin', { value: inputVal });
            if (verifyRes.data && verifyRes.data.valid) {
                await logActivity(action);
                
                if (action === 'BREAK_IN') {
                    setIsOnBreak(true);
                    setBreakStartTime(Date.now());
                } else {
                    setIsOnBreak(false);
                    setBreakStartTime(null);
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Break Logged',
                    text: `You have logged your ${action === 'BREAK_IN' ? 'Break Start' : 'Break End'}.`,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Access Denied',
                    text: 'Invalid Admin PIN or Password.',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    confirmButtonColor: 'var(--accent)'
                });
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
        }
    };

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['ADMIN', 'STAFF', 'CASHIER'] },
        { to: '/inventory', icon: Package, label: 'Inventory', roles: ['ADMIN', 'STAFF'] },
        { to: '/categories', icon: Layers, label: 'Categories', roles: ['ADMIN', 'STAFF'] },
        { to: '/payment-modes', icon: CreditCard, label: 'Payment Modes', roles: ['ADMIN', 'STAFF'] },
        { to: '/pos', icon: ShoppingCart, label: 'POS', roles: ['ADMIN', 'CASHIER'] },
        { to: '/sales', icon: Receipt, label: 'Sales History', roles: ['ADMIN', 'STAFF', 'CASHIER'] },
        { to: '/users', icon: Users, label: 'Users', roles: ['ADMIN'] },
        { to: '/audits', icon: ShieldAlert, label: 'Audits', roles: ['ADMIN'] },
        { to: '/settings', icon: Settings, label: 'Settings', roles: ['ADMIN', 'STAFF'] },
    ];

    const filteredNavItems = navItems.filter(
        (item) => user && item.roles.includes(user.role)
    );

    return (
        <div className="layout">
            {/* Mobile menu toggle */}
            <button className={`mobile-menu-btn ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Sidebar */}
            <motion.aside
                className={`sidebar ${sidebarOpen ? 'open' : ''}`}
                initial={{ x: isMobile ? -280 : 0 }}
                animate={{ x: isMobile ? (sidebarOpen ? 0 : -280) : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <div className="sidebar-header">
                    <div className="logo">
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt="Logo"
                                style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #333' }}
                            />
                        ) : (
                            <div className="logo-icon">{logoIcon}</div>
                        )}
                        <div>
                            <h1>{name}</h1>
                            <span className="logo-subtitle">{subtitle}</span>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {filteredNavItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info" style={{ marginBottom: '10px' }}>
                        <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
                        <div className="user-details">
                            <span className="user-name">{user?.name}</span>
                            <span className="user-role">{user?.role}</span>
                        </div>
                    </div>
                    {user?.role !== 'ADMIN' && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => handleBreak('BREAK_IN')}>Break In</button>
                            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => handleBreak('BREAK_OUT')}>Break Out</button>
                        </div>
                    )}
                    <button className="logout-btn" onClick={handleLogout}>
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </motion.aside>

            {/* Overlay for mobile sidebar */}
            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            {/* Main content */}
            <main className="main-content">
                <Outlet />
            </main>

            {/* Break Time Frozen Overlay */}
            <AnimatePresence>
                {isOnBreak && breakStartTime && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(15, 15, 25, 0.95)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 99999,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontFamily: 'var(--font)'
                        }}
                    >
                        <h1 style={{ fontSize: '3.5rem', color: 'var(--accent)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '4px' }}>ON BREAK</h1>
                        
                        <BreakTimer startTime={breakStartTime} limitMinutes={breakTimeLimit} />
                        
                        <div style={{ 
                            marginTop: '40px', 
                            padding: '25px', 
                            background: 'var(--bg-primary)', 
                            border: '1px solid var(--border)', 
                            borderRadius: '12px', 
                            maxWidth: '500px', 
                            width: '90%',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                        }}>
                            <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShieldAlert size={20} style={{ color: 'var(--accent)' }}/> Break Time Rules
                            </h3>
                            <ul style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: '1.6', margin: 0, paddingLeft: '20px' }}>
                                <li style={{ marginBottom: '8px' }}>Maximum allowed break time is <strong>{breakTimeLimit} minutes</strong>.</li>
                                <li style={{ marginBottom: '8px' }}>Your POS screen is frozen and locked until you break out.</li>
                                <li style={{ marginBottom: '8px' }}>You must authorize with Admin/Manager before ending your break.</li>
                                <li style={{ marginBottom: '0' }}>Exceeding break limits will be recorded in the audit logs.</li>
                            </ul>
                        </div>

                        <button 
                            className="btn btn-primary" 
                            style={{ 
                                marginTop: '40px', 
                                padding: '16px 40px', 
                                fontSize: '1.2rem', 
                                borderRadius: '30px',
                                boxShadow: '0 4px 15px rgba(108, 99, 255, 0.4)',
                                fontWeight: 'bold'
                            }}
                            onClick={() => handleBreak('BREAK_OUT')}
                        >
                            End Break (Break Out)
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Notepad Floating Button */}
            <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <AnimatePresence>
                    {notepadOpen && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20, scale: 0.9 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            exit={{ opacity: 0, y: 20, scale: 0.9 }}
                            style={{ 
                                background: 'var(--bg-secondary)', 
                                border: '1px solid var(--border)', 
                                borderRadius: '12px', 
                                padding: '16px', 
                                width: '320px', 
                                height: '400px', 
                                marginBottom: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileText size={18} style={{ color: 'var(--accent)' }}/> Scratchpad
                                </h3>
                                <button className="btn-icon" onClick={() => setNotepadOpen(false)}><X size={18}/></button>
                            </div>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="List down features or notes here..."
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    resize: 'none',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontFamily: 'inherit',
                                    outline: 'none'
                                }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
                <button 
                    onClick={() => setNotepadOpen(!notepadOpen)}
                    style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        color: 'var(--bg-primary)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <FileText size={24} />
                </button>
            </div>
        </div>
    );
}

// Subcomponent for the Break Timer
function BreakTimer({ startTime, limitMinutes }: { startTime: number, limitMinutes: number }) {
    const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startTime) / 1000));
    
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const limitSeconds = limitMinutes * 60;
    const remaining = limitSeconds - elapsed;
    const isOvertime = remaining < 0;
    
    const displayTime = Math.abs(isOvertime ? remaining : elapsed);
    const mins = Math.floor(displayTime / 60).toString().padStart(2, '0');
    const secs = (displayTime % 60).toString().padStart(2, '0');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ 
                fontSize: '5rem', 
                fontWeight: 'bold', 
                fontFamily: 'monospace',
                color: isOvertime ? '#ff4b4b' : 'var(--text-primary)',
                textShadow: isOvertime ? '0 0 20px rgba(255, 75, 75, 0.5)' : 'none',
                lineHeight: '1'
            }}>
                {isOvertime && '-'}{mins}:{secs}
            </div>
            <div style={{ fontSize: '1.2rem', color: isOvertime ? '#ff4b4b' : 'var(--text-muted)', marginTop: '8px' }}>
                {isOvertime ? 'OVERTIME LIMIT EXCEEDED' : 'Elapsed Time'}
            </div>
        </div>
    );
}

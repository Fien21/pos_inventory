import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import axios from 'axios';
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
    Truck,
    Clock,
    BarChart3,
    Archive,
    RotateCcw,
    Wallet,
    ClipboardList,
    RefreshCw,
    ScanLine,
    Search,
    MonitorSmartphone,
    Grid,
    CircleDot,
    UserCog,
    Tag
} from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const { name } = useBranding();

    const [lowStockCount, setLowStockCount] = useState<number | null>(null);
    const [tillBalance, setTillBalance] = useState<number | null>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);

        window.addEventListener('resize', handleResize);

        const fetchStats = () => {
            axios.get('/api/transactions/stats/dashboard')
                .then(res => setLowStockCount(res.data.lowStockProducts || 0))
                .catch(console.error);

            axios.get('/api/shifts/till/data')
                .then(res => setTillBalance(res.data.currentBalance || 0))
                .catch(console.error);
        };

        fetchStats();
        const interval = setInterval(fetchStats, 10000);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearInterval(interval);
        };
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const hasAccess = (perm: string) => {
        if (!user || !user.permissions) return false;
        if (user.permissions.includes('*')) return true;
        return user.permissions.includes(perm);
    };

    const navItems = [
        { group: 'POINT OF SALE', to: '/', icon: LayoutDashboard, label: 'Dashboard', perm: 'DASHBOARD' },
        { group: 'POINT OF SALE', to: '/pos', icon: ShoppingCart, label: 'POS Terminal', badge: { type: 'green', text: 'OPEN' }, shortcut: 'F2', perm: 'POS_TERMINAL' },

        { group: 'POINT OF SALE', to: '/refunds', icon: RotateCcw, label: 'Refunds & Returns', perm: 'REFUNDS_RETURNS' },
        { group: 'POINT OF SALE', to: '/layaway', icon: Archive, label: 'Layaway / Reserves', perm: 'LAYAWAY_RESERVES' },

        { group: 'OPERATIONS & CASH', to: '/cash-drawer', icon: Wallet, label: 'Cash Drawer & Till', badge: { type: 'gray', text: 'Float: P5k' }, perm: 'CASH_DRAWER' },
        { group: 'OPERATIONS & CASH', to: '/shifts', icon: ClipboardList, label: 'Shifts & X/Z Reading', badge: { type: 'gray', text: 'Morning' }, perm: 'SHIFTS_READING' },
        { group: 'OPERATIONS & CASH', to: '/sales', icon: Receipt, label: 'Sales History & Receipts', perm: 'SALES_HISTORY' },
        { group: 'OPERATIONS & CASH', to: '/payment-modes', icon: CreditCard, label: 'Payment Modes', perm: 'PAYMENT_MODES' },
        { group: 'OPERATIONS & CASH', to: '/sync', icon: RefreshCw, label: 'Sync Queue', badge: { type: 'green-outline', text: '✓ Synced' }, perm: 'SYNC_QUEUE' },

        { group: 'INVENTORY & CATALOG', to: '/inventory', icon: Package, label: 'Stock Inventory', badge: lowStockCount !== null && lowStockCount > 0 ? { type: 'yellow', text: `${lowStockCount} Low` } : undefined, perm: 'STOCK_INVENTORY' },
        { group: 'INVENTORY & CATALOG', to: '/price-check', icon: ScanLine, label: 'Price Check / Scan', shortcut: 'F3', perm: 'PRICE_CHECK' },
        { group: 'INVENTORY & CATALOG', to: '/categories', icon: Layers, label: 'Categories', perm: 'CATEGORIES' },
        { group: 'INVENTORY & CATALOG', to: '/suppliers', icon: Truck, label: 'Suppliers & POs', perm: 'SUPPLIERS_POS' },

        { group: 'CUSTOMERS & MANAGEMENT', to: '/customers', icon: Users, label: 'Loyalty & Customers', perm: 'LOYALTY_CUSTOMERS' },
        { group: 'CUSTOMERS & MANAGEMENT', to: '/users', icon: UserCog, label: 'User & Role Management', perm: 'USER_ROLE_MGMT' },
        { group: 'CUSTOMERS & MANAGEMENT', to: '/reports', icon: BarChart3, label: 'Reports & Analytics', perm: 'REPORTS_ANALYTICS' },
        { group: 'CUSTOMERS & MANAGEMENT', to: '/promotions', icon: Tag, label: 'Promotions & Discounts', perm: 'SETTINGS' },
        { group: 'CUSTOMERS & MANAGEMENT', to: '/audits', icon: ShieldAlert, label: 'Audits & Logs', perm: 'AUDITS_LOGS' },
        { group: 'CUSTOMERS & MANAGEMENT', to: '/settings', icon: Settings, label: 'Settings', perm: 'SETTINGS' },
    ];

    const filteredNavItems = navItems.filter(item => hasAccess(item.perm));

    const groupedNavItems = filteredNavItems.reduce((acc, item) => {
        if (!acc[item.group]) acc[item.group] = [];
        acc[item.group].push(item);
        return acc;
    }, {} as Record<string, typeof navItems>);

    const location = useLocation();

    return (
        <div className="flex min-h-screen text-slate-800 antialiased font-sans bg-[#f8fafc]">
            {isMobile && (
                <button 
                    className="fixed top-4 left-4 z-50 bg-white border border-slate-200 text-slate-800 p-2 rounded-md shadow-sm"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                    {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            )}

            {isMobile && sidebarOpen && (
                <div className="fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside
                className={`w-[260px] bg-white flex flex-col justify-between shrink-0 fixed inset-y-0 left-0 z-40 transition-transform border-r border-slate-200 ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}`}
            >
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Brand Header */}
                    <div className="pt-5 pb-3 px-5 flex flex-col gap-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center shrink-0">
                                <Grid className="w-4 h-4" />
                            </div>
                            <div className="leading-tight">
                                <h1 className="font-bold text-slate-900 text-[14px] flex items-center gap-1.5">
                                    {name || "System Admin"} <span className="text-[10px] text-slate-500 font-medium border border-slate-200 px-1 rounded bg-slate-50">POS</span>
                                </h1>
                                <p className="text-[11px] text-slate-500">{(user as any)?.branch?.name || "Main Store"} - Shift Morning</p>
                            </div>
                        </div>

                        {/* Status Box */}
                        <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50">
                            <div className="flex items-center gap-2 mb-1.5">
                                <MonitorSmartphone className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-xs font-semibold text-slate-700">Register 01 (Front Counter)</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 flex items-center gap-1"><CircleDot className="w-2 h-2 text-emerald-500 fill-emerald-500" /> Till: <span className="font-bold text-slate-900">₱{tillBalance !== null ? tillBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '...'}</span></span>
                                <span className="text-emerald-600 font-bold uppercase tracking-wide">ONLINE</span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 overflow-y-auto pb-4 custom-scrollbar">
                        {Object.entries(groupedNavItems).map(([groupName, items]) => (
                            <div key={groupName} className="mb-5">
                                <div className="px-2 mb-2 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                                    {groupName}
                                </div>
                                <div className="space-y-0.5">
                                    {items.map((item) => (
                                        <NavLink
                                            key={item.label}
                                            to={item.to}
                                            className={({ isActive }) => 
                                                `flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors text-[12px] ${
                                                    isActive 
                                                    ? 'bg-blue-50 text-blue-700 font-semibold relative after:absolute after:left-0 after:top-1.5 after:bottom-1.5 after:w-0.5 after:bg-blue-600 after:rounded-r-md' 
                                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                                                }`
                                            }
                                        >
                                            {({ isActive }) => (
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-2.5">
                                                        <item.icon className={`w-[16px] h-[16px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                                        <span>{item.label}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-1.5">
                                                        {item.badge && (
                                                            <span className={`text-[9px] font-bold px-1.5 py-[1px] rounded ${
                                                                item.badge.type === 'green' ? 'bg-emerald-100 text-emerald-700' :
                                                                item.badge.type === 'yellow' ? 'bg-amber-100 text-amber-700' :
                                                                item.badge.type === 'gray' ? 'bg-slate-200 text-slate-600' :
                                                                item.badge.type === 'green-outline' ? 'border border-emerald-200 text-emerald-600 bg-emerald-50' : ''
                                                            }`}>
                                                                {item.badge.text}
                                                            </span>
                                                        )}
                                                        {item.shortcut && (
                                                            <span className="text-[9px] font-mono border border-slate-200 bg-white text-slate-400 px-1 rounded shadow-sm">
                                                                {item.shortcut}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </NavLink>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </nav>

                    {/* Bottom Area */}
                    <div className="border-t border-slate-200 bg-slate-50 shrink-0">
                        <div className="p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">QUICK TOOLS</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <button 
                                    onClick={() => navigate('/cash-drawer')}
                                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-md bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 transition-colors"
                                >
                                    <Wallet className="w-4 h-4" />
                                    <span className="text-[9px] font-semibold">Open Till</span>
                                </button>
                                <button 
                                    onClick={() => navigate('/price-check')}
                                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-md bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 transition-colors"
                                >
                                    <ScanLine className="w-4 h-4" />
                                    <span className="text-[9px] font-semibold">Scan SKU</span>
                                </button>
                                <button 
                                    onClick={() => navigate('/pos')}
                                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-md bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 transition-colors"
                                >
                                    <ShoppingCart className="w-4 h-4" />
                                    <span className="text-[9px] font-semibold">POS</span>
                                </button>
                            </div>
                        </div>

                        <div className="px-4 py-2 border-t border-slate-200 flex items-center justify-between">
                            <div>
                                <div className="text-[11px] font-semibold text-slate-700">Pro License</div>
                                <div className="text-[9px] text-slate-500">Expires: 6 Oct 2026</div>
                            </div>
                            <span className="bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase">ACTIVE</span>
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
                                    SA
                                </div>
                                <div className="leading-tight">
                                    <div className="text-[12px] font-bold text-slate-900">{user?.name || 'System Admin'}</div>
                                    <div className="text-[10px] text-slate-500">{user?.role || 'ADMIN'} - Shift #1</div>
                                </div>
                            </div>
                            <button onClick={handleLogout} className="text-slate-400 hover:text-red-600 transition-colors">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className={`flex-1 flex flex-col min-w-0 ${!isMobile ? 'pl-[260px]' : ''}`}>
                <main className="flex-1 relative w-full h-screen overflow-hidden flex flex-col">
                    <Outlet />
                </main>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 4px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
}

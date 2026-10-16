import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import ProductForm from './pages/ProductForm';
import POS from './pages/POS';
import Support from './pages/Support';
import SalesHistory from './pages/SalesHistory';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import Categories from './pages/Categories';
import PaymentModes from './pages/PaymentModes';
import Audits from './pages/Audits';
import StockPurchase from './pages/StockPurchase';
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import Shifts from './pages/Shifts';
import Reports from './pages/Reports';

import Refunds from './pages/Refunds';
import Layaway from './pages/Layaway';
import CashDrawer from './pages/CashDrawer';
import SyncQueue from './pages/SyncQueue';
import PriceCheck from './pages/PriceCheck';
import Promotions from './pages/Promotions';
import { useBranding } from './context/BrandingContext';
import { useLicense, LicenseProvider } from './context/LicenseContext';
import LicenseScreen from './components/LicenseScreen';

function AppContent() {
    const { isAuthenticated, loading: authLoading, user } = useAuth();
    const { name, loading: brandingLoading } = useBranding();
    const { status, expiry, checkLicense } = useLicense();

    if (authLoading || brandingLoading || status === 'LOADING') {
        return (
            <div className="loading-screen">
                <div className="spinner" />
                <p>Loading {name}...</p>
            </div>
        );
    }

    const needsLicense = status !== 'ACTIVE';

    const getFallbackRoute = () => {
        if (!isAuthenticated) return '/login';
        const perms = user?.permissions || [];
        if (user?.role === 'ADMIN' || perms.includes('*') || perms.includes('DASHBOARD')) return '/';
        if (perms.includes('POS_TERMINAL')) return '/pos';
        if (perms.includes('SALES_HISTORY')) return '/sales';
        if (perms.includes('STOCK_INVENTORY')) return '/inventory';
        if (perms.includes('PRICE_CHECK')) return '/price-check';

        if (perms.includes('SHIFTS_READING')) return '/shifts';
        // If they are authenticated but have ZERO UI permissions, force logout or show a generic page
        return '/logout-required';
    };

    return (
        <>
            {needsLicense && <LicenseScreen onSuccess={checkLicense} />}
            <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to={getFallbackRoute()} /> : <Login />} />
            <Route path="/logout-required" element={<div className="flex items-center justify-center min-h-screen text-slate-500 font-sans"><div className="text-center"><h2>Access Denied</h2><p>You have no modules assigned. Please contact an Admin.</p></div></div>} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={
                    <ProtectedRoute requiredPermission="DASHBOARD">
                        <Dashboard />
                    </ProtectedRoute>
                } />
                <Route path="/inventory" element={
                    <ProtectedRoute>
                        <Inventory />
                    </ProtectedRoute>
                } />
                <Route path="/inventory/purchase" element={
                    <ProtectedRoute requiredPermission="STOCK_INVENTORY">
                        <StockPurchase />
                    </ProtectedRoute>
                } />
                <Route path="/products/new" element={
                    <ProtectedRoute requiredPermission="STOCK_INVENTORY">
                        <ProductForm />
                    </ProtectedRoute>
                } />
                <Route path="/products/:id/edit" element={
                    <ProtectedRoute requiredPermission="STOCK_INVENTORY">
                        <ProductForm />
                    </ProtectedRoute>
                } />
                <Route path="/pos" element={
                    <ProtectedRoute requiredPermission="POS_TERMINAL">
                        <POS />
                    </ProtectedRoute>
                } />

                <Route path="/refunds" element={
                    <ProtectedRoute requiredPermission="REFUNDS_RETURNS">
                        <Refunds />
                    </ProtectedRoute>
                } />
                <Route path="/layaway" element={
                    <ProtectedRoute requiredPermission="LAYAWAY_RESERVES">
                        <Layaway />
                    </ProtectedRoute>
                } />
                <Route path="/cash-drawer" element={
                    <ProtectedRoute requiredPermission="POS_TERMINAL">
                        <CashDrawer />
                    </ProtectedRoute>
                } />
                <Route path="/sync" element={
                    <ProtectedRoute requiredPermission="SYNC_QUEUE">
                        <SyncQueue />
                    </ProtectedRoute>
                } />
                <Route path="/price-check" element={
                    <ProtectedRoute requiredPermission="POS_TERMINAL">
                        <PriceCheck />
                    </ProtectedRoute>
                } />
                <Route path="/sales" element={
                    <ProtectedRoute requiredPermission="SALES_HISTORY">
                        <SalesHistory />
                    </ProtectedRoute>
                } />
                <Route path="/users" element={
                    <ProtectedRoute requiredPermission="USER_ROLE_MGMT">
                        <UserManagement />
                    </ProtectedRoute>
                } />
                <Route path="/audits" element={
                    <ProtectedRoute requiredPermission="AUDITS_LOGS">
                        <Audits />
                    </ProtectedRoute>
                } />
                <Route path="/settings" element={
                    <ProtectedRoute requiredPermission="SETTINGS">
                        <Settings />
                    </ProtectedRoute>
                } />
                <Route path="/categories" element={
                    <ProtectedRoute requiredPermission="CATEGORIES">
                        <Categories />
                    </ProtectedRoute>
                } />
                <Route path="/suppliers" element={
                    <ProtectedRoute requiredPermission="SUPPLIERS_POS">
                        <Suppliers />
                    </ProtectedRoute>
                } />
                <Route path="/customers" element={
                    <ProtectedRoute requiredPermission="LOYALTY_CUSTOMERS">
                        <Customers />
                    </ProtectedRoute>
                } />
                <Route path="/shifts" element={
                    <ProtectedRoute requiredPermission="SHIFTS_READING">
                        <Shifts />
                    </ProtectedRoute>
                } />
                <Route path="/reports" element={
                    <ProtectedRoute requiredPermission="REPORTS_ANALYTICS">
                        <Reports />
                    </ProtectedRoute>
                } />
                <Route path="/payment-modes" element={
                    <ProtectedRoute requiredPermission="PAYMENT_MODES">
                        <PaymentModes />
                    </ProtectedRoute>
                } />
                <Route path="/promotions" element={
                    <ProtectedRoute requiredPermission="SETTINGS">
                        <Promotions />
                    </ProtectedRoute>
                } />
                <Route path="/support" element={
                    <ProtectedRoute requiredPermission="DASHBOARD">
                        <Support />
                    </ProtectedRoute>
                } />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </>
    );
}

export default function App() {
    return (
        <LicenseProvider>
            <AppContent />
        </LicenseProvider>
    );
}


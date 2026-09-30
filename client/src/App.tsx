import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import ProductForm from './pages/ProductForm';
import POS from './pages/POS';
import SalesHistory from './pages/SalesHistory';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import Categories from './pages/Categories';
import PaymentModes from './pages/PaymentModes';
import Audits from './pages/Audits';
import { useBranding } from './context/BrandingContext';

export default function App() {
    const { isAuthenticated, loading } = useAuth();
    const { name, loading: brandingLoading } = useBranding();

    if (loading || brandingLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
                <p>Loading {name}...</p>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/inventory" element={
                    <ProtectedRoute roles={['ADMIN', 'STAFF']}>
                        <Inventory />
                    </ProtectedRoute>
                } />
                <Route path="/products/new" element={
                    <ProtectedRoute roles={['ADMIN', 'STAFF']}>
                        <ProductForm />
                    </ProtectedRoute>
                } />
                <Route path="/products/:id/edit" element={
                    <ProtectedRoute roles={['ADMIN', 'STAFF']}>
                        <ProductForm />
                    </ProtectedRoute>
                } />
                <Route path="/pos" element={
                    <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                        <POS />
                    </ProtectedRoute>
                } />
                <Route path="/sales" element={<SalesHistory />} />
                <Route path="/users" element={
                    <ProtectedRoute roles={['ADMIN']}>
                        <UserManagement />
                    </ProtectedRoute>
                } />
                <Route path="/audits" element={
                    <ProtectedRoute roles={['ADMIN']}>
                        <Audits />
                    </ProtectedRoute>
                } />
                <Route path="/settings" element={
                    <ProtectedRoute roles={['ADMIN', 'STAFF']}>
                        <Settings />
                    </ProtectedRoute>
                } />
                <Route path="/categories" element={
                    <ProtectedRoute roles={['ADMIN', 'STAFF']}>
                        <Categories />
                    </ProtectedRoute>
                } />
                <Route path="/payment-modes" element={
                    <ProtectedRoute roles={['ADMIN', 'STAFF']}>
                        <PaymentModes />
                    </ProtectedRoute>
                } />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

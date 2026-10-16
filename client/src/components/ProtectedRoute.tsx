import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
    children: ReactNode;
    roles?: string[];
    requiredPermission?: string;
}

export default function ProtectedRoute({ children, roles, requiredPermission }: Props) {
    const { isAuthenticated, user } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (user) {
        // Admin always retains full configured access
        if (user.role === 'ADMIN' || user.permissions?.includes('*')) {
            return <>{children}</>;
        }

        // Helper to find the best fallback route based on permissions
        const getFallbackRoute = () => {
            const perms = user.permissions || [];
            if (perms.includes('*') || perms.includes('DASHBOARD')) return '/';
            if (perms.includes('POS_TERMINAL')) return '/pos';
            if (perms.includes('SALES_HISTORY')) return '/sales';
            if (perms.includes('STOCK_INVENTORY')) return '/inventory';
            if (perms.includes('PRICE_CHECK')) return '/price-check';
            if (perms.includes('PARKED_ORDERS')) return '/parked';
            if (perms.includes('SHIFTS_READING')) return '/shifts';
            return '/login'; // if absolutely no UI permissions, kick them out
        };

        // If specific roles are required, ensure user's role is permitted
        if (roles && roles.length > 0 && !roles.includes(user.role)) {
            return <Navigate to={getFallbackRoute()} replace />;
        }

        // If a required permission is specified, verify it
        if (requiredPermission) {
            const hasPermission = user.permissions?.includes(requiredPermission);
            if (!hasPermission) {
                const fallback = getFallbackRoute();
                // Prevent infinite loop if the fallback is the exact route we are checking
                // Note: The router handles this gracefully but just to be safe:
                return <Navigate to={fallback} replace />;
            }
        }
    }

    return <>{children}</>;
}

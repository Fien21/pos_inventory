import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    permissions?: string[];
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    rfidLogin: (rfidUid: string, pin: string) => Promise<void>;
    logActivity: (action: string, details?: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const logActivity = async (action: string, details?: string) => {
        try {
            await axios.post('/api/audit-logs/activity', { action, details });
        } catch (e) {
            console.error("Failed to log activity", e);
        }
    };

    const logout = async () => {
        try {
            await axios.post('/api/audit-logs/activity', { action: 'LOGOUT' });
        } catch (e) {} // ignore if it fails
        setUser(null);
        setToken(null);
        delete axios.defaults.headers.common['Authorization'];
        localStorage.removeItem('shadow-apollo-auth');
    };

    useEffect(() => {
        const stored = localStorage.getItem('shadow-apollo-auth');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setUser(parsed.user);
                setToken(parsed.token);
                axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.token}`;

                // Validate and refresh active user and dynamic permissions from server
                axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${parsed.token}` } })
                    .then((res) => {
                        if (res.data && res.data.user) {
                            setUser(res.data.user);
                            localStorage.setItem('shadow-apollo-auth', JSON.stringify({ user: res.data.user, token: parsed.token }));
                        }
                    })
                    .catch(() => {
                        // If token is invalid, interceptor or error will handle
                    });
            } catch {
                localStorage.removeItem('shadow-apollo-auth');
            }
        }
        setLoading(false);

        // Global response interceptor for 401 responses
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    setUser(null);
                    setToken(null);
                    delete axios.defaults.headers.common['Authorization'];
                    localStorage.removeItem('shadow-apollo-auth');
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    const login = async (email: string, password: string) => {
        const res = await axios.post('/api/auth/login', { email, password });
        const { token: newToken, user: newUser } = res.data;
        setUser(newUser);
        setToken(newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        localStorage.setItem('shadow-apollo-auth', JSON.stringify({ user: newUser, token: newToken }));
    };

    const rfidLogin = async (rfidUid: string, pin: string) => {
        const res = await axios.post('/api/auth/rfid-login', { rfidUid, pin });
        const { token: newToken, user: newUser } = res.data;
        setUser(newUser);
        setToken(newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        localStorage.setItem('shadow-apollo-auth', JSON.stringify({ user: newUser, token: newToken }));
    };

    return (
        <AuthContext.Provider value={{ user, token, login, rfidLogin, logActivity, logout, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

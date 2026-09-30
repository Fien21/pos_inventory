import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
    Package,
    AlertTriangle,
    ShoppingCart,
    TrendingUp,
    FolderOpen,
    BarChart2,
    RefreshCw,
} from 'lucide-react';

interface DashboardStats {
    totalProducts: number;
    lowStockProducts: number;
    totalTransactions: number;
    totalCategories: number;
    todaySalesAmount: number;
    todaySalesCount: number;
    recentTransactions: any[];
}

interface ChartData {
    salesOverTime: Array<{ date: string; amount: number; count: number }>;
    stockByCategory: Array<{ categoryName: string; stockQty: number }>;
}

const PesoIcon = ({ size = 22 }: { size?: number }) => (
    <span style={{ 
        fontSize: `${size * 0.9}px`, 
        fontWeight: 'bold', 
        fontFamily: 'system-ui, -apple-system, sans-serif', 
        lineHeight: 1, 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: size,
        height: size
    }}>
        ₱
    </span>
);

export default function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [chartsLoading, setChartsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Tooltip state for SVG charts
    const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; content: string; show: boolean }>({
        x: 0,
        y: 0,
        title: '',
        content: '',
        show: false,
    });

    const fetchData = async (silent = false) => {
        if (!silent) {
            setLoading(stats === null);
            setChartsLoading(chartData === null);
        }
        setIsRefreshing(true);
        try {
            const statsRes = await axios.get('/api/transactions/stats/dashboard');
            setStats(statsRes.data);
            setLoading(false);

            if (user?.role === 'ADMIN') {
                const chartsRes = await axios.get('/api/transactions/stats/charts');
                setChartData(chartsRes.data);
                setChartsLoading(false);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard metrics:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Polling interval: 5 seconds for ADMIN (real-time monitor), 30 seconds for others
        const intervalTime = user?.role === 'ADMIN' ? 5000 : 30000;
        const interval = setInterval(() => fetchData(true), intervalTime);
        return () => clearInterval(interval);
    }, [user?.role]);

    const statCards = stats
        ? [
            { icon: Package, label: 'Total Products', value: stats.totalProducts, color: '#6c63ff' },
            { icon: AlertTriangle, label: 'Low Stock', value: stats.lowStockProducts, color: '#e67700' },
            { icon: ShoppingCart, label: 'Transactions', value: stats.totalTransactions, color: '#0b7285' },
            { icon: FolderOpen, label: 'Categories', value: stats.totalCategories, color: '#a855f7' },
            { icon: PesoIcon, label: "Today's Sales", value: `₱${stats.todaySalesAmount.toFixed(2)}`, color: '#2b8a3e' },
            { icon: TrendingUp, label: "Today's Orders", value: stats.todaySalesCount, color: '#343a40' },
        ]
        : [];

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } },
    };
    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
    };

    // Calculate Y-axes and path elements for Sales Line Chart
    const renderSalesLineChart = () => {
        if (!chartData || !chartData.salesOverTime || chartData.salesOverTime.length === 0) {
            return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    No sales data available.
                </div>
            );
        }

        const data = chartData.salesOverTime;
        const maxVal = Math.max(...data.map(d => d.amount), 50) * 1.15;
        
        const svgW = 500;
        const svgH = 220;
        const padLeft = 50;
        const padRight = 20;
        const padTop = 20;
        const padBottom = 30;

        const plotW = svgW - padLeft - padRight;
        const plotH = svgH - padTop - padBottom;

        // Path generation
        let pathD = '';
        data.forEach((pt, i) => {
            const x = padLeft + i * (plotW / (data.length - 1 || 1));
            const y = padTop + plotH - (pt.amount / maxVal) * plotH;
            if (i === 0) {
                pathD += `M ${x} ${y}`;
            } else {
                pathD += ` L ${x} ${y}`;
            }
        });

        const firstX = padLeft;
        const lastX = padLeft + (data.length - 1) * (plotW / (data.length - 1 || 1));
        const bottomY = padTop + plotH;
        const areaD = `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

        // Y-axis grid values
        const gridLevels = [0, 0.25, 0.5, 0.75, 1];

        return (
            <div className="svg-chart-container">
                <svg className="chart-svg" viewBox={`0 0 ${svgW} ${svgH}`}>
                    <defs>
                        <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0"/>
                        </linearGradient>
                    </defs>

                    {/* Grid lines & Y Axis labels */}
                    {gridLevels.map((lvl, index) => {
                        const y = padTop + plotH * lvl;
                        const labelVal = maxVal * (1 - lvl);
                        return (
                            <g key={index}>
                                <line x1={padLeft} y1={y} x2={svgW - padRight} y2={y} className="chart-grid-line" />
                                <text x={padLeft - 8} y={y + 4} textAnchor="end" className="chart-axis-text">
                                    ₱{labelVal >= 1000 ? `${(labelVal / 1000).toFixed(1)}k` : labelVal.toFixed(0)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Area path */}
                    <path d={areaD} className="chart-area-path" />

                    {/* Line path */}
                    <path d={pathD} className="chart-line-path" />

                    {/* X axis labels & data points */}
                    {data.map((pt, i) => {
                        const x = padLeft + i * (plotW / (data.length - 1 || 1));
                        const y = padTop + plotH - (pt.amount / maxVal) * plotH;
                        return (
                            <g key={i}>
                                <text x={x} y={svgH - 8} textAnchor="middle" className="chart-axis-text">
                                    {pt.date}
                                </text>
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={5}
                                    className="chart-point"
                                    onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const containerRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                        setTooltip({
                                            show: true,
                                            x: rect.left - (containerRect?.left || 0) + 5,
                                            y: rect.top - (containerRect?.top || 0),
                                            title: pt.date,
                                            content: `Sales: ₱${pt.amount.toFixed(2)} (${pt.count} orders)`,
                                        });
                                    }}
                                    onMouseLeave={() => setTooltip(prev => ({ ...prev, show: false }))}
                                />
                            </g>
                        );
                    })}

                    <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} className="chart-axis-line" />
                    <line x1={padLeft} y1={padTop + plotH} x2={svgW - padRight} y2={padTop + plotH} className="chart-axis-line" />
                </svg>
            </div>
        );
    };

    // Calculate columns and values for Stock Category Bar Chart
    const renderStockBarChart = () => {
        if (!chartData || !chartData.stockByCategory || chartData.stockByCategory.length === 0) {
            return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    No inventory categories available.
                </div>
            );
        }

        const data = chartData.stockByCategory;
        const maxVal = Math.max(...data.map(d => d.stockQty), 20) * 1.15;

        const svgW = 500;
        const svgH = 220;
        const padLeft = 45;
        const padRight = 20;
        const padTop = 20;
        const padBottom = 30;

        const plotW = svgW - padLeft - padRight;
        const plotH = svgH - padTop - padBottom;

        const numBars = data.length;
        const colW = plotW / (numBars || 1);
        const barW = Math.min(32, colW * 0.6);

        const gridLevels = [0, 0.25, 0.5, 0.75, 1];

        return (
            <div className="svg-chart-container">
                <svg className="chart-svg" viewBox={`0 0 ${svgW} ${svgH}`}>
                    {/* Grid lines & Y Axis labels */}
                    {gridLevels.map((lvl, index) => {
                        const y = padTop + plotH * lvl;
                        const labelVal = maxVal * (1 - lvl);
                        return (
                            <g key={index}>
                                <line x1={padLeft} y1={y} x2={svgW - padRight} y2={y} className="chart-grid-line" />
                                <text x={padLeft - 8} y={y + 4} textAnchor="end" className="chart-axis-text">
                                    {labelVal.toFixed(0)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Bars */}
                    {data.map((cat, i) => {
                        const x = padLeft + i * colW + (colW - barW) / 2;
                        const barH = (cat.stockQty / maxVal) * plotH;
                        const y = padTop + plotH - barH;
                        // Truncate category name if too long
                        const displayName = cat.categoryName.length > 8 ? `${cat.categoryName.substring(0, 6)}..` : cat.categoryName;
                        return (
                            <g key={i}>
                                <rect
                                    x={x}
                                    y={y}
                                    width={barW}
                                    height={Math.max(barH, 2)} // ensure at least 2px height so it's visible
                                    className="chart-bar"
                                    onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const containerRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                        setTooltip({
                                            show: true,
                                            x: rect.left - (containerRect?.left || 0) + barW / 2,
                                            y: rect.top - (containerRect?.top || 0),
                                            title: cat.categoryName,
                                            content: `Total Stock: ${cat.stockQty} units`,
                                        });
                                    }}
                                    onMouseLeave={() => setTooltip(prev => ({ ...prev, show: false }))}
                                />
                                <text x={x + barW / 2} y={svgH - 8} textAnchor="middle" className="chart-axis-text">
                                    {displayName}
                                </text>
                            </g>
                        );
                    })}

                    <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} className="chart-axis-line" />
                    <line x1={padLeft} y1={padTop + plotH} x2={svgW - padRight} y2={padTop + plotH} className="chart-axis-line" />
                </svg>
            </div>
        );
    };

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p>Welcome back, {user?.name}! Here's your overview.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {user?.role === 'ADMIN' && (
                        <div className="live-badge">
                            <span className="live-pulse" />
                            Live Monitoring
                        </div>
                    )}
                    <button 
                        className="btn btn-secondary" 
                        onClick={() => fetchData()}
                        disabled={isRefreshing}
                        style={{ padding: '8px 12px' }}
                        title="Refresh Data"
                    >
                        <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                    <span className="role-badge">{user?.role}</span>
                </div>
            </div>

            {loading ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.div className="stats-grid" variants={container} initial="hidden" animate="show">
                        {statCards.map((card) => (
                            <motion.div key={card.label} className="stat-card" variants={item} whileHover={{ y: -4 }}>
                                <div className="stat-icon" style={{ background: `${card.color}15`, color: card.color }}>
                                    <card.icon size={22} />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-value">{card.value}</span>
                                    <span className="stat-label">{card.label}</span>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Chart section (ADMIN only) */}
                    {user?.role === 'ADMIN' && (
                        <div className="charts-grid">
                            <div className="chart-card">
                                <div className="chart-header">
                                    <h3 className="chart-title">
                                        <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
                                        Weekly Sales Volume
                                    </h3>
                                </div>
                                {chartsLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
                                        <div className="spinner" />
                                    </div>
                                ) : (
                                    renderSalesLineChart()
                                )}
                            </div>

                            <div className="chart-card">
                                <div className="chart-header">
                                    <h3 className="chart-title">
                                        <BarChart2 size={18} style={{ color: 'var(--accent)' }} />
                                        Stock Level by Category
                                    </h3>
                                </div>
                                {chartsLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
                                        <div className="spinner" />
                                    </div>
                                ) : (
                                    renderStockBarChart()
                                )}
                            </div>
                        </div>
                    )}

                    {/* Recent Transactions Table */}
                    {stats && stats.recentTransactions.length > 0 && (
                        <motion.div
                            className="card"
                            style={{ marginTop: '24px' }}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <h2 className="card-title">Recent Transactions</h2>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Cashier</th>
                                            <th>Items</th>
                                            <th>Total</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.recentTransactions.map((txn: any) => (
                                            <tr key={txn.id}>
                                                <td><strong>#{txn.id}</strong></td>
                                                <td>{txn.cashier.name}</td>
                                                <td>{txn._count.items} items</td>
                                                <td className="text-green" style={{ fontWeight: '700' }}>
                                                    ₱{txn.totalAmount.toFixed(2)}
                                                </td>
                                                <td>{new Date(txn.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {/* SVG Chart Tooltip */}
                    <AnimatePresence>
                        {tooltip.show && (
                            <motion.div
                                className="chart-tooltip"
                                style={{ left: tooltip.x, top: tooltip.y }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                            >
                                <span className="chart-tooltip-date">{tooltip.title}</span>
                                <span className="chart-tooltip-val">{tooltip.content}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
}

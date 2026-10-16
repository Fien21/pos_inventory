import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    Package,
    AlertTriangle,
    ShoppingCart,
    FolderOpen,
    TrendingUp,
    RefreshCw,
    CircleDot,
    BarChart2
} from 'lucide-react';

const PesoIcon = ({ className }: { className?: string }) => (
    <span className={`font-serif font-bold ${className}`} style={{ fontSize: '1.2em', lineHeight: 1 }}>₱</span>
);

export default function Dashboard() {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [dashboardStats, setDashboardStats] = useState<any>(null);
    const [chartsStats, setChartsStats] = useState<any>(null);
    const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, chartsRes, productsRes] = await Promise.all([
                axios.get('/api/transactions/stats/dashboard'),
                user?.role === 'ADMIN' ? axios.get('/api/transactions/stats/charts') : Promise.resolve({ data: null }),
                axios.get('/api/products')
            ]);
            setDashboardStats(statsRes.data);
            setChartsStats(chartsRes.data);
            const lowStock = productsRes.data.filter((p: any) => p.stockQty <= 10).slice(0, 5);
            setLowStockProducts(lowStock);
        } catch (error) {
            console.error('Failed to fetch dashboard data', error);
        }
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        fetchDashboardData();
        return () => clearInterval(timer);
    }, [user?.role]);

    const formatCurrency = (val: number) => `₱${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const avgBasketValue = dashboardStats && dashboardStats.todaySalesCount > 0 
        ? dashboardStats.todaySalesAmount / dashboardStats.todaySalesCount 
        : 0;

    const stats = [
        { label: 'Total Products', value: dashboardStats ? dashboardStats.totalProducts.toString() : '0', icon: Package, iconColor: 'text-indigo-600', iconBg: 'bg-indigo-50', badge: 'ACTIVE', badgeType: 'gray', badgeBorder: true },
        { label: 'Low Stock Alert', value: dashboardStats ? dashboardStats.lowStockProducts.toString() : '0', icon: AlertTriangle, iconColor: 'text-amber-500', iconBg: 'bg-amber-50', badge: 'ACTION REQ', badgeType: 'yellow', badgeBorder: false },
        { label: 'Today\'s Transactions', value: dashboardStats ? dashboardStats.todaySalesCount.toString() : '0', icon: ShoppingCart, iconColor: 'text-blue-500', iconBg: 'bg-blue-50', badge: '0%', badgeType: 'green-text', badgeBorder: false },
        { label: 'Active Categories', value: dashboardStats ? dashboardStats.totalCategories.toString() : '0', icon: FolderOpen, iconColor: 'text-purple-600', iconBg: 'bg-purple-50', badge: 'TOTAL', badgeType: 'gray', badgeBorder: true },
        { label: 'Today\'s Sales', value: dashboardStats ? formatCurrency(dashboardStats.todaySalesAmount) : '₱0.00', icon: PesoIcon, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-50', badge: '0%', badgeType: 'green', badgeBorder: false },
        { label: 'Avg. Basket Value', value: formatCurrency(avgBasketValue), icon: TrendingUp, iconColor: 'text-slate-500', iconBg: 'bg-slate-100', badge: 'PER ORDER', badgeType: 'gray', badgeBorder: true },
    ];

    const chartData = chartsStats?.salesOverTime?.map((s: any) => ({ date: s.date, val: s.amount, isPeak: false })) || [
        { date: '', val: 0 }, { date: '', val: 0 }, { date: '', val: 0 }, { date: '', val: 0 }, { date: '', val: 0 }, { date: '', val: 0, isPeak: false }, { date: '', val: 0 }
    ];
    if (chartData.length > 0 && chartsStats?.salesOverTime) {
        const maxIndex = chartData.reduce((bestIndex: number, current: any, i: number, arr: any[]) => current.val > arr[bestIndex].val ? i : bestIndex, 0);
        if (chartData[maxIndex].val > 0) {
            chartData[maxIndex].isPeak = true;
        }
    }

    const recentOrders = dashboardStats?.recentTransactions?.map((t: any) => ({
        id: t.id.toString(),
        method: t.paymentModeId === 2 ? 'GCash' : t.paymentModeId === 3 ? 'Maya / Card' : 'Cash',
        time: new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        amount: formatCurrency(t.totalAmount)
    })) || [];

    const lowStock = lowStockProducts.map(p => ({
        name: p.name, stock: p.stockQty, min: 10
    }));

    const renderSalesLineChart = () => {
        const svgW = 800;
        const svgH = 220;
        const padLeft = 40;
        const padRight = 30;
        const padTop = 30;
        const padBottom = 30;

        const plotW = svgW - padLeft - padRight;
        const plotH = svgH - padTop - padBottom;
        const maxVal = Math.max(400, ...chartData.map((d: any) => d.val)) * 1.1;

        let pathD = '';
        chartData.forEach((pt: any, i: number) => {
            const x = padLeft + i * (plotW / (chartData.length - 1));
            const y = padTop + plotH - (pt.val / maxVal) * plotH;
            if (i === 0) pathD += `M ${x} ${y}`;
            else pathD += ` L ${x} ${y}`;
        });

        const firstX = padLeft;
        const lastX = padLeft + (chartData.length - 1) * (plotW / (chartData.length - 1));
        const bottomY = padTop + plotH;
        const areaD = `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

        const gridLevels = [0, 0.5, 1];

        return (
            <div className="w-full h-full relative">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${svgW} ${svgH}`}>
                    <defs>
                        <linearGradient id="chartGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.15"></stop>
                            <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.0"></stop>
                        </linearGradient>
                    </defs>

                    {gridLevels.map((lvl, index) => {
                        const y = padTop + plotH * lvl;
                        const labelVal = maxVal * (1 - lvl);
                        return (
                            <g key={index}>
                                <line x1={padLeft} y1={y} x2={svgW - padRight} y2={y} stroke="#f1f5f9" strokeWidth="1.5" />
                                {labelVal > 0 && (
                                    <text x={padLeft - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-semibold">
                                        {labelVal >= 1000 ? `₱${(labelVal / 1000).toFixed(1)}k` : `₱${labelVal.toFixed(0)}`}
                                    </text>
                                )}
                                {labelVal === 0 && (
                                    <text x={padLeft - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-semibold">
                                        ₱0
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    <path d={areaD} fill="url(#chartGrad)" />
                    <path d={pathD} fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                    {chartData.map((pt: any, i: number) => {
                        const x = padLeft + i * (plotW / (chartData.length - 1));
                        const y = padTop + plotH - (pt.val / maxVal) * plotH;
                        return (
                            <g key={i}>
                                <text x={x} y={svgH - 5} textAnchor="middle" className="text-[10px] font-semibold fill-slate-500">
                                    {pt.date}
                                </text>
                                <circle
                                    cx={x} cy={y} r="4.5"
                                    fill="#ffffff" stroke="#0f172a" strokeWidth="2.5"
                                />
                                {pt.isPeak && (
                                    <g transform={`translate(${x}, ${y - 15})`}>
                                        <rect x="-45" y="-20" width="90" height="20" rx="4" fill="#0f172a" />
                                            {formatCurrency(pt.val)} (Peak)
                                    </g>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            {/* Top Header */}
            <header className="h-[60px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Dashboard</h1>
                    <p className="text-[11px] text-slate-500 font-medium">Welcome back, {user?.name || 'System Admin'}! Here's your overview today.</p>
                </div>

                <div className="flex items-center gap-2.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold tracking-wide">
                        <CircleDot className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500 animate-pulse" />
                        LIVE MONITORING
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold tracking-wide">
                        <CircleDot className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />
                        System Healthy
                    </div>

                    <div className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                        {currentTime.toLocaleTimeString()}
                    </div>

                    <button className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    <button className="bg-slate-900 text-white text-[11px] font-bold px-3 py-1 rounded flex items-center gap-1.5 hover:bg-slate-800 transition-colors">
                        <span>+</span> Quick Sale
                    </button>

                    <div className="border border-slate-200 bg-white text-slate-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                        ADMIN
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-5 overflow-y-auto space-y-4">

                {/* Stats Row */}
                <div className="grid grid-cols-6 gap-3">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                                <div className={`w-8 h-8 rounded ${stat.iconBg} ${stat.iconColor} flex items-center justify-center`}>
                                    <stat.icon className="w-4 h-4" />
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${stat.badgeType === 'gray' ? 'bg-slate-100 text-slate-500' :
                                        stat.badgeType === 'yellow' ? 'bg-amber-100 text-amber-700' :
                                            stat.badgeType === 'green-text' ? 'text-emerald-500 bg-transparent' :
                                                'bg-emerald-100 text-emerald-700'
                                    } ${stat.badgeBorder ? 'border border-slate-200 bg-white text-slate-400' : ''}`}>
                                    {stat.badge}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">{stat.value}</h3>
                                <p className="text-[10px] text-slate-500 font-medium">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Charts Row */}
                <div className="flex gap-4">
                    {/* Line Chart */}
                    <div className="flex-[2] bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex gap-2">
                                <div className="p-1 rounded bg-slate-100 text-slate-600 self-start">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <h2 className="text-[13px] font-bold text-slate-900 leading-tight">Weekly Sales Volume</h2>
                                    <p className="text-[10px] text-slate-500">Last 7 Days</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[16px] font-bold text-slate-900 leading-tight">
                                    {formatCurrency(chartsStats?.salesOverTime?.reduce((sum: number, s: any) => sum + s.amount, 0) || 0)}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-h-[220px]">
                            {renderSalesLineChart()}
                        </div>

                        <div className="flex justify-between items-center mt-2 text-[10px] font-medium text-slate-500 border-t border-slate-100 pt-3">
                            <div>Highest conversion: <span className="font-bold text-slate-700">{chartData.find((d: any) => d.isPeak)?.date || '-'}</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-900"></div> Total 7 Day Net Revenue</div>
                        </div>
                    </div>

                    {/* Bars Chart */}
                    <div className="flex-[1] bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex gap-2">
                                <div className="p-1 rounded bg-slate-100 text-slate-600 self-start">
                                    <BarChart2 className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <h2 className="text-[13px] font-bold text-slate-900 leading-tight">Stock Level by Category</h2>
                                    <p className="text-[10px] text-slate-500">Inventory volume distribution</p>
                                </div>
                            </div>
                            <button className="text-[10px] font-medium text-slate-500 hover:text-slate-900">Manage {'>'}</button>
                        </div>

                        <div className="flex-1 space-y-4">
                            {chartsStats?.stockByCategory?.slice(0, 4).map((cat: any, i: number) => {
                                const colors = ['bg-slate-900', 'bg-blue-600', 'bg-emerald-500', 'bg-amber-500'];
                                const totalStock = chartsStats.stockByCategory.reduce((sum: number, c: any) => sum + c.stockQty, 0);
                                const pct = totalStock > 0 ? (cat.stockQty / totalStock * 100).toFixed(0) + '%' : '0%';
                                return (
                                    <div key={i} className="space-y-1.5">
                                        <div className="flex justify-between text-[11px] font-bold text-slate-800">
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`}></div>
                                                {cat.categoryName}
                                            </div>
                                            <div className="flex gap-2 text-[10px]">
                                                <span className={cat.stockQty <= 10 ? "text-amber-500" : "text-slate-400 font-medium"}>{cat.stockQty} units</span>
                                                <span>{pct}</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                            <div className={`h-full ${colors[i % colors.length]} rounded-full`} style={{ width: pct }}></div>
                                        </div>
                                    </div>
                                );
                            }) || (
                                <div className="text-slate-400 text-xs text-center mt-8">No category data available</div>
                            )}
                        </div>

                        <div className="flex justify-between items-center mt-6 text-[10px] font-medium border-t border-slate-100 pt-3">
                            <div className="text-slate-600">Total Stock in Warehouse: <span className="font-bold text-slate-900">{dashboardStats?.totalProducts || 0} Units</span></div>
                            <div className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold border border-emerald-100">Optimal Level</div>
                        </div>
                    </div>
                </div>

                {/* Bottom Row */}
                <div className="flex gap-4 pb-4">
                    {/* Orders Table */}
                    <div className="flex-[2] bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-900">Recent POS Orders</h2>
                                <p className="text-[10px] text-slate-500">Live feed directly connected to Register 01</p>
                            </div>
                            <button className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-100 transition-colors">
                                View All Orders
                            </button>
                        </div>

                        <table className="w-full text-[11px] text-left border-separate border-spacing-y-2">
                            <thead>
                                <tr className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    <th className="font-medium pb-2 border-b border-slate-100 w-1/5">ORDER REF</th>
                                    <th className="font-medium pb-2 border-b border-slate-100 w-1/5">PAYMENT METHOD</th>
                                    <th className="font-medium pb-2 border-b border-slate-100 w-1/5">TIME</th>
                                    <th className="font-medium pb-2 border-b border-slate-100 w-1/5 text-right pr-4">AMOUNT</th>
                                    <th className="font-medium pb-2 border-b border-slate-100 w-1/5">STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((order: any, i: number) => (
                                    <tr key={i} className="">
                                        <td className="py-2 border-b border-slate-50">
                                            <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                                                <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[9px] border border-emerald-100">-</span>
                                                Order {order.id}
                                            </span>
                                        </td>
                                        <td className="py-2 border-b border-slate-50 font-medium text-slate-600">
                                            {order.method === 'GCash' ? <span className="text-blue-500">GCash</span> : order.method === 'Maya / Card' ? <span className="text-purple-600">Maya / Card</span> : 'Cash'}
                                        </td>
                                        <td className="py-2 border-b border-slate-50 text-slate-400 font-medium">{order.time}</td>
                                        <td className="py-2 border-b border-slate-50 text-right pr-4 font-bold text-slate-900">{order.amount}</td>
                                        <td className="py-2 border-b border-slate-50">
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 text-[9px] font-bold">
                                                <CircleDot className="w-2 h-2 text-emerald-500 fill-emerald-500" /> Completed
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {recentOrders.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-4 text-center text-slate-400">No recent orders found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <div className="flex justify-between items-center mt-3 text-[10px] text-slate-400 font-medium pt-2">
                            <div>Showing last {recentOrders.length} live orders</div>
                            <div>Sync status: Real-time socket online</div>
                        </div>
                    </div>

                    {/* Low Stock SKUs */}
                    <div className="flex-[1] bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-900">Low Stock SKUs</h2>
                                <p className="text-[10px] text-slate-500">Critical reorder thresholds</p>
                            </div>
                            <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded">{dashboardStats?.lowStockProducts || 0} Needs Attention</span>
                        </div>

                        <div className="flex-1 space-y-3">
                            {lowStock.map((item, i) => (
                                <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                    <div>
                                        <div className="text-[11px] font-bold text-slate-900">{item.name}</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            Stock: <span className={item.stock <= 2 ? "text-red-500 font-bold" : "text-amber-500 font-bold"}>{item.stock} units</span> • Min: {item.min}
                                        </div>
                                    </div>
                                    <button className="border border-slate-200 bg-white text-slate-600 text-[10px] font-bold px-2 py-1 rounded hover:bg-slate-50 transition-colors">
                                        + Restock
                                    </button>
                                </div>
                            ))}
                            {lowStock.length === 0 && (
                                <div className="text-slate-400 text-xs text-center mt-4">No low stock items</div>
                            )}
                        </div>

                        <button className="w-full mt-4 bg-slate-900 text-white text-[11px] font-bold py-2.5 rounded hover:bg-slate-800 transition-colors">
                            Generate Reorder Purchase Orders
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}

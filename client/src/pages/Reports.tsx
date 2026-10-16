import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, DollarSign, Package } from 'lucide-react';
import Swal from 'sweetalert2';

export default function Reports() {
    const { token } = useAuth();
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const [summary, setSummary] = useState({ grossSales: 0, totalDiscount: 0, totalTax: 0, netSales: 0, totalCogs: 0, grossProfit: 0, transactionCount: 0 });
    const [categoryData, setCategoryData] = useState<any[]>([]);
    const [productData, setProductData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const COLORS = ['#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#e91e63', '#8bc34a', '#3f51b5', '#cddc39'];

    useEffect(() => {
        fetchReports();
    }, [dateRange]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const config = { headers: { Authorization: `Bearer ${token}` }, params: dateRange };
            const [summaryRes, categoryRes, productRes] = await Promise.all([
                axios.get('/api/reports/sales-summary', config),
                axios.get('/api/reports/sales-by-category', config),
                axios.get('/api/reports/top-products', config)
            ]);

            setSummary(summaryRes.data);
            setCategoryData(categoryRes.data);
            setProductData(productRes.data);
        } catch (error: any) {
            Swal.fire('Error', error.response?.data?.error || 'Failed to fetch reports', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex flex-col h-full bg-[#f8fafc]" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}><h3>Loading Reports...</h3></div>;
    }

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            {/* Header */}
            <header className="h-[72px] bg-white border-b border-slate-200 px-6 shrink-0 flex items-center justify-between shadow-sm z-10">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Sales & Analytics Reports</h1>
                    <p className="text-[13px] text-slate-500 font-medium mt-0.5">View advanced sales data, top products, and category breakdowns.</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <Calendar size={16} className="text-slate-500 ml-1" />
                    <input 
                        type="date" 
                        value={dateRange.startDate} 
                        onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                        className="bg-transparent border-none text-sm text-slate-700 font-medium outline-none cursor-pointer"
                    />
                    <span className="text-slate-400 text-sm font-medium px-1">to</span>
                    <input 
                        type="date" 
                        value={dateRange.endDate} 
                        onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                        className="bg-transparent border-none text-sm text-slate-700 font-medium outline-none cursor-pointer"
                    />
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-7xl mx-auto space-y-6">
                    
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Gross Sales */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
                            <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 mb-1">Gross Sales</h3>
                                <p className="text-2xl font-bold text-slate-900">₱{summary.grossSales.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Net Sales */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
                            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 mb-1">Net Sales</h3>
                                <p className="text-2xl font-bold text-slate-900">₱{summary.netSales.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Transactions */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
                            <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <Package size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 mb-1">Total Transactions</h3>
                                <p className="text-2xl font-bold text-slate-900">{summary.transactionCount}</p>
                            </div>
                        </div>

                        {/* Discounts */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
                            <div className="w-12 h-12 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                <TrendingUp size={24} className="rotate-180" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 mb-1">Discounts Given</h3>
                                <p className="text-2xl font-bold text-slate-900">₱{summary.totalDiscount.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* COGS */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
                            <div className="w-12 h-12 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                                <Package size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 mb-1">COGS (Cost of Goods)</h3>
                                <p className="text-2xl font-bold text-slate-900">₱{(summary.totalCogs || 0).toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Gross Profit */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
                            <div className="w-12 h-12 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 mb-1">Gross Profit</h3>
                                <p className="text-2xl font-bold text-emerald-600">₱{(summary.grossProfit || 0).toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Sales by Category Pie Chart */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col">
                            <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                Sales by Category
                            </h3>
                            <div className="flex-1 min-h-[350px]">
                                {categoryData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryData}
                                                dataKey="totalAmount"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={80}
                                                outerRadius={120}
                                                paddingAngle={5}
                                            >
                                                {categoryData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                formatter={(value: any) => `₱${Number(value).toFixed(2)}`} 
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 font-medium">No data for selected range.</div>
                                )}
                            </div>
                        </div>

                        {/* Top Selling Products Bar Chart */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col">
                            <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                Top Selling Products
                            </h3>
                            <div className="flex-1 min-h-[350px]">
                                {productData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={productData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                                            <XAxis 
                                                type="number" 
                                                tickFormatter={(value) => `₱${value}`} 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 12 }} 
                                            />
                                            <YAxis 
                                                type="category" 
                                                dataKey="name" 
                                                width={120} 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#475569', fontSize: 11, width: 110 }} 
                                                interval={0}
                                            />
                                            <Tooltip 
                                                formatter={(value: any) => `₱${Number(value).toFixed(2)}`} 
                                                cursor={{ fill: '#f1f5f9' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="totalAmount" fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={24}>
                                                {productData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 font-medium">No data for selected range.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { getExpenses, getCategories } from '../api/client';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, Calendar } from 'lucide-react';

export default function Analytics() {
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // NEW: State to track which month is currently selected
    const [selectedMonth, setSelectedMonth] = useState(null);

    const COLORS = ['#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#6366f1', '#f43f5e'];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [expRes, catRes] = await Promise.all([getExpenses(), getCategories()]);
                const expData = expRes.data.data || [];
                setExpenses(expData);
                setCategories(catRes.data.data || []);

                // Set default selected month to the most recent month in the data
                if (expData.length > 0) {
                    const trend = calculateTrend(expData);
                    setSelectedMonth(trend[trend.length - 1].name);
                }
            } catch (error) {
                console.error("Error fetching analytics data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const calculateTrend = (data) => {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyData = data.reduce((acc, exp) => {
            const date = new Date(exp.date);
            const monthYear = `${months[date.getMonth()]} ${date.getFullYear()}`;
            if (!acc[monthYear]) {
                acc[monthYear] = {
                    name: monthYear,
                    total: 0,
                    rawDate: new Date(date.getFullYear(), date.getMonth(), 1)
                };
            }
            acc[monthYear].total += exp.amount;
            return acc;
        }, {});

        return Object.values(monthlyData).sort((a, b) => a.rawDate - b.rawDate);
    };

    // Filter categories based on the month clicked in the bar chart
    const getFilteredCategoryData = () => {
        if (!selectedMonth) return [];

        return categories.map(cat => {
            const total = expenses
                .filter(e => {
                    const date = new Date(e.date);
                    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    const monthYear = `${months[date.getMonth()]} ${date.getFullYear()}`;
                    return e.category_id === cat.id && monthYear === selectedMonth;
                })
                .reduce((sum, e) => sum + e.amount, 0);

            return { name: cat.name, value: total };
        }).filter(d => d.value > 0);
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(value);
    };

    // Handler for when a bar is clicked
    const handleBarClick = (data) => {
        if (data && data.activeLabel) {
            setSelectedMonth(data.activeLabel);
        }
    };

    if (loading) return <div style={{ padding: '20px' }}>Analyzing your spending...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

            {/* Monthly Spending Trend */}
            <div className="action-card" style={{ height: '450px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="icon-wrapper" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
                            <TrendingUp size={20} />
                        </div>
                        <h2 className="section-title" style={{ margin: 0 }}>Monthly Spending Trend</h2>
                    </div>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>Click a bar to see details</p>
                </div>

                <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={calculateTrend(expenses)}
                            onClick={handleBarClick}
                            style={{ cursor: 'pointer' }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(v) => `₹${v}`} />
                            <Tooltip
                                cursor={{fill: '#f1f5f9'}}
                                formatter={(value) => formatCurrency(value)}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={50}>
                                {calculateTrend(expenses).map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.name === selectedMonth ? '#1e293b' : '#3b82f6'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="dashboard-grid" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
                {/* Dynamic Pie Chart */}
                <div className="action-card" style={{ height: '450px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div className="icon-wrapper" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
                            <PieIcon size={20} />
                        </div>
                        <h2 className="section-title" style={{ margin: 0 }}>
                            Category Breakdown: <span style={{color: '#3b82f6'}}>{selectedMonth}</span>
                        </h2>
                    </div>

                    <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={getFilteredCategoryData()}
                                    innerRadius={80}
                                    outerRadius={130}
                                    paddingAngle={5}
                                    dataKey="value"
                                    animationBegin={0}
                                    animationDuration={800}
                                >
                                    {getFilteredCategoryData().map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Stats Summary Card */}
                <div className="action-stack">
                    <div className="card theme-sky" style={{ padding: '24px' }}>
                        <div className="card-header">
                            <h3 className="card-title">Monthly Total</h3>
                            <div className="icon-wrapper"><Calendar size={18} /></div>
                        </div>
                        <h2 className="card-value" style={{fontSize: '32px'}}>
                            {formatCurrency(
                                getFilteredCategoryData().reduce((sum, item) => sum + item.value, 0)
                            )}
                        </h2>
                        <p style={{ fontSize: '13px', opacity: 0.8, marginTop: '8px' }}>
                            Total spending recorded for {selectedMonth}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
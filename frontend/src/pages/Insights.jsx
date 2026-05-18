import { useState, useEffect } from 'react';
import { getExpenses } from '../api/client';
import { Trophy, Calendar, CalendarDays, CreditCard, Sparkles } from 'lucide-react';

export default function Insights() {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState({
        highestSingle: { amount: 0, description: "", date: "" },
        highestDay: { amount: 0, date: "" },
        highestYear: { amount: 0, year: "" }
    });

    useEffect(() => {
        fetchInsights();
    }, []);

    const fetchInsights = async () => {
        setLoading(true);
        try {
            const response = await getExpenses();
            const expenses = response.data.data || [];

            if (expenses.length === 0) {
                setLoading(false);
                return;
            }

            // 1. Highest Single Transaction
            const highestSingle = expenses.reduce((max, exp) => exp.amount > max.amount ? exp : max, expenses[0]);

            // 2. Group by Day to find Highest Day
            const dailyTotals = {};
            // 3. Group by Year to find Highest Year
            const yearlyTotals = {};

            expenses.forEach(exp => {
                const dateObj = new Date(exp.date);
                const dayKey = dateObj.toISOString().split('T')[0]; // "YYYY-MM-DD"
                const yearKey = dateObj.getFullYear().toString();   // "YYYY"

                dailyTotals[dayKey] = (dailyTotals[dayKey] || 0) + exp.amount;
                yearlyTotals[yearKey] = (yearlyTotals[yearKey] || 0) + exp.amount;
            });

            // Find Max Day
            const highestDay = Object.entries(dailyTotals).reduce(
                (max, [date, amount]) => amount > max.amount ? { date, amount } : max,
                { date: "", amount: 0 }
            );

            // Find Max Year
            const highestYear = Object.entries(yearlyTotals).reduce(
                (max, [year, amount]) => amount > max.amount ? { year, amount } : max,
                { year: "", amount: 0 }
            );

            setRecords({ highestSingle, highestDay, highestYear });
        } catch (error) {
            console.error("Failed to fetch insights", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    };

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    if (loading) return <div style={{ padding: '20px' }}>Crunching your numbers...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div className="icon-wrapper" style={{ backgroundColor: '#fef9c3', color: '#ca8a04' }}>
                    <Trophy size={28} />
                </div>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: 0 }}>All-Time Highs</h2>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Your personal spending records and milestones.</p>
                </div>
            </div>

            {/* Records Grid */}
            <div className="dashboard-grid">

                {/* Highest Single Expense */}
                <div className="action-card theme-red" style={{ position: 'relative', overflow: 'hidden' }}>
                    <Sparkles size={120} color="#fee2e2" style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.5, zIndex: 0 }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div className="card-header">
                            <h3 className="card-title">Largest Single Purchase</h3>
                            <div className="icon-wrapper"><CreditCard size={18} strokeWidth={2.5}/></div>
                        </div>
                        <h2 className="card-value" style={{ fontSize: '36px', marginTop: '10px' }}>
                            {formatCurrency(records.highestSingle.amount)}
                        </h2>
                        <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.6)', padding: '12px', borderRadius: '12px' }}>
                            <p style={{ margin: 0, fontWeight: '600', color: '#7f1d1d' }}>{records.highestSingle.description || "Unnamed Expense"}</p>
                            <p style={{ margin: 0, fontSize: '13px', color: '#991b1b' }}>{formatDate(records.highestSingle.date)}</p>
                        </div>
                    </div>
                </div>

                {/* Highest Day */}
                <div className="action-card theme-amber" style={{ position: 'relative', overflow: 'hidden' }}>
                    <CalendarDays size={120} color="#fef3c7" style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.5, zIndex: 0 }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div className="card-header">
                            <h3 className="card-title">Highest Spending Day</h3>
                            <div className="icon-wrapper"><CalendarDays size={18} strokeWidth={2.5} /></div>
                        </div>
                        <h2 className="card-value" style={{ fontSize: '36px', marginTop: '10px' }}>
                            {formatCurrency(records.highestDay.amount)}
                        </h2>
                        <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.6)', padding: '12px', borderRadius: '12px' }}>
                            <p style={{ margin: 0, fontWeight: '600', color: '#78350f' }}>Date</p>
                            <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>{formatDate(records.highestDay.date)}</p>
                        </div>
                    </div>
                </div>

                {/* Highest Year */}
                <div className="action-card theme-emerald" style={{ position: 'relative', overflow: 'hidden' }}>
                    <Calendar size={120} color="#d1fae5" style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.5, zIndex: 0 }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div className="card-header">
                            <h3 className="card-title">Highest Spending Year</h3>
                            <div className="icon-wrapper"><Calendar size={18} strokeWidth={2.5} /></div>
                        </div>
                        <h2 className="card-value" style={{ fontSize: '36px', marginTop: '10px' }}>
                            {formatCurrency(records.highestYear.amount)}
                        </h2>
                        <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.6)', padding: '12px', borderRadius: '12px' }}>
                            <p style={{ margin: 0, fontWeight: '600', color: '#064e3b' }}>Year</p>
                            <p style={{ margin: 0, fontSize: '13px', color: '#065f46' }}>{records.highestYear.year || "N/A"}</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
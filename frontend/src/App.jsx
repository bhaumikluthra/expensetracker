import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Insights from './pages/Insights';
import History from './pages/History';
import Login from './pages/Login';
import Register from './pages/Register';
import { LayoutGrid, Download, Calendar } from 'lucide-react';
import { getExpenses, logout, setAuthToken } from './api/client';

function AppContent() {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [exportRange, setExportRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        const token = localStorage.getItem('expenseTrackerToken');
        if (token) {
            setAuthToken(token);
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogout = () => {
        logout();
        setIsAuthenticated(false);
        navigate('/login');
    };

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };

    const handleExportCSV = async () => {
        try {
            const res = await getExpenses();
            const allExpenses = res.data.data || [];

            const filtered = allExpenses.filter(exp => {
                const d = exp.date.split('T')[0];
                return d >= exportRange.start && d <= exportRange.end;
            });

            const headers = ["Date", "Description", "Category", "Amount (INR)"];
            const rows = filtered.map(exp => [
                new Date(exp.date).toLocaleDateString(),
                `"${exp.description || "N/A"}"`, // Wrap in quotes to handle commas in text
                exp.category?.name || "N/A",
                exp.amount
            ]);

            const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `expenses_${exportRange.start}_to_${exportRange.end}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Export failed", err);
        }
    };

    return (
        <div className="app-container">
            {isAuthenticated && (
                <nav className="navbar" style={{ justifyContent: 'space-between' }}>

                    {/* Left Side: Logo & Navigation */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="nav-icon"><LayoutGrid size={22} /></div>
                            <h1 style={{ fontSize: '20px', fontWeight: '600' }}>BucksFlow</h1>
                        </div>

                        <div className="nav-menu">
                            <NavLink to="/" className="nav-link" end>Dashboard</NavLink>
                            <NavLink to="/history" className="nav-link">History</NavLink>
                            <NavLink to="/analytics" className="nav-link">Analytics</NavLink>
                            <NavLink to="/insights" className="nav-link">Insights</NavLink>
                        </div>
                    </div>

                    {/* Right Side: Export Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                            <Calendar size={16} />
                            <input type="date" className="nav-date" value={exportRange.start} onChange={e => setExportRange({...exportRange, start: e.target.value})} />
                            <span>to</span>
                            <input type="date" className="nav-date" value={exportRange.end} onChange={e => setExportRange({...exportRange, end: e.target.value})} />
                        </div>
                        <button onClick={handleExportCSV} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 15px', fontSize: '12px' }}>
                            <Download size={16} /> Export CSV
                        </button>
                        <button onClick={handleLogout} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 15px', fontSize: '12px' }}>
                            Logout
                        </button>
                    </div>
                </nav>
            )}

            {/* Routing Controller */}
            <main className="main-content">
                <Routes>
                    <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
                    <Route path="/history" element={isAuthenticated ? <History /> : <Navigate to="/login" replace />} />
                    <Route path="/analytics" element={isAuthenticated ? <Analytics /> : <Navigate to="/login" replace />} />
                    <Route path="/insights" element={isAuthenticated ? <Insights /> : <Navigate to="/login" replace />} />
                    <Route path="/login" element={!isAuthenticated ? <Login onLogin={handleLoginSuccess} /> : <Navigate to="/" replace />} />
                    <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}

// Wrap the main content in the Router provider
export default function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}
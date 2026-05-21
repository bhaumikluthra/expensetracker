import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Insights from './pages/Insights';
import History from './pages/History';
import Login from './pages/Login';
import Register from './pages/Register';
import { LayoutGrid, Download, Upload, Sparkles, Info } from 'lucide-react';
import { getExpenses, logout, setAuthToken, importCSV } from './api/client';

function AppContent() {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('expenseTrackerToken'));
    const [exportRange, setExportRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [showExportPanel, setShowExportPanel] = useState(false);
    const [showImportPanel, setShowImportPanel] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [defaultCategory, setDefaultCategory] = useState('Other');
    const [importing, setImporting] = useState(false);
    const [importPhase, setImportPhase] = useState('idle'); // idle | analyzing | adding
    const [importResult, setImportResult] = useState(null);
    const [importError, setImportError] = useState('');
    const [missingFields, setMissingFields] = useState([]);
    const [showImportErrorPopup, setShowImportErrorPopup] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('expenseTrackerToken');
        if (token) {
            setAuthToken(token);
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

    const formatFieldName = (field) => {
        const labels = { date: 'Date', amount: 'Amount', category: 'Category', description: 'Description' };
        return labels[field] || (field.charAt(0).toUpperCase() + field.slice(1));
    };

    const handleImportCSV = async () => {
        if (!importFile) {
            setImportError('Please choose a CSV file first.');
            setShowImportErrorPopup(true);
            return;
        }
        setImporting(true);
        setImportPhase('analyzing');
        setImportError('');
        setMissingFields([]);
        setShowImportErrorPopup(false);
        setImportResult(null);
        try {
            const res = await importCSV(importFile, defaultCategory);
            const data = res.data?.data;
            if (!data?.imported) {
                const msg = data?.errors?.[0] || 'No expenses could be imported from this CSV.';
                setImportError(msg);
                setShowImportErrorPopup(true);
                setImportPhase('idle');
                setImporting(false);
                return;
            }
            setImportResult(data);
            setImportPhase('adding');
            setImportFile(null);
            setTimeout(() => window.location.reload(), 1800);
        } catch (err) {
            const data = err.response?.data;
            const fields = data?.missing_fields || [];
            const msg = data?.message || data?.error || err.message || 'Import failed';
            setMissingFields(fields);
            setImportError(
                fields.length > 0
                    ? `Required detail is missing: ${fields.map(formatFieldName).join(', ')}. ${msg}`
                    : msg
            );
            setShowImportErrorPopup(true);
            setImportPhase('idle');
            setImporting(false);
        }
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
            {showImportErrorPopup && (
                <div className="import-error-overlay" onClick={() => setShowImportErrorPopup(false)}>
                    <div className="import-error-popup" onClick={(e) => e.stopPropagation()}>
                        <p className="import-error-popup__title">Cannot import CSV</p>
                        <p className="import-error-popup__text">{importError}</p>
                        {missingFields.length > 0 && (
                            <ul className="import-error-popup__list">
                                {missingFields.map((f) => (
                                    <li key={f}>Missing: <strong>{formatFieldName(f)}</strong></li>
                                ))}
                            </ul>
                        )}
                        <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} onClick={() => setShowImportErrorPopup(false)}>
                            OK
                        </button>
                    </div>
                </div>
            )}

            {showImportPanel && (
                <div className="import-modal-overlay" onClick={() => !importing && setShowImportPanel(false)}>
                    <div className="import-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="import-modal__header">
                            <p className="import-modal__title">
                                <Sparkles size={18} /> Add data as CSV
                            </p>
                            <button
                                type="button"
                                className="import-modal__close"
                                disabled={importing}
                                onClick={() => setShowImportPanel(false)}
                                aria-label="Close"
                            >
                                X
                            </button>
                        </div>
                        <div className="import-format-guide" role="note">
                            <div className="import-format-guide__header">
                                <Info size={18} />
                                <span>CSV format guide</span>
                            </div>
                            <p className="import-format-guide__lead">
                                Your file must include <strong>Date</strong> and <strong>Amount</strong> for each transaction.
                                Extra columns are fine — they will be ignored.
                            </p>
                            <p className="import-format-guide__label">Recommended format (BucksFlow export):</p>
                            <pre className="import-format-guide__sample">{`Date,Description,Category,Amount (INR)
21/5/2026,Swiggy lunch,Food,450
22/5/2026,Uber ride,Transport,120`}</pre>
                            <ul className="import-format-guide__list">
                                <li><strong>Date</strong> — e.g. 21/5/2026 or 2025-05-21</li>
                                <li><strong>Amount</strong> — positive number (₹450 or 450)</li>
                                <li><strong>Description</strong> — optional (merchant, notes)</li>
                                <li><strong>Category</strong> — optional (Food, Transport, etc.)</li>
                            </ul>
                            <p className="import-format-guide__note">
                                <strong>No date column?</strong> Put the period in the filename, e.g.{' '}
                                <code>expenses_2025-01-01_to_2025-01-31.csv</code> or <code>march_2025.csv</code>
                            </p>
                        </div>

                        <p className="import-modal__hint">
                            Step 1: Choose your CSV file. Step 2: Click <strong>Submit CSV</strong>.
                        </p>

                        <label className="import-file-label">
                            <span className="import-file-label__btn">Choose CSV file</span>
                            <input
                                type="file"
                                accept=".csv,text/csv"
                                disabled={importing}
                                className="import-file-input"
                                onChange={(e) => {
                                    setImportFile(e.target.files?.[0] || null);
                                    setImportError('');
                                    setImportResult(null);
                                    setShowImportErrorPopup(false);
                                }}
                            />
                        </label>

                        {importFile ? (
                            <p className="import-modal__selected">
                                Selected: <strong>{importFile.name}</strong>
                            </p>
                        ) : (
                            <p className="import-modal__selected import-modal__selected--empty">No file selected yet</p>
                        )}

                        <label className="import-modal__field-label">Default category (if missing)</label>
                        <input
                            type="text"
                            className="nav-date import-modal__input"
                            value={defaultCategory}
                            disabled={importing}
                            onChange={(e) => setDefaultCategory(e.target.value)}
                        />

                        {importing && (
                            <div className="import-loading-banner">
                                <span className="import-loading-banner__spinner" />
                                <span>
                                    {importPhase === 'adding'
                                        ? 'Loading data and adding into system…'
                                        : 'Analyzing CSV with AI…'}
                                </span>
                            </div>
                        )}
                        {importResult && importPhase === 'adding' && (
                            <div className="import-modal__success">
                                Added <strong>{importResult.imported}</strong> expense(s) to your account.
                                {importResult.parser === 'rules' && (
                                    <span style={{ display: 'block', marginTop: '4px', fontSize: '11px' }}>
                                        (Imported using column matching — AI quota was unavailable)
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="import-modal__actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={importing}
                                onClick={() => setShowImportPanel(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleImportCSV}
                                disabled={importing || !importFile}
                                className="btn btn-primary import-modal__submit"
                            >
                                {importing ? 'Please wait…' : 'Submit CSV'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isAuthenticated && (
                <nav className="navbar" style={{ justifyContent: 'space-between' }}>
                    <div className="navbar-left">
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

                    <div className="navbar-actions" style={{ position: 'relative' }}>
                        <button
                            type="button"
                            title="add data as csv"
                            onClick={() => { setShowImportPanel(prev => !prev); setShowExportPanel(false); }}
                            className="btn btn-secondary"
                            style={{ width: 'auto', padding: '8px 15px', fontSize: '12px' }}
                        >
                            <Upload size={16} /> Import data
                        </button>
                        <button onClick={() => { setShowExportPanel(prev => !prev); setShowImportPanel(false); }} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 15px', fontSize: '12px' }}>
                            <Download size={16} /> Export CSV
                        </button>

                        {showExportPanel && (
                            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)', padding: '18px', width: '320px', zIndex: 20 }}>
                                <p style={{ margin: 0, marginBottom: '10px', fontWeight: 600, color: '#0f172a' }}>Export transaction data</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '14px', color: '#475569' }}>From</span>
                                    <input type="date" className="nav-date" value={exportRange.start} onChange={e => setExportRange({ ...exportRange, start: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                    <span style={{ fontSize: '14px', color: '#475569' }}>To</span>
                                    <input type="date" className="nav-date" value={exportRange.end} onChange={e => setExportRange({ ...exportRange, end: e.target.value })} />
                                </div>
                                <button onClick={() => { handleExportCSV(); setShowExportPanel(false); }} className="btn btn-primary" style={{ width: '100%', padding: '10px 0', fontSize: '13px' }}>
                                    Download CSV
                                </button>
                            </div>
                        )}

                        <button onClick={handleLogout} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 15px', fontSize: '12px', marginLeft: '12px' }}>
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

function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}

export default App;
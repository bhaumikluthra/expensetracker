import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    getDashboardSummary, getCategories, createCategory,
    createExpense, setBudget, getExpenses, updateExpense, deleteExpense,
    updateCategory, deleteCategory
} from '../api/client';
import {
    Target, TrendingDown, Clock3, Zap, PlusCircle, Tags,
    ReceiptText, Pencil, Trash2, Save, PieChart as PieIcon, X, Wallet
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency, safeNumber } from '../utils/number';

/* ─── Design tokens ──────────────────────────────────────────────────── */
const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6'];
const REMAINING_COLOR = '#e2e8f0';

/* ─── Formatters ─────────────────────────────────────────────────────── */
// Automatically formats large numbers into K, L (Lakhs), and Cr (Crores)
const formatCompactCurrency = (value) => {
    const num = safeNumber(value);
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        notation: 'compact',
        maximumFractionDigits: 2
    }).format(num);
};

/* ─── Sub-components ────────────────────────────────────────────────── */

function StatCard({ title, value, icon: Icon, accent }) {
    return (
        <div className={`stat-card stat-card--${accent}`}>
            <div className="stat-card__header">
                <span className="stat-card__title">{title}</span>
                <div className="stat-card__icon"><Icon size={16} strokeWidth={2.5} /></div>
            </div>
            {/* Added title attribute so users can hover for the exact long number if they want */}
            <div className="stat-card__value" title={value}>{value}</div>
        </div>
    );
}

function TransactionRow({ expense, onEdit, onDelete }) {
    const expenseId = expense.id || expense.ID;
    const displayDate = new Date(expense.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    return (
        <div className="txn-row">
            <div className="txn-dot" />
            <div className="txn-body">
                <span className="txn-desc">{expense.description || 'Unnamed Expense'}</span>
                <span className="txn-meta">
                    <span className="txn-cat">{expense.category?.name || 'Unknown'}</span>
                    <span className="txn-date">{displayDate}</span>
                </span>
            </div>
            <div className="txn-right">
                {/* Abbreviated amount, hover for exact amount */}
                <span className="txn-amount" title={formatCurrency(expense.amount)}>
                    −{formatCompactCurrency(expense.amount)}
                </span>
                <div className="txn-actions">
                    <button onClick={() => onEdit({ ...expense, id: expenseId })} className="icon-btn icon-btn-edit" title="Edit">
                        <Pencil size={14} />
                    </button>
                    <button onClick={() => onDelete(expenseId)} className="icon-btn icon-btn-delete" title="Delete">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Custom Pie tooltip ─────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    return (
        <div className="pie-tooltip">
            <span className="pie-tooltip__name">{item.name}</span>
            <span className="pie-tooltip__value">{formatCurrency(item.value)}</span>
        </div>
    );
};

/* ─── Main Dashboard ────────────────────────────────────────────────── */
export default function Dashboard() {
    const [summary, setSummary] = useState({
        total_spend_this_month: 0,
        total_spend_today: 0,
        monthly_budget_left: 0,
        todays_budget: 0,
    });
    const [categories, setCategories] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [inlineCategoryName, setInlineCategoryName] = useState('');
    const todayString = new Date().toISOString().split('T')[0];
    const [expenseForm, setExpenseForm] = useState({ amount: '', description: '', category_id: '', date: todayString });
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingExpenseId, setEditingExpenseId] = useState(null);
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [inlineBudgetAmount, setInlineBudgetAmount] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [loading, setLoading] = useState(true);
    const [submittingExpense, setSubmittingExpense] = useState(false);
    const [expenseMessage, setExpenseMessage] = useState('');
    const [expenseError, setExpenseError] = useState('');

    const location = useLocation();

    async function fetchData() {
        setLoading(true);
        try {
            const [summaryRes, categoriesRes, expensesRes] = await Promise.all([
                getDashboardSummary(), getCategories(), getExpenses()
            ]);
            setSummary(summaryRes.data.data);
            setCategories(categoriesRes.data.data || []);
            setExpenses((expensesRes.data.data || []).sort((a, b) => new Date(b.date) - new Date(a.date)));
        } catch (err) {
            console.error('Failed to fetch data', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (location.state?.editExpense) {
            handleEditClick(location.state.editExpense);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    /* ── Handlers ── */
    const handleAddCategory = async (e) => {
        e.preventDefault();
        const name = newCategory.trim();
        if (!name) return;
        if (categories.find(c => c.name?.toLowerCase() === name.toLowerCase())) {
            alert('Category already exists'); return;
        }
        try {
            await createCategory(name);
            setNewCategory('');
            fetchData();
        } catch (err) { console.error('Error creating category', err); }
    };

    const handleSubmitExpense = async (e) => {
        e.preventDefault();
        let finalCategoryId = expenseForm.category_id;

        if (finalCategoryId === 'NEW_CATEGORY') {
            const name = inlineCategoryName.trim();
            if (!name) { alert('Please enter a name for the new category.'); return; }
            const existing = categories.find(c => c.name?.toLowerCase() === name.toLowerCase());
            if (existing) {
                finalCategoryId = existing.id.toString();
            } else {
                try {
                    const res = await createCategory(name);
                    finalCategoryId = res.data.data.id.toString();
                } catch (err) { console.error('Failed to create inline category', err); return; }
            }
        }

        if (!expenseForm.amount || !finalCategoryId) return;

        try {
            setSubmittingExpense(true);
            setExpenseMessage(editingExpenseId ? 'Updating expense…' : 'Processing expense…');
            setExpenseError('');

            const payload = {
                amount: parseFloat(expenseForm.amount),
                description: expenseForm.description,
                category_id: parseInt(finalCategoryId),
                date: `${expenseForm.date}T12:00:00Z`,
            };

            if (payload.amount > 100000000) {
                setExpenseError('Amount must not exceed 100,000,000 (10 crore)');
                setSubmittingExpense(false);
                return;
            }

            if (editingExpenseId) {
                await updateExpense(editingExpenseId, payload);
                setExpenseMessage('Expense updated successfully.');
            } else {
                const res = await createExpense(payload);
                const created = res?.data?.data;
                if (created) {
                    setExpenses(prev => {
                        const combined = [created, ...prev];
                        return combined
                            .filter((exp, i, arr) => arr.findIndex(x => x.id === exp.id) === i)
                            .sort((a, b) => new Date(b.date) - new Date(a.date));
                    });
                }
                setExpenseMessage('Expense added successfully.');
            }

            setExpenseForm({ amount: '', description: '', category_id: '', date: todayString });
            setInlineCategoryName('');
            setEditingExpenseId(null);
            setShowAddModal(false);
            await fetchData();
        } catch (err) {
            console.error('Error saving expense', err);
            setExpenseError('Failed to save expense. Please try again.');
        } finally {
            setSubmittingExpense(false);
        }
    };

    function handleEditClick(expense) {
        setEditingExpenseId(expense.id);
        setExpenseForm({
            amount: expense.amount,
            description: expense.description || '',
            category_id: expense.category_id.toString(),
            date: new Date(expense.date).toISOString().split('T')[0],
        });
        setShowAddModal(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const cancelEdit = () => {
        setEditingExpenseId(null);
        setExpenseForm({ amount: '', description: '', category_id: '', date: todayString });
        setInlineCategoryName('');
        setShowAddModal(false);
    };

    const handleDeleteExpense = async (id) => {
        if (!id) { alert('Error: Expense ID is missing!'); return; }
        if (!window.confirm('Delete this expense?')) return;
        try {
            await deleteExpense(id);
            await fetchData();
        } catch (err) {
            console.error('Error deleting expense', err);
            alert('Failed to delete expense. Please try again.');
        }
    };

    const handleEditCategoryClick = (cat) => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name || ''); };
    const handleCancelCategoryEdit = () => { setEditingCategoryId(null); setEditingCategoryName(''); };

    const handleSaveCategoryEdit = async () => {
        const name = editingCategoryName.trim();
        if (!name) return;
        try {
            await updateCategory(editingCategoryId, name);
            setEditingCategoryId(null); setEditingCategoryName('');
            fetchData();
        } catch (err) {
            console.error('Failed to update category', err);
            alert(err.response?.data?.error || 'Failed to update category');
        }
    };

    const handleDeleteCategoryClick = async (id) => {
        if (!window.confirm('Delete this category? Expenses will not be deleted.')) return;
        try {
            await deleteCategory(id);
            fetchData();
        } catch (err) {
            console.error('Failed to delete category', err);
            alert(err.response?.data?.error || 'Failed to delete category');
        }
    };

    const handleInlineBudgetSubmit = async (e) => {
        e.preventDefault();
        if (!inlineBudgetAmount) return;
        try {
            await setBudget(parseFloat(inlineBudgetAmount));
            setIsEditingBudget(false);
            fetchData();
        } catch (err) { console.error('Error setting budget', err); }
    };

    /* ── Pie data ── */
    const getPieData = () => {
        const thisMonth = new Date().getMonth();
        const data = categories.map(cat => {
            const total = expenses
                .filter(e => e.category_id === cat.id && new Date(e.date).getMonth() === thisMonth)
                .reduce((sum, e) => sum + safeNumber(e.amount), 0);
            return { name: cat.name, value: total };
        }).filter(d => d.value > 0);

        const budgetLeft = safeNumber(summary.monthly_budget_left);
        if (budgetLeft > 0) data.push({ name: 'Remaining', value: budgetLeft, isRemaining: true });
        return data;
    };

    const totalBudget = safeNumber(summary.total_spend_this_month) + safeNumber(summary.monthly_budget_left);
    
    const budgetChartData = getPieData();
    const hasBudgetData = budgetChartData.length > 0;

    const todaysTransactions = expenses.filter(
        exp => new Date(exp.date).toISOString().split('T')[0] === todayString
    );

    const spentPct = totalBudget > 0
        ? Math.min(100, (safeNumber(summary.total_spend_this_month) / totalBudget) * 100)
        : 0;

    if (loading) return (
        <div className="dash-loading">
            <div className="dash-loading__spinner" />
            <span>Loading dashboard…</span>
        </div>
    );

    return (
        <>
            {/* ── Scoped styles ── */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

                .dash-root {
                    --c-bg: #f8fafc;
                    --c-surface: #ffffff;
                    --c-surface2: #f1f5f9;
                    --c-border: #e2e8f0;
                    --c-text: #0f172a;
                    --c-muted: #64748b;
                    --c-accent: #6366f1;
                    --c-accent-glow: rgba(99,102,241,0.25);
                    --c-green: #10b981;
                    --c-red: #ef4444;
                    --c-amber: #f59e0b;
                    --radius: 16px;
                    --radius-sm: 10px;
                    font-family: 'Sora', sans-serif;
                    background: var(--c-bg);
                    color: var(--c-text);
                    min-height: 100vh;
                    padding: 28px 24px 60px;
                    max-width: 1280px;
                    margin: 0 auto;
                    box-sizing: border-box;
                }

                /* ── Loading ── */
                .dash-loading {
                    display: flex; align-items: center; justify-content: center;
                    gap: 12px; height: 100vh; color: #64748b; font-family: 'Sora', sans-serif;
                }
                .dash-loading__spinner {
                    width: 20px; height: 20px; border: 2px solid #e2e8f0;
                    border-top-color: #6366f1; border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* ── Topbar ── */
                .dash-topbar {
                    display: flex; align-items: center; justify-content: space-between;
                    margin-bottom: 32px; gap: 16px; flex-wrap: wrap;
                }
                .dash-topbar__left { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
                .dash-topbar__label { font-size: 12px; font-weight: 500; color: var(--c-muted); letter-spacing: .08em; text-transform: uppercase; }
                .dash-topbar__budget { 
                    font-size: 36px; font-weight: 700; color: var(--c-text); letter-spacing: -1px; 
                    line-height: 1; font-family: 'JetBrains Mono', monospace; 
                    /* Overflow protection */
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
                }
                .dash-topbar__right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

                /* ── Budget edit form ── */
                .budget-edit-form { display: flex; align-items: center; gap: 8px; }
                .budget-edit-form input {
                    background: var(--c-surface2); border: 1px solid var(--c-border);
                    border-radius: var(--radius-sm); color: var(--c-text);
                    padding: 8px 12px; font-size: 16px; font-family: 'JetBrains Mono', monospace;
                    width: 160px; outline: none;
                    transition: border-color .15s;
                }
                .budget-edit-form input:focus { border-color: var(--c-accent); }

                /* ── Buttons ── */
                .btn-primary {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: var(--c-accent); color: #fff; border: none;
                    border-radius: var(--radius-sm); padding: 10px 20px; font-size: 14px;
                    font-weight: 600; font-family: 'Sora', sans-serif; cursor: pointer;
                    transition: opacity .15s, transform .1s;
                    box-shadow: 0 0 0 0 var(--c-accent-glow);
                }
                .btn-primary:hover { opacity: .9; box-shadow: 0 0 0 6px var(--c-accent-glow); }
                .btn-primary:active { transform: scale(.97); }
                .btn-secondary {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: var(--c-surface2); color: var(--c-text);
                    border: 1px solid var(--c-border); border-radius: var(--radius-sm);
                    padding: 10px 16px; font-size: 14px; font-weight: 500;
                    font-family: 'Sora', sans-serif; cursor: pointer;
                    transition: background .15s;
                }
                .btn-secondary:hover { background: #e2e8f0; }
                .btn-icon {
                    display: inline-flex; align-items: center; justify-content: center;
                    width: 34px; height: 34px; border-radius: 8px; border: none;
                    cursor: pointer; transition: background .15s;
                    background: transparent; color: var(--c-muted);
                }
                .btn-icon:hover { background: var(--c-border); color: var(--c-text); }
                .btn-icon--danger:hover { background: rgba(239,68,68,.12); color: var(--c-red); }

                /* ── Add expense CTA bar ── */
                .cta-bar {
                    display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
                }

                /* ── Add / edit modal card ── */
                .expense-modal {
                    background: var(--c-surface);
                    border: 1px solid var(--c-border);
                    border-radius: var(--radius);
                    padding: 28px;
                    margin-bottom: 28px;
                    animation: slideDown .25s ease-out;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }
                .expense-modal--editing { border-color: var(--c-amber); }
                .expense-modal__title {
                    font-size: 13px; font-weight: 600; letter-spacing: .08em;
                    text-transform: uppercase; color: var(--c-muted); margin: 0 0 20px;
                }
                .expense-modal__grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 16px; align-items: end;
                }
                @keyframes slideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }

                /* ── Form controls ── */
                .form-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
                .form-field label { font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--c-muted); }
                .form-field input,
                .form-field select {
                    width: 100%; min-width: 0;
                    background: var(--c-surface2); border: 1px solid var(--c-border);
                    border-radius: var(--radius-sm); color: var(--c-text);
                    padding: 10px 12px; font-size: 14px; font-family: 'Sora', sans-serif;
                    outline: none; transition: border-color .15s; -webkit-appearance: none;
                }
                .form-field input { overflow: hidden; text-overflow: ellipsis; }
                .form-field input:focus,
                .form-field select:focus { border-color: var(--c-accent); }
                .form-field select option { background: #ffffff; }

                /* ── Main grid ── */
                .main-grid {
                    display: grid;
                    grid-template-columns: 1fr 340px;
                    gap: 20px;
                    margin-bottom: 20px;
                    align-items: start;
                }
                @media (max-width: 900px) { .main-grid { grid-template-columns: 1fr; } }

                /* ── Card shell ── */
                .card {
                    background: var(--c-surface);
                    border: 1px solid var(--c-border);
                    border-radius: var(--radius);
                    padding: 24px;
                    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
                }
                .card__title {
                    font-size: 12px; font-weight: 600; letter-spacing: .08em;
                    text-transform: uppercase; color: var(--c-muted);
                    margin: 0 0 20px; display: flex; align-items: center; gap: 8px;
                }

                /* ── Pie chart card ── */
                .pie-card {
                    background: var(--c-surface);
                    border: 1px solid var(--c-border);
                    border-radius: var(--radius);
                    padding: 24px;
                    display: flex; flex-direction: column;
                    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
                }
                .pie-card__empty {
                    flex: 1; display: flex; align-items: center; justify-content: center;
                    flex-direction: column; gap: 8px; color: var(--c-muted);
                    padding: 40px 0; text-align: center;
                }
                .pie-card__empty-icon { font-size: 36px; opacity: .3; }
                
                .pie-chart-wrap { width: 100%; height: 320px; }
                
                .pie-tooltip {
                    background: #ffffff; border: 1px solid var(--c-border);
                    border-radius: 10px; padding: 10px 14px;
                    display: flex; flex-direction: column; gap: 2px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                }
                .pie-tooltip__name { font-size: 12px; color: var(--c-muted); }
                .pie-tooltip__value { font-size: 16px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--c-text); }

                /* ── Stat cards ── */
                .stat-stack { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
                .stat-card {
                    background: var(--c-surface);
                    border: 1px solid var(--c-border);
                    border-radius: var(--radius); padding: 20px 22px;
                    position: relative; overflow: hidden;
                    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
                }
                .stat-card::before {
                    content: ''; position: absolute; top: 0; left: 0;
                    width: 3px; height: 100%; border-radius: 3px 0 0 3px;
                }
                .stat-card--green::before { background: var(--c-green); }
                .stat-card--red::before { background: var(--c-red); }
                .stat-card__header {
                    display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
                }
                .stat-card__title { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--c-muted); }
                .stat-card__icon {
                    width: 28px; height: 28px; border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    background: var(--c-surface2);
                    color: var(--c-muted);
                }
                .stat-card--green .stat-card__icon { background: rgba(16,185,129,.12); color: var(--c-green); }
                .stat-card--red .stat-card__icon { background: rgba(239,68,68,.12); color: var(--c-red); }
                .stat-card__value {
                    font-size: 28px; font-weight: 700; letter-spacing: -1px;
                    font-family: 'JetBrains Mono', monospace; color: var(--c-text);
                    /* Overflow protection */
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }

                /* ── Budget progress ── */
                .budget-bar-wrap { margin-top: 8px; }
                .budget-bar-labels { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; color: var(--c-muted); }
                .budget-bar-track { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
                .budget-bar-fill { height: 100%; border-radius: 99px; transition: width .6s ease; }

                /* ── Bottom grid ── */
                .bottom-grid {
                    display: grid;
                    grid-template-columns: 1fr 340px;
                    gap: 20px;
                    align-items: start;
                }
                @media (max-width: 900px) { .bottom-grid { grid-template-columns: 1fr; } }

                /* ── Today's transactions ── */
                .txn-list { display: flex; flex-direction: column; }
                .txn-row {
                    display: flex; align-items: center; gap: 14px;
                    padding: 14px 0;
                    border-bottom: 1px solid var(--c-border);
                    transition: background .1s;
                }
                .txn-row:last-child { border-bottom: none; }
                .txn-dot {
                    width: 8px; height: 8px; min-width: 8px; border-radius: 50%;
                    background: var(--c-accent); opacity: .7;
                }
                .txn-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
                .txn-desc { font-size: 14px; font-weight: 500; color: var(--c-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .txn-meta { display: flex; align-items: center; gap: 8px; }
                .txn-cat {
                    font-size: 11px; font-weight: 600; background: rgba(99,102,241,.15);
                    color: #818cf8; border-radius: 6px; padding: 2px 7px;
                }
                .txn-date { font-size: 11px; color: var(--c-muted); }
                .txn-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
                .txn-amount {
                    font-size: 14px; font-weight: 700; color: var(--c-red);
                    font-family: 'JetBrains Mono', monospace;
                    /* Overflow protection */
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; text-align: right;
                }
                .txn-actions { display: flex; gap: 4px; flex-shrink: 0; }
                .txn-empty { color: var(--c-muted); font-size: 14px; text-align: center; padding: 32px 0; }

                /* ── Category panel ── */
                .cat-list { display: flex; flex-direction: column; gap: 6px; margin-top: 16px; }
                .cat-row {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 10px 12px; background: var(--c-surface2);
                    border: 1px solid var(--c-border); border-radius: var(--radius-sm);
                    gap: 8px;
                }
                .cat-row__name { font-size: 13px; font-weight: 500; color: var(--c-text); }
                .cat-edit-row { display: flex; gap: 8px; align-items: center; flex: 1; }
                .cat-edit-row input {
                    flex: 1; background: var(--c-bg); border: 1px solid var(--c-accent);
                    border-radius: 8px; color: var(--c-text); padding: 6px 10px;
                    font-size: 13px; font-family: 'Sora', sans-serif; outline: none;
                }
            `}</style>

            <div className="dash-root">

                {/* ── Topbar ── */}
                <div className="dash-topbar">
                    <div className="dash-topbar__left">
                        <span className="dash-topbar__label">Monthly Budget</span>
                        {isEditingBudget ? (
                            <form className="budget-edit-form" onSubmit={handleInlineBudgetSubmit}>
                                <input
                                    type="number" step="0.01" autoFocus required
                                    value={inlineBudgetAmount}
                                    onChange={e => setInlineBudgetAmount(e.target.value)}
                                />
                                <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }}><Save size={15} /></button>
                                <button type="button" className="btn-secondary" style={{ padding: '8px 12px' }} onClick={() => setIsEditingBudget(false)}><X size={15} /></button>
                            </form>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {/* Using compact formatting for the massive top budget number */}
                                <span className="dash-topbar__budget" title={formatCurrency(totalBudget)}>
                                    {formatCompactCurrency(totalBudget)}
                                </span>
                                <button className="btn-icon" onClick={() => { setIsEditingBudget(true); setInlineBudgetAmount(totalBudget.toString()); }} title="Edit budget">
                                    <Pencil size={14} />
                                </button>
                            </div>
                        )}
                        {/* Budget progress bar */}
                        {totalBudget > 0 && (
                            <div className="budget-bar-wrap" style={{ marginTop: '10px', minWidth: '260px' }}>
                                <div className="budget-bar-labels">
                                    {/* Using compact formatting here too */}
                                    <span title={formatCurrency(summary.total_spend_this_month)}>Spent: {formatCompactCurrency(summary.total_spend_this_month)}</span>
                                    <span>{spentPct.toFixed(0)}%</span>
                                </div>
                                <div className="budget-bar-track">
                                    <div className="budget-bar-fill" style={{
                                        width: `${spentPct}%`,
                                        background: spentPct > 85 ? 'var(--c-red)' : spentPct > 60 ? 'var(--c-amber)' : 'var(--c-green)'
                                    }} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="dash-topbar__right">
                        <button
                            className="btn-primary"
                            onClick={() => { if (editingExpenseId) cancelEdit(); else setShowAddModal(v => !v); }}
                        >
                            {editingExpenseId
                                ? <><X size={16} /> Cancel Edit</>
                                : showAddModal
                                    ? <><X size={16} /> Close</>
                                    : <><PlusCircle size={16} /> Add Expense</>}
                        </button>
                    </div>
                </div>

                {/* ── Add/Edit modal ── */}
                {showAddModal && (
                    <div className={`expense-modal ${editingExpenseId ? 'expense-modal--editing' : ''}`}>
                        <p className="expense-modal__title">
                            {editingExpenseId ? '✏️ Edit Transaction' : '➕ New Transaction'}
                        </p>
                        <form onSubmit={handleSubmitExpense}>
                            <div className="expense-modal__grid">
                                <div className="form-field">
                                    <label>Amount (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        required
                                        max={100000000}
                                        value={expenseForm.amount}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setExpenseForm({ ...expenseForm, amount: v });
                                            if (parseFloat(v) > 100000000) {
                                                setExpenseError('Amount must not exceed 100,000,000 (10 crore)');
                                            } else {
                                                setExpenseError('');
                                            }
                                        }}
                                    />
                                </div>
                                <div className="form-field">
                                    <label>Date</label>
                                    <input type="date" required value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                                </div>
                                <div className="form-field">
                                    <label>Category</label>
                                    <select required value={expenseForm.category_id} onChange={e => setExpenseForm({ ...expenseForm, category_id: e.target.value })}>
                                        <option value="" disabled>Select…</option>
                                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        <option value="NEW_CATEGORY">+ Create New</option>
                                    </select>
                                </div>
                                {expenseForm.category_id === 'NEW_CATEGORY' && (
                                    <div className="form-field" style={{ animation: 'slideDown .2s ease-out' }}>
                                        <label>New Category Name</label>
                                        <input type="text" placeholder="e.g., Subscriptions" autoFocus required value={inlineCategoryName} onChange={e => setInlineCategoryName(e.target.value)} />
                                    </div>
                                )}
                                <div className="form-field">
                                    <label>Description</label>
                                    <input type="text" placeholder="e.g., Lunch at Meghana" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                                </div>
                                <button type="submit" disabled={submittingExpense} className="btn-primary" style={{ alignSelf: 'flex-end', opacity: submittingExpense ? .6 : 1 }}>
                                    {submittingExpense
                                        ? <><Clock3 size={15} /> Processing…</>
                                        : editingExpenseId ? <><Save size={15} /> Update</> : <><PlusCircle size={15} /> Save</>}
                                </button>
                            </div>
                            {expenseMessage && <p style={{ color: '#94a3b8', fontSize: '13px', margin: '14px 0 0' }}>{expenseMessage}</p>}
                            {expenseError && <p style={{ color: 'var(--c-red)', fontSize: '13px', margin: '14px 0 0' }}>{expenseError}</p>}
                        </form>
                    </div>
                )}

                {/* ── Main grid: Pie + Stats ── */}
                <div className="main-grid">
                    {/* Pie Chart */}
                    <div className="pie-card">
                        <p className="card__title"><PieIcon size={14} /> Budget Utilization</p>
                        {hasBudgetData ? (
                            <div className="pie-chart-wrap">
                                <ResponsiveContainer width="100%" height={320} minWidth={0}>
                                    <PieChart>
                                        <Pie
                                            data={budgetChartData}
                                            innerRadius={75}
                                            outerRadius={115}
                                            paddingAngle={4}
                                            dataKey="value"
                                            strokeWidth={0}
                                        >
                                            {budgetChartData.map((entry, i) => (
                                                <Cell
                                                    key={`cell-${i}`}
                                                    fill={entry.isRemaining ? REMAINING_COLOR : COLORS[i % COLORS.length]}
                                                    stroke="none"
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        
                                        <Legend
                                            verticalAlign="bottom"
                                            height={36}
                                            iconType="circle"
                                            iconSize={8}
                                            wrapperStyle={{ paddingTop: '20px' }}
                                            formatter={value => <span style={{ color: '#64748b', fontSize: '12px' }}>{value}</span>}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="pie-card__empty">
                                <div className="pie-card__empty-icon">📊</div>
                                <p style={{ margin: 0, fontWeight: 600 }}>No data yet</p>
                                <p style={{ margin: 0, fontSize: 13 }}>Add an expense or set a budget to get started.</p>
                            </div>
                        )}
                    </div>

                    {/* Stat stack with Compact Currency Formatter applied */}
                    <div className="stat-stack">
                        <StatCard title="Available to Spend" value={formatCompactCurrency(summary.monthly_budget_left)} icon={Target} accent="green" />
                        <StatCard title="Total Spent" value={formatCompactCurrency(summary.total_spend_this_month)} icon={TrendingDown} accent="red" />
                        <StatCard title="Spent Today" value={formatCompactCurrency(summary.total_spend_today)} icon={Wallet} accent="green" />
                    </div>
                </div>

                {/* ── Bottom grid: Transactions + Categories ── */}
                <div className="bottom-grid">
                    {/* Today's Transactions */}
                    <div className="card">
                        <p className="card__title"><ReceiptText size={14} /> Today's Transactions</p>
                        {todaysTransactions.length === 0
                            ? <div className="txn-empty">No expenses logged today. Enjoy your savings! 🎉</div>
                            : (
                                <div className="txn-list">
                                    {todaysTransactions.map(exp => (
                                        <TransactionRow
                                            key={exp.id || exp.ID}
                                            expense={exp}
                                            onEdit={handleEditClick}
                                            onDelete={handleDeleteExpense}
                                        />
                                    ))}
                                </div>
                            )
                        }
                    </div>

                    {/* Categories panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* New category form */}
                        <div className="card">
                            <p className="card__title"><Tags size={14} /> Manage Categories</p>
                            <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div className="form-field" style={{ flex: 1, minWidth: '0' }}>
                                    <input
                                        type="text" placeholder="e.g., Groceries, Rent…" required
                                        value={newCategory} onChange={e => setNewCategory(e.target.value)}
                                    />
                                </div>
                                <button type="submit" className="btn-secondary" style={{ alignSelf: 'stretch', whiteSpace: 'nowrap', padding: '0 14px', minWidth: '95px' }}>
                                    <PlusCircle size={15} /> Add
                                </button>
                            </form>

                            <div className="cat-list">
                                {categories.map(cat => (
                                    <div key={cat.id} className="cat-row">
                                        {editingCategoryId === cat.id ? (
                                            <div className="cat-edit-row">
                                                <input
                                                    value={editingCategoryName}
                                                    onChange={e => setEditingCategoryName(e.target.value)}
                                                    autoFocus
                                                />
                                                <button className="btn-icon" onClick={handleSaveCategoryEdit} title="Save"><Save size={14} /></button>
                                                <button className="btn-icon" onClick={handleCancelCategoryEdit} title="Cancel"><X size={14} /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="cat-row__name">{cat.name}</span>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button className="btn-icon" onClick={() => handleEditCategoryClick(cat)} title="Edit"><Pencil size={14} /></button>
                                                    <button className="btn-icon btn-icon--danger" onClick={() => handleDeleteCategoryClick(cat.id)} title="Delete"><Trash2 size={14} /></button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {categories.length === 0 && (
                                    <p style={{ color: 'var(--c-muted)', fontSize: '13px', textAlign: 'center', margin: '8px 0 0' }}>No categories yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
}
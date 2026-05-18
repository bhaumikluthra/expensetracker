import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    getDashboardSummary, getCategories, createCategory,
    createExpense, setBudget, getExpenses, updateExpense, deleteExpense,
    updateCategory, deleteCategory
} from '../api/client';
import { Target, TrendingDown, Clock3, Zap, PlusCircle, Tags, ReceiptText, Pencil, Trash2, Save, PieChart as PieIcon, X } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
    const [summary, setSummary] = useState({
        total_spend_this_month: 0,
        total_spend_today: 0,
        monthly_budget_left: 0,
        todays_budget: 0,
    });

    const [categories, setCategories] = useState([]);
    const [expenses, setExpenses] = useState([]);

    const [newCategory, setNewCategory] = useState("");
    const [inlineCategoryName, setInlineCategoryName] = useState("");

    const todayString = new Date().toISOString().split('T')[0];

    const [expenseForm, setExpenseForm] = useState({
        amount: "",
        description: "",
        category_id: "",
        date: todayString
    });

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingExpenseId, setEditingExpenseId] = useState(null);

    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [inlineBudgetAmount, setInlineBudgetAmount] = useState("");
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState("");

    const [loading, setLoading] = useState(true);

    const COLORS = ['#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#6366f1', '#f43f5e'];

    const location = useLocation();

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (location.state && location.state.editExpense) {
            handleEditClick(location.state.editExpense);
            window.history.replaceState({}, document.title)
        }
    }, [location]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [summaryRes, categoriesRes, expensesRes] = await Promise.all([
                getDashboardSummary(),
                getCategories(),
                getExpenses()
            ]);
            setSummary(summaryRes.data.data);
            setCategories(categoriesRes.data.data || []);
            setExpenses((expensesRes.data.data || []).sort((a, b) => new Date(b.date) - new Date(a.date)));
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        const name = (newCategory || "").trim();
        if (!name) return;
        const exists = categories.find(c => (c.name || '').toLowerCase() === name.toLowerCase());
        if (exists) {
            alert('Category already exists');
            return;
        }
        try {
            await createCategory(name);
            setNewCategory("");
            fetchData();
        } catch (error) {
            console.error("Error creating category", error);
        }
    };

    const handleSubmitExpense = async (e) => {
        e.preventDefault();

        let finalCategoryId = expenseForm.category_id;

        if (finalCategoryId === "NEW_CATEGORY") {
            const name = (inlineCategoryName || "").trim();
            if (!name) {
                alert("Please enter a name for the new category.");
                return;
            }
            // reuse existing category if present (case-insensitive)
            const existing = categories.find(c => (c.name || '').toLowerCase() === name.toLowerCase());
            if (existing) {
                finalCategoryId = existing.id.toString();
            } else {
                try {
                    const newCatRes = await createCategory(name);
                    finalCategoryId = newCatRes.data.data.id.toString();
                } catch (err) {
                    console.error("Failed to create inline category", err);
                    return;
                }
            }
        }

        if (!expenseForm.amount || !finalCategoryId) return;

        try {
            const formattedDate = `${expenseForm.date}T12:00:00Z`;

            const payload = {
                amount: parseFloat(expenseForm.amount),
                description: expenseForm.description,
                category_id: parseInt(finalCategoryId),
                date: formattedDate
            };

            if (editingExpenseId) {
                await updateExpense(editingExpenseId, payload);
            } else {
                await createExpense(payload);
            }

            setExpenseForm({ amount: "", description: "", category_id: "", date: todayString });
            setInlineCategoryName("");
            setEditingExpenseId(null);
            setShowAddModal(false);
            fetchData();
        } catch (error) {
            console.error("Error saving expense", error);
        }
    };

    const handleEditClick = (expense) => {
        setEditingExpenseId(expense.id);
        setExpenseForm({
            amount: expense.amount,
            description: expense.description || "",
            category_id: expense.category_id.toString(),
            date: new Date(expense.date).toISOString().split('T')[0]
        });
        setShowAddModal(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingExpenseId(null);
        setExpenseForm({ amount: "", description: "", category_id: "", date: todayString });
        setInlineCategoryName("");
        setShowAddModal(false);
    };

    const handleDeleteExpense = async (id) => {
        console.log("Deleting expense with id:", id, typeof id);
        if (!id) {
            alert("Error: Expense ID is missing!");
            return;
        }
        // if (!window.confirm("Are you sure you want to delete this expense?")) return;
        try {
            console.log("Calling deleteExpense API");
            await deleteExpense(id);
            console.log("Delete API called, fetching data");
            fetchData();
            alert("Expense deleted successfully!");
        } catch (error) {
            console.error("Error deleting expense", error);
            alert("Failed to delete expense. Check console for details.");
        }
    };

    const handleEditCategoryClick = (cat) => {
        setEditingCategoryId(cat.id);
        setEditingCategoryName(cat.name || "");
    };

    const handleCancelCategoryEdit = () => {
        setEditingCategoryId(null);
        setEditingCategoryName("");
    };

    const handleSaveCategoryEdit = async () => {
        const name = (editingCategoryName || "").trim();
        if (!name) return;
        try {
            await updateCategory(editingCategoryId, name);
            setEditingCategoryId(null);
            setEditingCategoryName("");
            fetchData();
        } catch (err) {
            console.error("Failed to update category", err);
            alert(err.response?.data?.error || 'Failed to update category');
        }
    };

    const handleDeleteCategoryClick = async (id) => {
        if (!window.confirm('Delete this category? This will not delete expenses.')) return;
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
        } catch (error) {
            console.error("Error setting budget", error);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    };

    const getPieData = () => {
        const data = categories.map(cat => {
            const total = expenses
                .filter(e => e.category_id === cat.id && new Date(e.date).getMonth() === new Date().getMonth())
                .reduce((sum, e) => sum + e.amount, 0);
            return { name: cat.name, value: total };
        }).filter(d => d.value > 0);

        if (summary.monthly_budget_left > 0) {
            data.push({ name: 'Remaining', value: summary.monthly_budget_left, isRemaining: true });
        }
        return data;
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading dashboard...</div>;

    const totalBudget = summary.total_spend_this_month + summary.monthly_budget_left;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '20px 30px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                <button
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '12px 25px' }}
                    onClick={() => {
                        if (editingExpenseId) cancelEdit();
                        else setShowAddModal(!showAddModal);
                    }}
                >
                    {editingExpenseId ? <><Zap size={20} style={{marginRight:'8px'}}/> Cancel Edit</> :
                        showAddModal ? <><Zap size={20} style={{marginRight:'8px'}}/> Close Form</> :
                            <><PlusCircle size={20} style={{marginRight:'8px'}}/> Add Expense</>}
                </button>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', margin: 0 }}>Total Monthly Budget</p>

                        {!isEditingBudget && (
                            <button
                                onClick={() => {
                                    setIsEditingBudget(true);
                                    setInlineBudgetAmount(totalBudget.toString());
                                }}
                                className="icon-btn icon-btn-edit"
                                style={{ padding: '4px' }}
                                title="Edit Budget"
                            >
                                <Pencil size={14} />
                            </button>
                        )}
                    </div>

                    {isEditingBudget ? (
                        <form onSubmit={handleInlineBudgetSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="number"
                                step="0.01"
                                value={inlineBudgetAmount}
                                onChange={e => setInlineBudgetAmount(e.target.value)}
                                style={{ width: '130px', padding: '8px 12px', fontSize: '16px', margin: 0 }}
                                autoFocus
                                required
                            />
                            <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px', width: 'auto', height: 'auto' }}>
                                <Save size={16} />
                            </button>
                            <button type="button" onClick={() => setIsEditingBudget(false)} className="btn btn-secondary" style={{ padding: '8px 12px', width: 'auto', height: 'auto' }}>
                                <X size={16} />
                            </button>
                        </form>
                    ) : (
                        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
                            {formatCurrency(totalBudget)}
                        </h2>
                    )}
                </div>
            </div>

            {showAddModal && (
                <div className={`action-card ${editingExpenseId ? 'theme-amber' : 'theme-sky'}`} style={{ animation: 'slideDown 0.3s ease-out', border: editingExpenseId ? '2px solid #0f172a' : '1px solid #e0f2fe' }}>
                    <h2 className="section-title">{editingExpenseId ? "Edit Transaction" : "Log New Transaction"}</h2>
                    <form onSubmit={handleSubmitExpense} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'end' }}>
                        <div className="form-group" style={{marginBottom: 0}}>
                            <label>Amount (₹)</label>
                            <input type="number" step="0.01" placeholder="0.00" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} required />
                        </div>
                        <div className="form-group" style={{marginBottom: 0}}>
                            <label>Date</label>
                            <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})} required />
                        </div>

                        <div className="form-group" style={{marginBottom: 0}}>
                            <label>Category</label>
                            <select value={expenseForm.category_id} onChange={(e) => setExpenseForm({...expenseForm, category_id: e.target.value})} required>
                                <option value="" disabled>Select...</option>
                                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                <option value="NEW_CATEGORY" style={{ fontWeight: 'bold', color: '#0ea5e9' }}>+ Create New Category</option>
                            </select>
                        </div>

                        {expenseForm.category_id === "NEW_CATEGORY" && (
                            <div className="form-group" style={{marginBottom: 0, animation: 'slideDown 0.2s ease-out'}}>
                                <label style={{ color: '#0284c7' }}>New Category Name</label>
                                <input type="text" placeholder="e.g., Subscriptions" value={inlineCategoryName} onChange={(e) => setInlineCategoryName(e.target.value)} required autoFocus />
                            </div>
                        )}

                        <div className="form-group" style={{marginBottom: 0}}>
                            <label>Description</label>
                            <input type="text" placeholder="e.g., Lunch" value={expenseForm.description} onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
                            {editingExpenseId ? <><Save size={18} /> Update</> : <><PlusCircle size={18} /> Save</>}
                        </button>
                    </form>
                </div>
            )}

            <div className="dashboard-grid" style={{ gridTemplateColumns: '1.5fr 1fr' }}>

                <div className="action-card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
                    <h2 className="section-title"><PieIcon size={18} style={{marginRight: '8px', display: 'inline'}}/> Budget Utilization</h2>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={getPieData()}
                                innerRadius={70}
                                outerRadius={110}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {getPieData().map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.isRemaining ? '#94a3b8' : COLORS[index % COLORS.length]}
                                        stroke="none"
                                    />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="action-stack">
                    <div className="card theme-emerald" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div className="card-header" style={{marginBottom: '12px'}}>
                            <h3 className="card-title">Available to Spend</h3>
                            <div className="icon-wrapper"><Target size={18} strokeWidth={2.5} /></div>
                        </div>
                        <h2 className="card-value" style={{fontSize: '40px'}}>{formatCurrency(summary.monthly_budget_left)}</h2>
                    </div>

                    <div className="card theme-red" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div className="card-header" style={{marginBottom: '12px'}}>
                            <h3 className="card-title">Total Spent</h3>
                            <div className="icon-wrapper"><TrendingDown size={18} strokeWidth={2.5}/></div>
                        </div>
                        <h2 className="card-value" style={{fontSize: '40px'}}>{formatCurrency(summary.total_spend_this_month)}</h2>
                    </div>
                </div>
            </div>

            <div className="actions-container">

                <div className="action-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 className="section-title" style={{ margin: 0 }}>Today's Transactions</h2>
                        <ReceiptText size={20} color="#64748b" />
                    </div>

                    {(() => {
                        const todaysTransactions = expenses.filter(exp => new Date(exp.date).toISOString().split('T')[0] === todayString);

                        if (todaysTransactions.length === 0) {
                            return <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>No expenses logged today.</p>;
                        }

                        return (
                            <div className="transaction-list" style={{ maxHeight: '350px' }}>
                                {todaysTransactions.map((expense) => {
                                    const expenseId = expense.id || expense.ID;
                                    const displayDate = new Date(expense.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                                    return (
                                        <div key={expenseId} className="transaction-item">
                                            <div className="transaction-info">
                                                <span className="transaction-desc">
                                                    {expense.description || "Unnamed Expense"}
                                                    <span style={{color: '#94a3b8', fontSize: '12px', marginLeft: '8px', fontWeight: 'normal'}}>• {displayDate}</span>
                                                </span>
                                                <span className="transaction-cat">{expense.category?.name || "Unknown"}</span>
                                            </div>

                                            <div className="transaction-actions">
                                                <span className="transaction-amount" style={{marginRight: '8px'}}>-{formatCurrency(expense.amount)}</span>

                                                <button
    onClick={() =>
        handleEditClick({
            ...expense,
            id: expenseId
        })
    }
    className="icon-btn icon-btn-edit"
    title="Edit"
>
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteExpense(expenseId)} className="icon-btn icon-btn-delete" title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        );
                    })()}
                </div>

                <div className="action-stack">
                    <div className="action-card">
                        <h2 className="section-title">New Category</h2>
                        <form onSubmit={handleAddCategory}>
                            <div className="form-group">
                                <label>Category Name</label>
                                <input type="text" placeholder="e.g., Groceries, Rent..." value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required />
                            </div>
                            <button type="submit" className="btn btn-secondary">
                                <Tags size={18} /> Create Category
                            </button>
                        </form>
                        <div style={{ marginTop: '12px' }}>
                            <h4 style={{ margin: '10px 0 8px' }}>Your Categories</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {categories.map(cat => (
                                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        {editingCategoryId === cat.id ? (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
                                                <input value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} style={{ flex: 1 }} />
                                                <button onClick={handleSaveCategoryEdit} className="btn btn-primary">Save</button>
                                                <button onClick={handleCancelCategoryEdit} className="btn btn-secondary">Cancel</button>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 600 }}>{cat.name}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => handleEditCategoryClick(cat)} className="icon-btn icon-btn-edit" title="Edit">
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button onClick={() => handleDeleteCategoryClick(cat.id)} className="icon-btn icon-btn-delete" title="Delete">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
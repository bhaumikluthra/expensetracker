import { useState, useEffect } from 'react';
import { getExpenses, deleteExpense, deleteAllExpenses, updateExpense, getCategories } from '../api/client';
import { History as HistoryIcon, Trash2, Pencil, Search, AlertOctagon, Save, X } from 'lucide-react';
import { formatCurrency, safeNumber } from '../utils/number';

export default function History() {
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingExpenseId, setEditingExpenseId] = useState(null);
    const [editForm, setEditForm] = useState({
        amount: '',
        description: '',
        category_id: '',
        date: new Date().toISOString().split('T')[0]
    });

    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    async function fetchHistory() {
        setLoading(true);
        try {
            const [expensesRes, categoriesRes] = await Promise.all([getExpenses(), getCategories()]);
            const sortedData = (expensesRes.data.data || []).sort((a, b) => new Date(b.date) - new Date(a.date));
            setExpenses(sortedData);
            setCategories(categoriesRes.data.data || []);
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    }

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        fetchHistory();
    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleDelete = async (id) => {
        console.log("Deleting expense with id:", id);
        if (!id) {
            alert("Error: Transaction ID is missing!");
            return;
        }

        try {
            console.log("Calling deleteExpense API");
            await deleteExpense(id);
            console.log("Delete API called, fetching history");
            await fetchHistory(); // Instantly refresh the list
            alert("Expense deleted successfully!");
        } catch (error) {
            console.error("Failed to delete", error);
            alert("Failed to delete. Is your Go server running?");
        }
    };

    const handleClearAll = async () => {
        const isConfirmed = window.confirm(
            "DANGER: Are you absolutely sure you want to delete ALL transaction history? This cannot be undone."
        );

        if (!isConfirmed) return;

        try {
            await deleteAllExpenses();
            await fetchHistory();
        } catch (error) {
            console.error("Failed to clear history", error);
            alert("Failed to clear history.");
        }
    };

    const startEditing = (expense) => {
        const expenseId = expense.id || expense.ID;
        setEditingExpenseId(expenseId);
        setEditForm({
            amount: expense.amount?.toString() || '',
            description: expense.description || '',
            category_id: (expense.category_id || expense.category?.id || '')?.toString(),
            date: new Date(expense.date).toISOString().split('T')[0]
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingExpenseId(null);
        setEditForm({
            amount: '',
            description: '',
            category_id: '',
            date: new Date().toISOString().split('T')[0]
        });
    };

    const handleUpdateExpense = async (e) => {
        e.preventDefault();
        if (!editingExpenseId) return;

        try {
            if (parseFloat(editForm.amount) > 100000000) {
                alert('Amount must not exceed 100,000,000 (10 crore)');
                return;
            }
            await updateExpense(editingExpenseId, {
                amount: parseFloat(editForm.amount),
                description: editForm.description,
                category_id: parseInt(editForm.category_id),
                date: `${editForm.date}T12:00:00Z`
            });

            await fetchHistory();
            cancelEdit();
            alert("Expense updated successfully!");
        } catch (error) {
            console.error("Failed to update expense", error);
            alert("Failed to update expense. Check console for details.");
        }
    };

    const filteredExpenses = expenses.filter(exp => {
        const expDate = new Date(exp.date).toISOString().split('T')[0];
        return expDate >= dateRange.start && expDate <= dateRange.end;
    });

    if (loading) return <div style={{ padding: '20px' }}>Loading history...</div>;

    return (
        <div className="action-card" style={{ minHeight: '600px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="icon-wrapper" style={{ backgroundColor: '#f3e8ff', color: '#9333ea' }}>
                            <HistoryIcon size={24} />
                        </div>
                        <h2 className="section-title" style={{ margin: 0, fontSize: '24px' }}>Transaction History</h2>
                    </div>
                </div>

                {expenses.length > 0 && (
                    <button
                        onClick={handleClearAll}
                        className="btn"
                        style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', width: 'auto', padding: '8px 16px', fontSize: '13px' }}
                    >
                        <AlertOctagon size={16} /> Clear All History
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', background: '#f8fafc', padding: '16px 18px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>History from</span>
                    <input type="date" className="nav-date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                    <span style={{ color: '#475569', fontSize: '14px' }}>to</span>
                    <input type="date" className="nav-date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                </div>
                <div style={{ color: '#475569', fontSize: '13px' }}>
                    Showing transactions from <strong>{dateRange.start}</strong> to <strong>{dateRange.end}</strong>.
                </div>
            </div>

            {editingExpenseId && (
                <div className="action-card theme-sky" style={{ marginBottom: '24px', animation: 'slideDown 0.25s ease-out', border: '1px solid #e0f2fe' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                        <div>
                            <h2 className="section-title" style={{ margin: 0 }}>Edit Transaction</h2>
                            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '13px' }}>Changes will appear immediately in the history list.</p>
                        </div>
                        <button onClick={cancelEdit} className="icon-btn icon-btn-secondary" title="Cancel edit" style={{ padding: '8px' }}>
                            <X size={18} />
                        </button>
                    </div>
                    <form onSubmit={handleUpdateExpense} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Amount (₹)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={editForm.amount}
                                max={100000000}
                                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Date</label>
                            <input
                                type="date"
                                value={editForm.date}
                                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Category</label>
                            <select
                                value={editForm.category_id}
                                onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                                required
                            >
                                <option value="" disabled>Select category</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Description</label>
                            <input
                                type="text"
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                placeholder="Optional description"
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
                            <Save size={18} /> Save Changes
                        </button>
                    </form>
                </div>
            )}

            {/* The List */}
            {filteredExpenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                    <Search size={48} style={{ opacity: 0.2, margin: '0 auto 16px auto' }} />
                    <p>No transactions found for this date range.</p>
                </div>
            ) : (
                <div className="transaction-list" style={{ maxHeight: 'none', overflowY: 'visible' }}>
                    {filteredExpenses.map((expense) => {
                        const displayDate = new Date(expense.date).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' });

                        // THE FIX: Check for both lowercase and uppercase ID!
                        const expenseId = expense.id || expense.ID;

                        return (
                            <div key={expenseId} className="transaction-item" style={{ padding: '16px 20px' }}>
                                <div className="transaction-info">
                  <span className="transaction-desc" style={{ fontSize: '16px' }}>
                    {expense.description || "Unnamed Expense"}
                  </span>
                                    <span className="transaction-cat" style={{ marginTop: '4px' }}>
                    {expense.category?.name || "Unknown"} • {displayDate}
                  </span>
                                </div>

                                <div className="transaction-actions">
                  <span className="transaction-amount" style={{ marginRight: '16px', fontSize: '18px' }}>
                    -{formatCurrency(expense.amount)}
                  </span>

                                    <button onClick={() => startEditing(expense)} className="icon-btn icon-btn-edit" title="Edit">
                                        <Pencil size={18} />
                                    </button>

                                    <button onClick={() => handleDelete(expenseId)} className="icon-btn icon-btn-delete" title="Delete">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
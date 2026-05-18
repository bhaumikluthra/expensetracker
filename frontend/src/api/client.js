import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8080/api/v1',
});

const token = localStorage.getItem('expenseTrackerToken');
if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export const setAuthToken = (token) => {
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        localStorage.setItem('expenseTrackerToken', token);
    } else {
        delete api.defaults.headers.common['Authorization'];
        localStorage.removeItem('expenseTrackerToken');
    }
};

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const register = (email, password) => api.post('/auth/register', { email, password });

// Dashboard
export const getDashboardSummary = () => api.get('/dashboard/summary');
export const setBudget = (amount) => api.post('/dashboard/budget', { amount });

// Categories
export const getCategories = () => api.get('/categories');
export const createCategory = (nameOrObj) => {
    if (typeof nameOrObj === 'string') {
        return api.post('/categories', { name: nameOrObj });
    }
    if (nameOrObj && typeof nameOrObj === 'object') {
        // if an object with `name` provided, normalize to { name }
        if (nameOrObj.name && typeof nameOrObj.name === 'string') {
            return api.post('/categories', { name: nameOrObj.name });
        }
        // otherwise send the object as-is
        return api.post('/categories', nameOrObj);
    }
    // fallback
    return api.post('/categories', { name: nameOrObj });
};
export const updateCategory = (id, name) => api.put(`/categories/${id}`, { name });
export const deleteCategory = (id) => api.delete(`/categories/${id}`);

// Expenses
export const createExpense = (expenseData) => api.post('/expenses', expenseData);
export const getExpenses = () => api.get('/expenses');
export const updateExpense = (id, expenseData) => api.put(`/expenses/${id}`, expenseData);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);
export const deleteAllExpenses = () => api.delete('/expenses');
export const logout = () => setAuthToken(null);

export default api;
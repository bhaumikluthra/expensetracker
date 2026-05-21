import axios from 'axios';

function resolveApiBaseUrl() {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL.replace(/\/$/, '');
    }
    const { protocol, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8080/api/v1';
    }
    return `${protocol}//${hostname}:8080/api/v1`;
}

const BASE_URL = resolveApiBaseUrl();
const api = axios.create({
    baseURL: BASE_URL,
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

export const login = (email, password) => api.post('/auth/login', { email, password });
export const register = (email, password) => api.post('/auth/register', { email, password });

export const getDashboardSummary = () => api.get('/dashboard/summary');
export const setBudget = (amount) => api.post('/dashboard/budget', { amount });

export const getCategories = () => api.get('/categories');
export const createCategory = (nameOrObj) => {
    if (typeof nameOrObj === 'string') {
        return api.post('/categories', { name: nameOrObj });
    }
    if (nameOrObj && typeof nameOrObj === 'object') {
        if (nameOrObj.name && typeof nameOrObj.name === 'string') {
            return api.post('/categories', { name: nameOrObj.name });
        }
        return api.post('/categories', nameOrObj);
    }
    return api.post('/categories', { name: nameOrObj });
};
export const updateCategory = (id, name) => api.put(`/categories/${id}`, { name });
export const deleteCategory = (id) => api.delete(`/categories/${id}`);

export const createExpense = (expenseData) => api.post('/expenses', expenseData);
export const getExpenses = () => api.get('/expenses');
export const updateExpense = (id, expenseData) => api.put(`/expenses/${id}`, expenseData);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);
export const deleteAllExpenses = () => api.delete('/expenses');

/** Upload CSV for AI-powered smart import (multipart field: file) */
export const importCSV = (file, defaultCategory = 'Other') => {
    const form = new FormData();
    form.append('file', file);
    form.append('default_category', defaultCategory);
    return api.post('/expenses/import-csv', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

export const logout = () => setAuthToken(null);

export default api;
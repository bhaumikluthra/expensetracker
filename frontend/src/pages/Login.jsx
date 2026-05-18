import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { login, setAuthToken } from '../api/client';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(email, password);
      const { token } = response.data;
      if (!token) {
        throw new Error('Login failed: missing token');
      }

      localStorage.setItem('expenseTrackerToken', token);
      setAuthToken(token);
      onLogin?.();
      navigate('/');
    } catch (err) {
      const message = err?.response?.data?.error || err.message || 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Sign in to BucksFlow</h2>
        <p>Enter your email and password to continue.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="auth-footer">
          <span>New here?</span>
          <NavLink to="/register" className="link-button">
            Create an account
          </NavLink>
        </div>
      </div>
    </div>
  );
}

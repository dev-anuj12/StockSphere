import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Boxes, Lock, User, ArrowRight, Shield, AlertCircle } from 'lucide-react';

export function Login() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      toast.success('Welcome back to StockSphere!');
      navigate('/dashboard');
    } catch (err) {
      let msg = err.response?.data?.message;
      if (!msg) {
        if (err.response?.status === 404) {
          msg = 'API endpoint not found (404). Backend is not accessible on this domain.';
        } else if (err.response?.status === 500) {
          msg = err.response?.data?.details || 'Database or server error (500). Please check backend logs.';
        } else if (err.message?.includes('Network Error') || !err.response) {
          msg = 'Unable to connect to StockSphere API server.';
        } else {
          msg = err.message || 'Login failed. Please verify your credentials.';
        }
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
        {/* Brand Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-300 mb-3">
            <Boxes className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Stock<span className="text-indigo-600">Sphere</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Smart Inventory & Warehouse Management</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Username or Email
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. admin or admin@stocksphere.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-200 transition duration-150 flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Logins Section */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
            Quick Fill Demo Accounts
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('admin', 'Admin@StockSphere2026!')}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 border border-slate-200/60 transition text-left"
            >
              <strong className="block text-purple-700">Admin</strong>
              Full control
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('manager', 'Manager@StockSphere2026!')}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200/60 transition text-left"
            >
              <strong className="block text-blue-700">Manager</strong>
              Stock & catalog
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('staff1', 'Staff@StockSphere2026!')}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200/60 transition text-left"
            >
              <strong className="block text-emerald-700">Staff 1</strong>
              MDC & WCH
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('staff2', 'Staff@StockSphere2026!')}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200/60 transition text-left"
            >
              <strong className="block text-emerald-700">Staff 2</strong>
              ECD Depot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

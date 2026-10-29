import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  SlidersHorizontal,
  History,
  Truck,
  BarChart3,
  Users,
  Settings,
  LogOut,
  X,
  ShieldCheck,
  Building2,
} from 'lucide-react';

export function Sidebar({ isOpen, onClose }) {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'staff'] },
    { label: 'Products', to: '/products', icon: Package, roles: ['admin', 'manager', 'staff'] },
    { label: 'Categories', to: '/categories', icon: Boxes, roles: ['admin', 'manager'] },
    { label: 'Warehouses', to: '/warehouses', icon: Warehouse, roles: ['admin', 'manager', 'staff'] },
    
    // Stock Operations Group
    { header: 'STOCK OPERATIONS' },
    { label: 'Stock In', to: '/stock-in', icon: ArrowDownToLine, roles: ['admin', 'manager', 'staff'], badgeColor: 'bg-emerald-100 text-emerald-800' },
    { label: 'Stock Out', to: '/stock-out', icon: ArrowUpFromLine, roles: ['admin', 'manager', 'staff'], badgeColor: 'bg-rose-100 text-rose-800' },
    { label: 'Stock Transfer', to: '/stock-transfer', icon: ArrowLeftRight, roles: ['admin', 'manager'] },
    { label: 'Stock Adjustment', to: '/stock-adjustment', icon: SlidersHorizontal, roles: ['admin', 'manager'] },
    { label: 'Movements Ledger', to: '/movements', icon: History, roles: ['admin', 'manager', 'staff'] },
    
    // Management & Reports
    { header: 'MANAGEMENT' },
    { label: 'Suppliers', to: '/suppliers', icon: Truck, roles: ['admin', 'manager'] },
    { label: 'Reports & Export', to: '/reports', icon: BarChart3, roles: ['admin', 'manager'] },
    { label: 'User Directory', to: '/users', icon: Users, roles: ['admin'] },
    { label: 'Settings', to: '/settings', icon: Settings, roles: ['admin', 'manager', 'staff'] },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-slate-900 text-lg tracking-tight">Stock<span className="text-indigo-600">Sphere</span></span>
              <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Enterprise WMS</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item, idx) => {
            if (item.header) {
              return (
                <div key={idx} className="pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {item.header}
                </div>
              );
            }

            // Role enforcement: Hide sidebar item if user's role is not authorized
            if (item.roles && !item.roles.includes(user?.role)) {
              return null;
            }

            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile & Role Info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white font-semibold flex items-center justify-center text-sm shadow-sm shrink-0">
              {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{user?.full_name || 'StockSphere User'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                  user?.role === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : user?.role === 'manager'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {user?.role}
                </span>
                {user?.role === 'staff' && user?.warehouses && (
                  <span className="text-[11px] text-slate-500 truncate" title={`${user.warehouses.length} warehouse(s)`}>
                    ({user.warehouses.length} WH)
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50/70 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

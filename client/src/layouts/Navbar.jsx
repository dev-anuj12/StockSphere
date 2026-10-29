import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Menu, Bell, Shield, Warehouse } from 'lucide-react';

export function Navbar({ onOpenSidebar }) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Realtime System Online</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Role Scope Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 text-xs font-medium text-slate-700">
          <Shield className="w-3.5 h-3.5 text-indigo-600" />
          <span>Scoped as <strong className="uppercase">{user?.role}</strong></span>
        </div>

        {/* Assigned Warehouse for Staff */}
        {user?.role === 'staff' && user?.warehouses && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-xs font-medium text-indigo-700">
            <Warehouse className="w-3.5 h-3.5" />
            <span>{user.warehouses.length} Active Warehouse(s)</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-800 leading-none">{user?.full_name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{user?.email}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}

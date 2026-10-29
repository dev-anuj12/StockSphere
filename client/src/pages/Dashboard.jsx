import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { CardSkeleton, TableSkeleton } from '../components/Skeleton.jsx';
import {
  Package,
  DollarSign,
  AlertTriangle,
  PackageX,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  SlidersHorizontal,
  History,
  TrendingUp,
  Warehouse,
  Boxes,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export function Dashboard() {
  const { user, hasRole } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentMovements, setRecentMovements] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [statsRes, movRes, lowRes, chartsRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/recent-movements?limit=6'),
          api.get('/dashboard/low-stock?limit=6'),
          api.get('/dashboard/charts'),
        ]);

        setStats(statsRes.data);
        setRecentMovements(movRes.data.data);
        setLowStockAlerts(lowRes.data.data);
        setCharts(chartsRes.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Welcome back, {user?.full_name}! 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time warehouse inventory and movement ledger overview.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/stock-in"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Stock In</span>
          </Link>
          <Link
            to="/stock-out"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>Stock Out</span>
          </Link>
          {hasRole('admin', 'manager') && (
            <>
              <Link
                to="/stock-transfer"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Transfer</span>
              </Link>
              <Link
                to="/stock-adjustment"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Adjustment</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Products</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats?.total_products || 0}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Across {stats?.total_warehouses || 0} Warehouses</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Total Valuation */}
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inventory Value</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              ${stats?.total_valuation?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{stats?.total_quantity?.toLocaleString()} Total Units</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock Items</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats?.low_stock_count || 0}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Below Reorder Level</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Out of Stock */}
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Out of Stock</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">{stats?.out_of_stock_count || 0}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Critical Replenishment</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <PackageX className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock In vs Out Trend */}
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Stock Movements Trend</h2>
              <p className="text-xs text-slate-500">Inbound vs Outbound activity (Last 14 days)</p>
            </div>
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="h-64 w-full">
            {charts?.in_out_trend?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.in_out_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="stock_in" name="Stock In" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="stock_out" name="Stock Out" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No recent movements recorded in this period
              </div>
            )}
          </div>
        </div>

        {/* Inventory Valuation by Warehouse */}
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Inventory by Warehouse</h2>
              <p className="text-xs text-slate-500">Stock valuation and units per facility</p>
            </div>
            <Warehouse className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="h-64 w-full">
            {charts?.inventory_by_warehouse?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.inventory_by_warehouse} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="warehouse_code" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value, name) => [name === 'total_valuation' ? `$${Number(value).toLocaleString()}` : `${value} units`, name === 'total_valuation' ? 'Valuation' : 'Units']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="total_valuation" name="Valuation ($)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No warehouse inventory balances found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Section: Low Stock Priority Queue (Min-Heap) & Recent Ledger Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prioritized Low Stock Alerts (Min-Heap) */}
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Prioritized Low Stock Alerts</h2>
                <p className="text-xs text-slate-500">Min-Heap urgency ordering (Deficit / Reorder)</p>
              </div>
            </div>
            <Link to="/products?stockStatus=low_stock" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Product</th>
                  <th className="py-2.5 px-3">Current</th>
                  <th className="py-2.5 px-3">Reorder</th>
                  <th className="py-2.5 px-3">Replenish</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockAlerts.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{item.sku}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-bold px-2 py-0.5 rounded-full ${item.total_stock === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                        {item.total_stock} {item.unit}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {item.reorder_level} {item.unit}
                    </td>
                    <td className="py-3 px-3 font-semibold text-indigo-600">
                      +{item.suggested_replenishment} {item.unit}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/stock-in?productId=${item.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg transition"
                      >
                        Restock
                      </Link>
                    </td>
                  </tr>
                ))}
                {lowStockAlerts.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-slate-400">
                      All inventory levels are above reorder thresholds! 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Ledger Movements */}
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent Movements</h2>
                <p className="text-xs text-slate-500">Append-only immutable audit trail</p>
              </div>
            </div>
            <Link to="/movements" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <span>Full Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Type</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Warehouse</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentMovements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3">
                      <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${
                        m.type === 'IN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.type === 'OUT'
                          ? 'bg-rose-100 text-rose-800'
                          : m.type === 'TRANSFER'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 truncate max-w-[140px]">{m.product_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{m.product_sku}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {m.warehouse_name}
                    </td>
                    <td className={`py-3 px-3 text-right font-bold ${m.quantity_change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-700">
                      {m.balance_after}
                    </td>
                  </tr>
                ))}
                {recentMovements.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-slate-400">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

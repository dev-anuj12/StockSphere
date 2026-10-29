import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { CardSkeleton, TableSkeleton } from '../components/Skeleton.jsx';
import {
  Package,
  Boxes,
  Warehouse,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  SlidersHorizontal,
  ChevronLeft,
  DollarSign,
  AlertTriangle,
  Building2,
  Calendar,
} from 'lucide-react';

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await api.get(`/products/${id}`);
        setProduct(res.data);
      } catch (err) {
        console.error('Failed to load product details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <TableSkeleton rows={5} cols={4} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-slate-800">Product Not Found</h2>
        <p className="text-sm text-slate-500 mt-2">The requested product could not be located.</p>
        <button
          onClick={() => navigate('/products')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold"
        >
          Back to Products
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Navigation & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/products')}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
              <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200/60">
                {product.sku}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{product.category_name || 'Uncategorized'}</p>
          </div>
        </div>

        {/* Quick Operations for this product */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/stock-in?productId=${product.id}`}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Stock In</span>
          </Link>
          <Link
            to={`/stock-out?productId=${product.id}`}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>Stock Out</span>
          </Link>
          {hasRole('admin', 'manager') && (
            <>
              <Link
                to={`/stock-transfer?productId=${product.id}`}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Transfer</span>
              </Link>
              <Link
                to={`/stock-adjustment?productId=${product.id}`}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Adjustment</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Info Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Stock</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-slate-900">{product.total_stock}</span>
            <span className="text-sm text-slate-500 font-medium">{product.unit}</span>
          </div>
          <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${
            product.stock_status === 'out_of_stock'
              ? 'bg-rose-100 text-rose-700'
              : product.stock_status === 'low_stock'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}>
            {product.stock_status === 'out_of_stock' ? 'Out of Stock' : product.stock_status === 'low_stock' ? 'Low Stock' : 'In Stock'}
          </span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Inventory Value</span>
          <div className="text-3xl font-bold text-slate-900 mt-1">
            ${Number(product.inventory_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-400 mt-2">Cost: ${Number(product.cost_price).toFixed(2)} / unit</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Selling Price</span>
          <div className="text-3xl font-bold text-slate-900 mt-1">
            ${Number(product.selling_price).toFixed(2)}
          </div>
          <p className="text-xs text-emerald-600 font-semibold mt-2">
            Margin: ${(Number(product.selling_price) - Number(product.cost_price)).toFixed(2)} ({(((Number(product.selling_price) - Number(product.cost_price)) / Number(product.selling_price)) * 100).toFixed(1)}%)
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reorder Threshold</span>
          <div className="text-3xl font-bold text-slate-900 mt-1">
            {product.reorder_level} <span className="text-sm font-medium text-slate-500">{product.unit}</span>
          </div>
          <p className="text-xs text-indigo-600 font-semibold mt-2">
            Replenishment Target: +{product.suggested_replenishment} {product.unit}
          </p>
        </div>
      </div>

      {/* Two Column Layout: Per-Warehouse Stocks & Recent Ledger Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per-Warehouse Stocks */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Per-Warehouse Balances</h2>
              <p className="text-xs text-slate-500">Live storage breakdown by active facility</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Warehouse</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">Quantity On Hand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {product.warehouse_stocks?.map(wh => (
                  <tr key={wh.warehouse_id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {wh.warehouse_name}
                      <span className="block text-[11px] font-mono text-slate-400 font-normal">{wh.warehouse_code}</span>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">{wh.location}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-bold px-2.5 py-1 rounded-lg text-xs ${wh.quantity > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                        {wh.quantity} {product.unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Ledger History */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Movement History</h2>
              <p className="text-xs text-slate-500">Append-only immutable transaction entries</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Type</th>
                  <th className="py-2.5 px-3">Warehouse</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {product.recent_movements?.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3">
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                        m.type === 'IN' ? 'bg-emerald-100 text-emerald-800' : m.type === 'OUT' ? 'bg-rose-100 text-rose-800' : m.type === 'TRANSFER' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{m.warehouse_name}</td>
                    <td className={`py-3 px-3 text-right font-bold ${m.quantity_change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-800">{m.balance_after}</td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(!product.recent_movements || product.recent_movements.length === 0) && (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-slate-400">
                      No stock movements recorded for this product yet.
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

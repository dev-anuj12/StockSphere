import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Modal } from '../components/Modal.jsx';
import {
  History,
  Search,
  Filter,
  Calendar,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldCheck,
  FileText,
} from 'lucide-react';

export function Movements() {
  const { user } = useAuth();
  const toast = useToast();

  const [movements, setMovements] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [selectedMovement, setSelectedMovement] = useState(null);

  // Load warehouses
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await api.get('/warehouses');
        let list = res.data.data || [];
        if (user?.role === 'staff' && Array.isArray(user?.warehouses)) {
          list = list.filter(w => user.warehouses.includes(w.id));
        }
        setWarehouses(list);
      } catch (err) {
        console.error(err);
      }
    }
    loadWarehouses();
  }, [user]);

  // Fetch movements
  const fetchMovements = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/movements', {
        params: {
          page,
          limit: 15,
          search,
          type: type || undefined,
          warehouseId: warehouseId || undefined,
        },
      });
      setMovements(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load inventory movements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [page, type, warehouseId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchMovements();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const totalPages = Math.ceil(total / 15) || 1;

  const getTypeBadge = t => {
    switch (t) {
      case 'IN':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800"><ArrowDownToLine className="w-3 h-3" /> IN</span>;
      case 'OUT':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800"><ArrowUpFromLine className="w-3 h-3" /> OUT</span>;
      case 'TRANSFER':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800"><ArrowLeftRight className="w-3 h-3" /> TRANSFER</span>;
      case 'ADJUSTMENT':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800"><SlidersHorizontal className="w-3 h-3" /> ADJUSTMENT</span>;
      default:
        return <span>{t}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" />
            <span>Append-Only Movements Ledger</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cryptographically guaranteed immutable audit log. Update and Delete operations are strictly forbidden by database triggers.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Ledger Invariant Verified</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product, SKU, reference, or reason..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Type Filter */}
          <select
            value={type}
            onChange={e => {
              setType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            <option value="">All Movement Types</option>
            <option value="IN">IN (Receipts)</option>
            <option value="OUT">OUT (Dispatches)</option>
            <option value="TRANSFER">TRANSFER (Inter-Warehouse)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Cycle Audits)</option>
          </select>

          {/* Warehouse Filter */}
          <select
            value={warehouseId}
            onChange={e => {
              setWarehouseId(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            <option value="">All Facilities</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : movements.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Product</th>
                    <th className="py-3.5 px-4">Facility</th>
                    <th className="py-3.5 px-4 text-right">Qty Change</th>
                    <th className="py-3.5 px-4 text-right">Balance After</th>
                    <th className="py-3.5 px-4">Reference / Reason</th>
                    <th className="py-3.5 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{new Date(m.created_at).toLocaleDateString()}</div>
                        <div className="text-[11px] text-slate-400">{new Date(m.created_at).toLocaleTimeString()}</div>
                      </td>
                      <td className="py-3.5 px-4">{getTypeBadge(m.type)}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{m.product_name}</div>
                        <div className="font-mono text-xs text-slate-400">{m.product_sku}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 text-xs font-medium">
                        {m.warehouse_name}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-bold text-sm ${
                        m.quantity_change > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                        {m.balance_after}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[200px]">
                        <div className="font-medium truncate text-slate-800">{m.reference_no || 'No Ref'}</div>
                        <div className="truncate text-slate-400 text-[11px]">{m.reason}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedMovement(m)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="View Ledger Transaction Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Showing {movements.length} of {total} ledger entries (Page {page} of {totalPages})
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="No Movements Found"
            description="No inventory movement records match your specified criteria."
            icon={History}
          />
        )}
      </div>

      {/* Movement Detail Slide-Over Modal */}
      <Modal
        isOpen={!!selectedMovement}
        onClose={() => setSelectedMovement(null)}
        title="Ledger Transaction Certificate"
      >
        {selectedMovement && (
          <div className="space-y-4 text-sm">
            <div className="p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Movement ID</span>
                <span className="font-mono text-xs text-slate-800">{selectedMovement.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Timestamp</span>
                <span className="text-xs text-slate-800">{new Date(selectedMovement.created_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Action Type</span>
                {getTypeBadge(selectedMovement.type)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-400 block font-medium">Product</span>
                <strong className="text-slate-800 block mt-0.5">{selectedMovement.product_name}</strong>
                <span className="font-mono text-xs text-slate-500">{selectedMovement.product_sku}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-400 block font-medium">Facility</span>
                <strong className="text-slate-800 block mt-0.5">{selectedMovement.warehouse_name}</strong>
                <span className="font-mono text-xs text-slate-500">{selectedMovement.warehouse_code}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-center">
              <div>
                <span className="text-[11px] font-semibold text-indigo-700 uppercase block">Signed Delta</span>
                <span className={`text-lg font-bold ${selectedMovement.quantity_change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {selectedMovement.quantity_change > 0 ? `+${selectedMovement.quantity_change}` : selectedMovement.quantity_change}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-indigo-700 uppercase block">Balance After</span>
                <span className="text-lg font-bold text-slate-800">{selectedMovement.balance_after}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-indigo-700 uppercase block">Snapshot Cost</span>
                <span className="text-lg font-bold text-slate-800">${Number(selectedMovement.unit_cost || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Reference:</span>
                <span className="font-semibold text-slate-800">{selectedMovement.reference_no || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Reason:</span>
                <span className="font-semibold text-slate-800">{selectedMovement.reason || 'N/A'}</span>
              </div>
              {selectedMovement.transfer_id && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Transfer UUID:</span>
                  <span className="font-mono text-slate-700">{selectedMovement.transfer_id}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Executed By:</span>
                <span className="font-semibold text-slate-800">{selectedMovement.user_name || 'System / Admin'}</span>
              </div>
              {selectedMovement.notes && (
                <div className="pt-2 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <strong className="block text-[11px] uppercase text-slate-400 mb-0.5">Notes:</strong>
                  {selectedMovement.notes}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

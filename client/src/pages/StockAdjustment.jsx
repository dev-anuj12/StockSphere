import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { ProductAutocomplete } from '../components/Autocomplete.jsx';
import {
  SlidersHorizontal,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  Minus,
} from 'lucide-react';

export function StockAdjustment() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [countedQuantity, setCountedQuantity] = useState('');
  const [reason, setReason] = useState('Annual Physical Inventory Audit');
  const [notes, setNotes] = useState('');

  const [currentBalance, setCurrentBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // Client-Side Undo Stack (Data Structure for unsubmitted adjustment edits)
  const [undoStack, setUndoStack] = useState([]);

  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await api.get('/warehouses');
        const list = res.data.data || [];
        setWarehouses(list);
        if (list.length > 0) setWarehouseId(list[0].id);
      } catch (err) {
        toast.error('Failed to load warehouses');
      }
    }
    loadWarehouses();
  }, []);

  useEffect(() => {
    const pId = searchParams.get('productId');
    if (pId) {
      api.get(`/products/${pId}`).then(res => {
        setSelectedProduct(res.data);
      }).catch(() => {});
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchBalance() {
      if (!selectedProduct || !warehouseId) {
        setCurrentBalance(null);
        return;
      }
      setLoadingBalance(true);
      try {
        const res = await api.get(`/inventory/balances?productId=${selectedProduct.id}&warehouseId=${warehouseId}`);
        const bal = res.data.data?.[0]?.quantity ?? 0;
        setCurrentBalance(bal);
        // Pre-fill counted quantity with current balance if empty
        if (countedQuantity === '') {
          setCountedQuantity(String(bal));
        }
      } catch (err) {
        setCurrentBalance(0);
      } finally {
        setLoadingBalance(false);
      }
    }
    fetchBalance();
  }, [selectedProduct, warehouseId]);

  // Handle Counted Quantity Change with Undo Stack tracking
  const handleCountedChange = newVal => {
    if (newVal !== countedQuantity) {
      // Push previous state to undo stack
      setUndoStack(prev => [...prev, { countedQuantity, reason, notes }]);
      setCountedQuantity(newVal);
    }
  };

  // Pop and restore from Client-Side Undo Stack
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setCountedQuantity(previousState.countedQuantity);
    setReason(previousState.reason);
    setNotes(previousState.notes);
    setUndoStack(prev => prev.slice(0, prev.length - 1));
    toast.info('Restored previous unsubmitted edit from Undo Stack.');
  };

  const countedNum = parseInt(countedQuantity, 10);
  const isValidCount = !isNaN(countedNum) && countedNum >= 0;
  const difference = currentBalance !== null && isValidCount ? countedNum - currentBalance : null;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }
    if (!warehouseId) {
      toast.error('Please select a warehouse');
      return;
    }
    if (!isValidCount) {
      toast.error('Counted quantity must be a non-negative integer (0 or greater)');
      return;
    }
    if (!reason || reason.trim().length < 3) {
      toast.error('An adjustment reason is strictly required (minimum 3 characters)');
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = `adj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const res = await api.post(
        '/inventory/adjustment',
        {
          product_id: selectedProduct.id,
          warehouse_id: warehouseId,
          counted_quantity: countedNum,
          reason: reason.trim(),
          notes: notes || null,
        },
        {
          headers: { 'Idempotency-Key': idempotencyKey },
        }
      );

      setLastResult(res.data);
      toast.success(res.data.message || `Inventory balance updated to ${countedNum} units!`);
      setCurrentBalance(countedNum);
      setUndoStack([]); // Clear stack on successful commit
    } catch (err) {
      toast.error(err.response?.data?.message || 'Adjustment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-slate-800" />
            <span>Physical Stock Adjustment</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Reconcile physical inventory counts. The server calculates signed difference and writes an immutable ledger entry.
          </p>
        </div>

        {/* Undo Stack Action Button */}
        {undoStack.length > 0 && (
          <button
            type="button"
            onClick={handleUndo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold shadow-sm transition self-start sm:self-auto"
            title="Pop last unsubmitted state from the Client Undo Stack"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo Edit ({undoStack.length})</span>
          </button>
        )}
      </div>

      {lastResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <h4 className="font-bold">Stock Adjustment Applied</h4>
            <p className="mt-0.5">
              Previous: <strong>{lastResult.previous_balance}</strong> | New Count: <strong>{lastResult.counted_quantity}</strong> | Signed Ledger Diff: <strong>{lastResult.quantity_change > 0 ? `+${lastResult.quantity_change}` : lastResult.quantity_change} units</strong>.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
            Select Product *
          </label>
          <ProductAutocomplete
            selectedProduct={selectedProduct}
            onSelect={prod => {
              setSelectedProduct(prod);
              setCountedQuantity('');
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Warehouse Facility *
            </label>
            <select
              value={warehouseId}
              onChange={e => {
                setWarehouseId(e.target.value);
                setCountedQuantity('');
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Live System Balance (Before Audit)
            </label>
            <div className="px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-semibold text-slate-700 flex items-center justify-between">
              <span>{loadingBalance ? 'Checking...' : currentBalance !== null ? `${currentBalance} ${selectedProduct?.unit || 'units'}` : 'Select product & warehouse'}</span>
              <Warehouse className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Physical Counted Quantity & Real-time Server Difference Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Actual Physical Counted Quantity *
            </label>
            <input
              type="number"
              min="0"
              required
              value={countedQuantity}
              onChange={e => handleCountedChange(e.target.value)}
              placeholder="e.g. 45"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Computed Signed Adjustment (Difference)
            </label>
            <div className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between ${
              difference === null
                ? 'bg-slate-100 text-slate-400'
                : difference > 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : difference < 0
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-100 text-slate-600'
            }`}>
              <span>
                {difference === null
                  ? 'Enter physical count'
                  : difference === 0
                  ? 'No difference (0 units)'
                  : difference > 0
                  ? `+${difference} Surplus units`
                  : `${difference} Deficit units`}
              </span>
              {difference !== null && difference !== 0 && (
                <span className="text-xs font-normal opacity-80">Ledger Entry</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
            Adjustment Reason (Required by Audit Policy) *
          </label>
          <input
            type="text"
            required
            minLength={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Annual Cycle Count reconciliation, physical discrepancy found"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
            Audit Notes (Optional)
          </label>
          <textarea
            rows="2"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Auditor initials, batch verification, rack barcode..."
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedProduct || !isValidCount}
            className="px-6 py-2.5 bg-slate-900 hover:bg-black disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md transition flex items-center gap-2"
          >
            {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <SlidersHorizontal className="w-4 h-4" />
            <span>Apply Adjustment</span>
          </button>
        </div>
      </form>
    </div>
  );
}

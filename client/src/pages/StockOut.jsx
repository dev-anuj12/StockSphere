import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ProductAutocomplete } from '../components/Autocomplete.jsx';
import {
  ArrowUpFromLine,
  Warehouse,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

export function StockOut() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [reason, setReason] = useState('Customer Order Dispatch');
  const [notes, setNotes] = useState('');

  const [currentBalance, setCurrentBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

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
        if (list.length > 0) setWarehouseId(list[0].id);
      } catch (err) {
        toast.error('Failed to load warehouses');
      }
    }
    loadWarehouses();
  }, [user]);

  // Load preselected product if productId in query
  useEffect(() => {
    const pId = searchParams.get('productId');
    if (pId) {
      api.get(`/products/${pId}`).then(res => {
        setSelectedProduct(res.data);
      }).catch(() => {});
    }
  }, [searchParams]);

  // Fetch current balance
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
      } catch (err) {
        setCurrentBalance(0);
      } finally {
        setLoadingBalance(false);
      }
    }
    fetchBalance();
  }, [selectedProduct, warehouseId]);

  const qtyNumber = parseInt(quantity, 10) || 0;
  const isInsufficient = currentBalance !== null && qtyNumber > currentBalance;

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
    if (qtyNumber <= 0) {
      toast.error('Quantity must be a positive integer');
      return;
    }
    if (isInsufficient) {
      toast.error(`Insufficient stock! Only ${currentBalance} units available.`);
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = `out-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const res = await api.post(
        '/inventory/stock-out',
        {
          product_id: selectedProduct.id,
          warehouse_id: warehouseId,
          quantity: qtyNumber,
          reference_no: referenceNo || null,
          reason,
          notes: notes || null,
        },
        {
          headers: { 'Idempotency-Key': idempotencyKey },
        }
      );

      setLastResult(res.data);
      toast.success(`Successfully dispatched ${qtyNumber} ${selectedProduct.unit} from ${res.data.warehouse_name}!`);
      setCurrentBalance(res.data.new_balance);
      setQuantity('');
      setReferenceNo('');
      setNotes('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Stock Out operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ArrowUpFromLine className="w-6 h-6 text-rose-600" />
          <span>Stock Out (Outbound Dispatch)</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Deduct inventory from warehouse balance with real-time stock-out validation.
        </p>
      </div>

      {lastResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <h4 className="font-bold">Stock Out Successful</h4>
            <p className="mt-0.5">
              Dispatched <strong>{lastResult.quantity_removed} units</strong> of {lastResult.product_name} from {lastResult.warehouse_name}.
              Remaining live balance: <strong>{lastResult.new_balance} units</strong>.
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
            onSelect={prod => setSelectedProduct(prod)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Source Warehouse *
            </label>
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Available Quantity on Hand
            </label>
            <div className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between ${
              currentBalance === 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
            }`}>
              <span>{loadingBalance ? 'Checking...' : currentBalance !== null ? `${currentBalance} ${selectedProduct?.unit || 'units'}` : 'Select product & facility'}</span>
              <Warehouse className="w-4 h-4 opacity-50" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Quantity to Dispatch *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="e.g. 10"
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                isInsufficient ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200 focus:ring-indigo-500'
              }`}
            />
            {isInsufficient && (
              <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Requested quantity ({qtyNumber}) exceeds available balance ({currentBalance})
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              SO / Dispatch Reference
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={e => setReferenceNo(e.target.value)}
              placeholder="e.g. SO-2026-4421"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Dispatch Reason
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Customer Order Dispatch">Customer Order Dispatch</option>
              <option value="Sample / Marketing">Sample / Marketing</option>
              <option value="Damaged / Scrap Write-Off">Damaged / Scrap Write-Off</option>
              <option value="Internal Department Consumption">Internal Department Consumption</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Internal Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Courier tracking, destination address..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
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
            disabled={submitting || !selectedProduct || isInsufficient || currentBalance === 0}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md shadow-rose-200 transition flex items-center gap-2"
          >
            {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <ArrowUpFromLine className="w-4 h-4" />
            <span>Confirm Stock Out</span>
          </button>
        </div>
      </form>
    </div>
  );
}

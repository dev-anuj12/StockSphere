import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ProductAutocomplete } from '../components/Autocomplete.jsx';
import {
  ArrowDownToLine,
  Warehouse,
  CheckCircle2,
  Package,
  Layers,
  FileText,
} from 'lucide-react';

export function StockIn() {
  const { user, hasWarehouseAccess } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [reason, setReason] = useState('Supplier Restock');
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
        // If staff, filter to assigned warehouses
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

  // Fetch current balance for selected product & warehouse
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

  const handleSubmit = async e => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }
    if (!warehouseId) {
      toast.error('Please select a destination warehouse');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be a positive integer');
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = `in-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const res = await api.post(
        '/inventory/stock-in',
        {
          product_id: selectedProduct.id,
          warehouse_id: warehouseId,
          quantity: qty,
          reference_no: referenceNo || null,
          reason,
          notes: notes || null,
        },
        {
          headers: { 'Idempotency-Key': idempotencyKey },
        }
      );

      setLastResult(res.data);
      toast.success(`Successfully received ${qty} ${selectedProduct.unit} into ${res.data.warehouse_name}!`);
      setCurrentBalance(res.data.new_balance);
      setQuantity('');
      setReferenceNo('');
      setNotes('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Stock In operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ArrowDownToLine className="w-6 h-6 text-emerald-600" />
          <span>Stock In (Inbound Receipt)</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Receive inventory into a warehouse facility with an append-only ledger audit trail.
        </p>
      </div>

      {lastResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <h4 className="font-bold">Stock In Successful</h4>
            <p className="mt-0.5">
              Received <strong>{lastResult.quantity_added} units</strong> of {lastResult.product_name} into {lastResult.warehouse_name}.
              New live balance: <strong>{lastResult.new_balance} units</strong>.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        {/* Product Autocomplete */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
            Select Product *
          </label>
          <ProductAutocomplete
            selectedProduct={selectedProduct}
            onSelect={prod => setSelectedProduct(prod)}
          />
        </div>

        {/* Warehouse Selection & Live Balance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Destination Warehouse *
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
              Current Balance on Hand
            </label>
            <div className="px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-semibold text-slate-700 flex items-center justify-between">
              <span>{loadingBalance ? 'Checking...' : currentBalance !== null ? `${currentBalance} ${selectedProduct?.unit || 'units'}` : 'Select product & facility'}</span>
              <Warehouse className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Quantity & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Quantity to Receive *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="e.g. 50"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              PO / Reference Number
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={e => setReferenceNo(e.target.value)}
              placeholder="e.g. PO-2026-0891"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Reason & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Receipt Reason
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Supplier Restock">Supplier Restock</option>
              <option value="Customer Return">Customer Return</option>
              <option value="Initial Batch">Initial Batch Setup</option>
              <option value="Manufacturing Assembly">Manufacturing Assembly</option>
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
              placeholder="Carrier details, pallet number..."
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
            disabled={submitting || !selectedProduct}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-200 transition flex items-center gap-2"
          >
            {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <ArrowDownToLine className="w-4 h-4" />
            <span>Confirm Stock In</span>
          </button>
        </div>
      </form>
    </div>
  );
}

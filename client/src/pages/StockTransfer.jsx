import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ProductAutocomplete } from '../components/Autocomplete.jsx';
import {
  ArrowLeftRight,
  Warehouse,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export function StockTransfer() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [reason, setReason] = useState('Inter-Warehouse Rebalancing');
  const [notes, setNotes] = useState('');

  const [sourceBalance, setSourceBalance] = useState(null);
  const [destinationBalance, setDestinationBalance] = useState(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await api.get('/warehouses');
        const list = res.data.data || [];
        setWarehouses(list);
        if (list.length >= 2) {
          setSourceWarehouseId(list[0].id);
          setDestinationWarehouseId(list[1].id);
        }
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
    async function fetchBalances() {
      if (!selectedProduct || !sourceWarehouseId || !destinationWarehouseId) {
        setSourceBalance(null);
        setDestinationBalance(null);
        return;
      }
      setLoadingBalances(true);
      try {
        const [srcRes, destRes] = await Promise.all([
          api.get(`/inventory/balances?productId=${selectedProduct.id}&warehouseId=${sourceWarehouseId}`),
          api.get(`/inventory/balances?productId=${selectedProduct.id}&warehouseId=${destinationWarehouseId}`),
        ]);
        setSourceBalance(srcRes.data.data?.[0]?.quantity ?? 0);
        setDestinationBalance(destRes.data.data?.[0]?.quantity ?? 0);
      } catch (err) {
        setSourceBalance(0);
        setDestinationBalance(0);
      } finally {
        setLoadingBalances(false);
      }
    }
    fetchBalances();
  }, [selectedProduct, sourceWarehouseId, destinationWarehouseId]);

  const qtyNumber = parseInt(quantity, 10) || 0;
  const isInsufficient = sourceBalance !== null && qtyNumber > sourceBalance;
  const isSameWarehouse = sourceWarehouseId === destinationWarehouseId;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }
    if (isSameWarehouse) {
      toast.error('Source and destination warehouses cannot be identical');
      return;
    }
    if (qtyNumber <= 0) {
      toast.error('Quantity must be a positive integer');
      return;
    }
    if (isInsufficient) {
      toast.error(`Source warehouse only has ${sourceBalance} units available.`);
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = `trf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const res = await api.post(
        '/inventory/transfer',
        {
          product_id: selectedProduct.id,
          source_warehouse_id: sourceWarehouseId,
          destination_warehouse_id: destinationWarehouseId,
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
      toast.success(`Successfully transferred ${qtyNumber} units!`);
      setSourceBalance(res.data.source_warehouse.new_balance);
      setDestinationBalance(res.data.destination_warehouse.new_balance);
      setQuantity('');
      setReferenceNo('');
      setNotes('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-indigo-600" />
          <span>Inter-Warehouse Stock Transfer</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Atomic two-phase locked inventory transfer with linked ledger transaction pairs.
        </p>
      </div>

      {lastResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <h4 className="font-bold">Transfer Completed Successfully</h4>
            <p className="mt-0.5">
              Moved <strong>{lastResult.quantity_transferred} units</strong> from {lastResult.source_warehouse.name} (New bal: {lastResult.source_warehouse.new_balance}) to {lastResult.destination_warehouse.name} (New bal: {lastResult.destination_warehouse.new_balance}).
            </p>
            <p className="text-xs font-mono text-emerald-700 mt-1">Transfer ID: {lastResult.transfer_id}</p>
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

        {/* Source & Destination Warehouses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Source Facility (Send From) *
            </label>
            <select
              value={sourceWarehouseId}
              onChange={e => setSourceWarehouseId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between px-1">
              <span>Source Balance:</span>
              <strong className="text-slate-800">{loadingBalances ? '...' : sourceBalance !== null ? `${sourceBalance} ${selectedProduct?.unit || 'units'}` : '-'}</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Destination Facility (Receive Into) *
            </label>
            <select
              value={destinationWarehouseId}
              onChange={e => setDestinationWarehouseId(e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                isSameWarehouse ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200 focus:ring-indigo-500'
              }`}
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between px-1">
              <span>Destination Balance:</span>
              <strong className="text-slate-800">{loadingBalances ? '...' : destinationBalance !== null ? `${destinationBalance} ${selectedProduct?.unit || 'units'}` : '-'}</strong>
            </div>
            {isSameWarehouse && (
              <p className="text-xs text-rose-600 mt-1 font-medium">Destination must differ from source facility.</p>
            )}
          </div>
        </div>

        {/* Quantity & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Quantity to Transfer *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="e.g. 20"
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                isInsufficient ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200 focus:ring-indigo-500'
              }`}
            />
            {isInsufficient && (
              <p className="text-xs text-rose-600 mt-1 font-medium">Quantity exceeds source balance ({sourceBalance}).</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Transfer Reference
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={e => setReferenceNo(e.target.value)}
              placeholder="e.g. TRF-2026-902"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Reason & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Transfer Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Regional demand spike rebalancing"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Transit Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Freight carrier, vehicle license..."
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
            disabled={submitting || !selectedProduct || isSameWarehouse || isInsufficient || sourceBalance === 0}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200 transition flex items-center gap-2"
          >
            {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <ArrowLeftRight className="w-4 h-4" />
            <span>Execute Transfer</span>
          </button>
        </div>
      </form>
    </div>
  );
}

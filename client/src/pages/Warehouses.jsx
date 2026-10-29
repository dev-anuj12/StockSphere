import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Modal } from '../components/Modal.jsx';
import { CardSkeleton, TableSkeleton } from '../components/Skeleton.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import {
  Warehouse as WarehouseIcon,
  Plus,
  MapPin,
  Package,
  DollarSign,
  Boxes,
  Eye,
  Edit2,
  ChevronRight,
} from 'lucide-react';

export function Warehouses() {
  const { hasRole, user } = useAuth();
  const toast = useToast();

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [selectedWarehouseDetail, setSelectedWarehouseDetail] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    location: '',
  });

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/warehouses');
      setWarehouses(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleOpenDetail = async wh => {
    try {
      const res = await api.get(`/warehouses/${wh.id}`);
      setSelectedWarehouseDetail(res.data);
    } catch (err) {
      toast.error('Failed to fetch warehouse details');
    }
  };

  const handleOpenAdd = () => {
    setEditingWarehouse(null);
    setFormData({ name: '', code: '', location: '' });
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = wh => {
    setEditingWarehouse(wh);
    setFormData({ name: wh.name, code: wh.code, location: wh.location });
    setIsAddEditOpen(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        location: formData.location,
      };

      if (editingWarehouse) {
        await api.put(`/warehouses/${editingWarehouse.id}`, payload);
        toast.success(`Warehouse '${payload.name}' updated!`);
      } else {
        await api.post('/warehouses', payload);
        toast.success(`Warehouse '${payload.name}' created!`);
      }

      setIsAddEditOpen(false);
      fetchWarehouses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save warehouse');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Warehouses & Storage Facilities</h1>
          <p className="text-sm text-slate-500">
            Physical distribution centers, fulfillment hubs, and localized stock depots.
          </p>
        </div>

        {hasRole('admin') && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Warehouse</span>
          </button>
        )}
      </div>

      {/* Warehouse Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : warehouses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map(wh => {
            const isAssigned = user?.role !== 'staff' || (Array.isArray(user?.warehouses) && user.warehouses.includes(wh.id));

            return (
              <div
                key={wh.id}
                className={`bg-white rounded-2xl border p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between ${
                  isAssigned ? 'border-slate-200/80' : 'border-slate-100 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                        <WarehouseIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{wh.name}</h3>
                        <span className="font-mono text-xs text-slate-400 font-semibold">{wh.code}</span>
                      </div>
                    </div>
                    {hasRole('admin') && (
                      <button
                        onClick={() => handleOpenEdit(wh)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{wh.location}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-3 px-3.5 bg-slate-50 rounded-xl mb-4 text-xs">
                    <div>
                      <span className="text-slate-400 block font-medium">Stored Units</span>
                      <strong className="text-slate-800 text-sm">{wh.total_stock?.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Total Value</span>
                      <strong className="text-emerald-700 text-sm">
                        ${Number(wh.total_valuation || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isAssigned ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    {isAssigned ? 'Accessible' : 'Unassigned'}
                  </span>
                  <button
                    onClick={() => handleOpenDetail(wh)}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    <span>View Stored Products</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No Warehouses Found"
          description="Create your first warehouse facility to start storing stock."
          icon={WarehouseIcon}
        />
      )}

      {/* Warehouse Detail Modal (Stored Products) */}
      <Modal
        isOpen={!!selectedWarehouseDetail}
        onClose={() => setSelectedWarehouseDetail(null)}
        title={selectedWarehouseDetail ? `${selectedWarehouseDetail.name} (${selectedWarehouseDetail.code}) - Stored Stock` : 'Warehouse Inventory'}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
            <span>Location: <strong className="text-slate-800">{selectedWarehouseDetail?.location}</strong></span>
            <span>Total Valuation: <strong className="text-emerald-700">${Number(selectedWarehouseDetail?.total_valuation || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">SKU / Product</th>
                  <th className="py-2.5 px-3 text-right">Cost</th>
                  <th className="py-2.5 px-3 text-center">Quantity</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedWarehouseDetail?.stored_products?.map(p => (
                  <tr key={p.product_id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{p.product_name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{p.sku}</div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 font-medium">
                      ${Number(p.cost_price).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-slate-900 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        {p.quantity} {p.unit}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900">
                      ${Number(p.valuation).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {(!selectedWarehouseDetail?.stored_products || selectedWarehouseDetail.stored_products.length === 0) && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-slate-400">
                      No stock currently on hand in this warehouse.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Add / Edit Warehouse Modal */}
      <Modal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        title={editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Warehouse Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Central Distribution Center"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Facility Code *
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. WH-CDC"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Location / City *
            </label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Dallas, TX"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddEditOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition flex items-center gap-2"
            >
              {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingWarehouse ? 'Save Changes' : 'Create Warehouse'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

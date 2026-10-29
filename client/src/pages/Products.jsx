import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Modal } from '../components/Modal.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import {
  Package,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  MoreVertical,
  Archive,
  Eye,
  Edit2,
  AlertTriangle,
  Boxes,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export function Products() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [page, setPage] = useState(parseInt(searchParams.get('page') || 1, 10));
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || '');
  const [stockStatus, setStockStatus] = useState(searchParams.get('stockStatus') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'name');
  const [order, setOrder] = useState(searchParams.get('order') || 'ASC');

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [productToArchive, setProductToArchive] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category_id: '',
    supplier_id: '',
    unit: 'pcs',
    cost_price: '',
    selling_price: '',
    reorder_level: 10,
  });

  // Fetch Categories & Suppliers for dropdowns
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const [catRes, supRes] = await Promise.all([
          api.get('/categories'),
          api.get('/suppliers').catch(() => ({ data: { data: [] } })),
        ]);
        setCategories(catRes.data.data || []);
        setSuppliers(supRes.data.data || []);
      } catch (err) {
        console.error('Error fetching metadata:', err);
      }
    }
    fetchMetadata();
  }, []);

  // Fetch Products List
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products', {
        params: {
          page,
          limit: 10,
          search,
          categoryId: categoryId || undefined,
          stockStatus: stockStatus || undefined,
          sort,
          order,
        },
      });
      setProducts(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load products catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, categoryId, stockStatus, sort, order]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      sku: '',
      name: '',
      description: '',
      category_id: '',
      supplier_id: '',
      unit: 'pcs',
      cost_price: '',
      selling_price: '',
      reorder_level: 10,
    });
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = prod => {
    setEditingProduct(prod);
    setFormData({
      sku: prod.sku,
      name: prod.name,
      description: prod.description || '',
      category_id: prod.category_id || '',
      supplier_id: prod.supplier_id || '',
      unit: prod.unit || 'pcs',
      cost_price: prod.cost_price,
      selling_price: prod.selling_price,
      reorder_level: prod.reorder_level,
    });
    setIsAddEditOpen(true);
  };

  const handleSaveProduct = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        cost_price: parseFloat(formData.cost_price),
        selling_price: parseFloat(formData.selling_price),
        reorder_level: parseInt(formData.reorder_level, 10),
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success(`Product '${payload.name}' updated successfully!`);
      } else {
        await api.post('/products', payload);
        toast.success(`Product '${payload.name}' created successfully!`);
      }

      setIsAddEditOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!productToArchive) return;
    setSubmitting(true);
    try {
      const res = await api.delete(`/products/${productToArchive.id}`);
      toast.success(res.data.message);
      setConfirmArchiveOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to archive product');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / 10) || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Products Catalog</h1>
          <p className="text-sm text-slate-500">
            Manage SKU listings, unit costs, selling prices, and reorder alerts.
          </p>
        </div>

        {hasRole('admin', 'manager') && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={categoryId}
            onChange={e => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Stock Status Filter */}
          <select
            value={stockStatus}
            onChange={e => {
              setStockStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            <option value="">All Stock Levels</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock (≤ Reorder)</option>
            <option value="out_of_stock">Out of Stock (0)</option>
          </select>

          {/* Sort Column */}
          <select
            value={`${sort}:${order}`}
            onChange={e => {
              const [s, o] = e.target.value.split(':');
              setSort(s);
              setOrder(o);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            <option value="name:ASC">Name (A-Z)</option>
            <option value="name:DESC">Name (Z-A)</option>
            <option value="total_stock:DESC">Highest Stock</option>
            <option value="total_stock:ASC">Lowest Stock</option>
            <option value="cost_price:DESC">Highest Cost</option>
            <option value="created_at:DESC">Newest Added</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">SKU / Product</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4 text-right">Cost Price</th>
                    <th className="py-3.5 px-4 text-right">Selling Price</th>
                    <th className="py-3.5 px-4 text-center">Available Stock</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/products/${p.id}`}
                          className="font-semibold text-slate-900 group-hover:text-indigo-600 transition"
                        >
                          {p.name}
                        </Link>
                        <div className="text-xs font-mono text-slate-400 mt-0.5">{p.sku}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {p.category_name ? (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-medium text-slate-700">
                            {p.category_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        ${Number(p.cost_price).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                        ${Number(p.selling_price).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-slate-800">{p.total_stock}</span>{' '}
                        <span className="text-xs text-slate-500">{p.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {p.stock_status === 'out_of_stock' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                            Out of Stock
                          </span>
                        ) : p.stock_status === 'low_stock' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                            Low Stock (≤{p.reorder_level})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/products/${p.id}`}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {hasRole('admin', 'manager') && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(p)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                                title="Edit Product"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setProductToArchive(p);
                                  setConfirmArchiveOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Archive Product"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Showing {products.length} of {total} products (Page {page} of {totalPages})
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
            title="No Products Found"
            description="No products match your current search criteria or category filter."
            action={
              hasRole('admin', 'manager') && (
                <button
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Product</span>
                </button>
              )
            }
          />
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                SKU (Unique Identifier) *
              </label>
              <input
                type="text"
                required
                disabled={!!editingProduct}
                value={formData.sku}
                onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder="e.g. SKU-MAC16"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. MacBook Pro 16-inch M3"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Description
            </label>
            <textarea
              rows="2"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Product technical details and specs..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Category
              </label>
              <select
                value={formData.category_id}
                onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Category...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Supplier
              </label>
              <select
                value={formData.supplier_id}
                onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Cost Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.cost_price}
                onChange={e => setFormData({ ...formData, cost_price: e.target.value })}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Selling Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.selling_price}
                onChange={e => setFormData({ ...formData, selling_price: e.target.value })}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Reorder Level *
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.reorder_level}
                onChange={e => setFormData({ ...formData, reorder_level: e.target.value })}
                placeholder="10"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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
              {editingProduct ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialog for Soft Archive */}
      <ConfirmDialog
        isOpen={confirmArchiveOpen}
        onClose={() => setConfirmArchiveOpen(false)}
        onConfirm={handleArchive}
        title="Archive Product"
        message={`Are you sure you want to archive '${productToArchive?.name}' (${productToArchive?.sku})? If movement history exists, the product will be safely preserved in the ledger and archived from active stock ops.`}
        confirmText="Archive Product"
        danger={true}
        loading={submitting}
      />
    </div>
  );
}

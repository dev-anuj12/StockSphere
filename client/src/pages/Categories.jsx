import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Modal } from '../components/Modal.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import {
  Boxes,
  Plus,
  Edit2,
  FolderTree,
  Folder,
  FolderOpen,
  ChevronRight,
  Package,
} from 'lucide-react';

export function Categories() {
  const { hasRole } = useAuth();
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    parent_id: '',
  });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/categories');
      setCategories(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({ name: '', code: '', description: '', parent_id: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = cat => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      code: cat.code,
      description: cat.description || '',
      parent_id: cat.parent_id || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        parent_id: formData.parent_id || null,
      };

      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, payload);
        toast.success(`Category '${payload.name}' updated!`);
      } else {
        await api.post('/categories', payload);
        toast.success(`Category '${payload.name}' created!`);
      }

      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  // Build recursive tree hierarchy
  const buildTree = items => {
    const map = new Map();
    const roots = [];
    items.forEach(item => map.set(item.id, { ...item, children: [] }));
    items.forEach(item => {
      const node = map.get(item.id);
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const categoryTree = buildTree(categories);

  const renderTreeNode = (node, depth = 0) => {
    return (
      <div key={node.id} className="space-y-1">
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition group ${
            depth === 0 ? 'bg-white shadow-sm' : 'bg-slate-50/70 ml-6 border-l-2 border-l-indigo-400'
          }`}
        >
          <div className="flex items-center gap-3">
            {depth === 0 ? (
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <FolderOpen className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1.5 bg-slate-200/70 text-slate-600 rounded-lg">
                <Folder className="w-3.5 h-3.5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-sm">{node.name}</span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                  {node.code}
                </span>
              </div>
              {node.description && (
                <p className="text-xs text-slate-400 mt-0.5">{node.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 px-3 py-1 bg-slate-100 rounded-lg">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span>{node.product_count || 0} Products</span>
            </div>

            {hasRole('admin', 'manager') && (
              <button
                onClick={() => handleOpenEdit(node)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                title="Edit Category"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {node.children && node.children.length > 0 && (
          <div className="space-y-1.5">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Category Hierarchy</h1>
          <p className="text-sm text-slate-500">
            Organize products into hierarchical classification groups.
          </p>
        </div>

        {hasRole('admin', 'manager') && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : categoryTree.length > 0 ? (
        <div className="space-y-2">
          {categoryTree.map(rootNode => renderTreeNode(rootNode, 0))}
        </div>
      ) : (
        <EmptyState
          title="No Categories Configured"
          description="Create your first parent category to structure product inventory."
          icon={FolderTree}
          action={
            hasRole('admin', 'manager') && (
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Category</span>
              </button>
            )
          }
        />
      )}

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Create Category'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Consumer Electronics"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Category Code *
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. CAT-ELEC"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Parent Category (Optional - for subcategories)
            </label>
            <select
              value={formData.parent_id}
              onChange={e => setFormData({ ...formData, parent_id: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">None (Top-Level Parent)</option>
              {categories
                .filter(c => !editingCategory || c.id !== editingCategory.id)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Description
            </label>
            <textarea
              rows="2"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Classification details..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
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
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Modal } from '../components/Modal.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import {
  Users as UsersIcon,
  Plus,
  Shield,
  Warehouse,
  CheckCircle2,
  XCircle,
  Edit2,
  Key,
  Lock,
} from 'lucide-react';

export function Users() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'staff',
    warehouse_ids: [],
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [uRes, wRes] = await Promise.all([
        api.get('/users'),
        api.get('/warehouses'),
      ]);
      setUsers(uRes.data.data);
      setTotal(uRes.data.total);
      setWarehouses(wRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load user directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      full_name: '',
      role: 'staff',
      warehouse_ids: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = u => {
    setEditingUser(u);
    setFormData({
      username: u.username,
      email: u.email,
      password: '',
      full_name: u.full_name,
      role: u.role,
      warehouse_ids: u.warehouses ? u.warehouses.map(w => w.id) : [],
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async u => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/users/${u.id}/status`, { status: newStatus });
      toast.success(`User '${u.username}' is now ${newStatus}!`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        const payload = {
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
          password: formData.password ? formData.password : undefined,
          warehouse_ids: formData.role === 'staff' ? formData.warehouse_ids : [],
        };
        await api.put(`/users/${editingUser.id}`, payload);
        toast.success(`User '${formData.full_name}' updated successfully!`);
      } else {
        await api.post('/users', {
          ...formData,
          warehouse_ids: formData.role === 'staff' ? formData.warehouse_ids : [],
        });
        toast.success(`User '${formData.full_name}' created successfully!`);
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleWarehouseSelection = whId => {
    setFormData(prev => {
      const exists = prev.warehouse_ids.includes(whId);
      return {
        ...prev,
        warehouse_ids: exists
          ? prev.warehouse_ids.filter(id => id !== whId)
          : [...prev.warehouse_ids, whId],
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-indigo-600" />
            <span>User Management & Access Control</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Administer system roles, account statuses, and warehouse assignment boundaries.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} cols={5} />
          </div>
        ) : users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Assigned Warehouses</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{u.full_name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        @{u.username} • {u.email}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : u.role === 'manager'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {u.role === 'staff' ? (
                        u.warehouses && u.warehouses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.warehouses.map(w => (
                              <span key={w.id} className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">
                                {w.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-rose-500 font-medium">No assigned facilities</span>
                        )
                      ) : (
                        <span className="text-indigo-600 font-semibold">Global (All Warehouses)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                        title="Click to toggle account activation status"
                      >
                        {u.status === 'active' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span>Inactive</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Edit User"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No Users Found"
            description="No user records exist."
            icon={UsersIcon}
          />
        )}
      </div>

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `Edit User: ${editingUser.username}` : 'Add New User'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="e.g. Eleanor Vance"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Username *
              </label>
              <input
                type="text"
                required
                disabled={!!editingUser}
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                placeholder="e.g. evance"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="evance@stocksphere.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="staff">Staff (Scoped Warehouse Access)</option>
                <option value="manager">Manager (Stock, Catalog, Reports)</option>
                <option value="admin">Admin (Full Control)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              {editingUser ? 'New Password (Leave blank to keep unchanged)' : 'Initial Password *'}
            </label>
            <input
              type="password"
              required={!editingUser}
              minLength={8}
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              placeholder="Minimum 8 characters"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Assigned Warehouses for Staff */}
          {formData.role === 'staff' && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                Assign Warehouse Facilities (Staff Role Scope)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60 max-h-48 overflow-y-auto">
                {warehouses.map(w => {
                  const checked = formData.warehouse_ids.includes(w.id);
                  return (
                    <label
                      key={w.id}
                      onClick={() => toggleWarehouseSelection(w.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer border transition ${
                        checked ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold' : 'bg-white border-slate-200/60 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{w.name} ({w.code})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

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
              {editingUser ? 'Save User' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';

import { Login } from './pages/Login.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Products } from './pages/Products.jsx';
import { ProductDetail } from './pages/ProductDetail.jsx';
import { Categories } from './pages/Categories.jsx';
import { Warehouses } from './pages/Warehouses.jsx';
import { StockIn } from './pages/StockIn.jsx';
import { StockOut } from './pages/StockOut.jsx';
import { StockTransfer } from './pages/StockTransfer.jsx';
import { StockAdjustment } from './pages/StockAdjustment.jsx';
import { Movements } from './pages/Movements.jsx';
import { Suppliers } from './pages/Suppliers.jsx';
import { Reports } from './pages/Reports.jsx';
import { Users } from './pages/Users.jsx';
import { Settings } from './pages/Settings.jsx';

// Role Guard Wrapper
function ProtectedRoleRoute({ children, allowedRoles }) {
  const { user, loading, hasRole } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !hasRole(...allowedRoles)) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
        <h2 className="text-lg font-bold text-rose-600">Access Restricted (403 Forbidden)</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Your assigned role (<strong>{user.role}</strong>) does not have authorization to view this resource.
        </p>
      </div>
    );
  }

  return children;
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />

              <Route path="dashboard" element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:id" element={<ProductDetail />} />

              <Route
                path="categories"
                element={
                  <ProtectedRoleRoute allowedRoles={['admin', 'manager']}>
                    <Categories />
                  </ProtectedRoleRoute>
                }
              />

              <Route path="warehouses" element={<Warehouses />} />
              <Route path="stock-in" element={<StockIn />} />
              <Route path="stock-out" element={<StockOut />} />

              <Route
                path="stock-transfer"
                element={
                  <ProtectedRoleRoute allowedRoles={['admin', 'manager']}>
                    <StockTransfer />
                  </ProtectedRoleRoute>
                }
              />

              <Route
                path="stock-adjustment"
                element={
                  <ProtectedRoleRoute allowedRoles={['admin', 'manager']}>
                    <StockAdjustment />
                  </ProtectedRoleRoute>
                }
              />

              <Route path="movements" element={<Movements />} />

              <Route
                path="suppliers"
                element={
                  <ProtectedRoleRoute allowedRoles={['admin', 'manager']}>
                    <Suppliers />
                  </ProtectedRoleRoute>
                }
              />

              <Route
                path="reports"
                element={
                  <ProtectedRoleRoute allowedRoles={['admin', 'manager']}>
                    <Reports />
                  </ProtectedRoleRoute>
                }
              />

              <Route
                path="users"
                element={
                  <ProtectedRoleRoute allowedRoles={['admin']}>
                    <Users />
                  </ProtectedRoleRoute>
                }
              />

              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;

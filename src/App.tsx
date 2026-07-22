import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';
import { Register } from './pages/Register';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { Orders } from './pages/Orders';
import { Profile } from './pages/Profile';
import { Favorites } from './pages/Favorites';
import { ContactUs } from './pages/ContactUs';
import { FAQ } from './pages/FAQ';
import { AboutUs } from './pages/AboutUs';
import { Notifications } from './pages/Notifications';
import { NotFound } from './pages/NotFound';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminRoute } from './components/AdminRoute';
import { ToastContainer } from './components/Toast';
import { BrowserGuard } from './components/BrowserGuard';

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts').then(m => ({ default: m.AdminProducts })));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders').then(m => ({ default: m.AdminOrders })));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminBanners = lazy(() => import('./pages/admin/AdminBanners').then(m => ({ default: m.AdminBanners })));
const AdminDelivery = lazy(() => import('./pages/admin/AdminDelivery').then(m => ({ default: m.AdminDelivery })));
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons').then(m => ({ default: m.AdminCoupons })));
const AdminReturns = lazy(() => import('./pages/admin/AdminReturns').then(m => ({ default: m.AdminReturns })));
const AdminAuditLog = lazy(() => import('./pages/admin/AdminAuditLog').then(m => ({ default: m.AdminAuditLog })));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories').then(m => ({ default: m.AdminCategories })));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews').then(m => ({ default: m.AdminReviews })));
const AdminCollections = lazy(() => import('./pages/admin/AdminCollections').then(m => ({ default: m.AdminCollections })));
const AdminProductForm = lazy(() => import('./pages/admin/AdminProductForm').then(m => ({ default: m.AdminProductForm })));
const AdminEngagement = lazy(() => import('./pages/admin/AdminEngagement').then(m => ({ default: m.AdminEngagement })));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages').then(m => ({ default: m.AdminMessages })));

const AdminLoading = () => (
  <div className="min-h-screen bg flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-surface-900 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-text-tertiary font-medium">Loading...</span>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<AdminLoading />}>
          <Routes>
          {/* Public shop routes */}
          <Route path="/" element={<BrowserGuard><Home /></BrowserGuard>} />
          <Route path="/register" element={<BrowserGuard><Register /></BrowserGuard>} />
          <Route path="/catalog" element={<BrowserGuard><Catalog /></BrowserGuard>} />
          <Route path="/product/:slug" element={<BrowserGuard><ProductDetail /></BrowserGuard>} />
          <Route path="/cart" element={<BrowserGuard><Cart /></BrowserGuard>} />
          <Route path="/checkout" element={<BrowserGuard><Checkout /></BrowserGuard>} />
          <Route path="/orders" element={<BrowserGuard><Orders /></BrowserGuard>} />
          <Route path="/profile" element={<BrowserGuard><Profile /></BrowserGuard>} />
          <Route path="/favorites" element={<BrowserGuard><Favorites /></BrowserGuard>} />
          <Route path="/notifications" element={<BrowserGuard><Notifications /></BrowserGuard>} />
          <Route path="/contact" element={<BrowserGuard><ContactUs /></BrowserGuard>} />
          <Route path="/faq" element={<BrowserGuard><FAQ /></BrowserGuard>} />
          <Route path="/about" element={<BrowserGuard><AboutUs /></BrowserGuard>} />

          {/* Admin login — public */}
          <Route path="/nanyy" element={<AdminLogin />} />

          {/* Protected admin routes */}
          <Route
            path="/nanyy/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/products"
            element={
              <AdminRoute requiredRole="seller">
                <AdminProducts />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/products/new"
            element={
              <AdminRoute requiredRole="seller">
                <AdminProductForm />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/products/:id/edit"
            element={
              <AdminRoute requiredRole="seller">
                <AdminProductForm />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/orders"
            element={
              <AdminRoute requiredRole="manager">
                <AdminOrders />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/users"
            element={
              <AdminRoute requiredRole="admin">
                <AdminUsers />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/banners"
            element={
              <AdminRoute requiredRole="manager">
                <AdminBanners />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/categories"
            element={
              <AdminRoute requiredRole="seller">
                <AdminCategories />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/reviews"
            element={
              <AdminRoute requiredRole="manager">
                <AdminReviews />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/collections"
            element={
              <AdminRoute requiredRole="seller">
                <AdminCollections />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/delivery"
            element={
              <AdminRoute requiredRole="manager">
                <AdminDelivery />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/coupons"
            element={
              <AdminRoute requiredRole="manager">
                <AdminCoupons />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/returns"
            element={
              <AdminRoute requiredRole="manager">
                <AdminReturns />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/audit"
            element={
              <AdminRoute requiredRole="admin">
                <AdminAuditLog />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/engagement"
            element={
              <AdminRoute requiredRole="admin">
                <AdminEngagement />
              </AdminRoute>
            }
          />
          <Route
            path="/nanyy/messages"
            element={
              <AdminRoute requiredRole="manager">
                <AdminMessages />
              </AdminRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

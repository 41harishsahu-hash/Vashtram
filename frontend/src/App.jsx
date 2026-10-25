import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { CartProvider } from './context/CartContext';

import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import Toast from './components/common/Toast';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';

// Core Storefront Pages (Direct load for instant First Contentful Paint)
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import CategoriesPage from './pages/CategoriesPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import WhatsAppButton from './components/common/WhatsAppButton';

// Secondary Customer Pages (Code Split)
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const PolicyPage = lazy(() => import('./pages/PolicyPage'));

// Admin Panel (Code Split - Loaded only when accessing Admin)
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminHero = lazy(() => import('./pages/admin/AdminHero'));
const AdminFeatures = lazy(() => import('./pages/admin/AdminFeatures'));
const AdminAbout = lazy(() => import('./pages/admin/AdminAbout'));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminInquiries = lazy(() => import('./pages/admin/AdminInquiries'));

// Minimal elegant loading fallback
const PageLoader = () => (
  <div
    style={{
      minHeight: '50vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--accent-color)',
    }}
  >
    <div
      style={{
        width: '36px',
        height: '36px',
        border: '3px solid var(--border-color)',
        borderTopColor: 'var(--accent-color)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Wrapper to conditionally render standard Navbar, Footer, and Floating WhatsApp outside admin pages
const CustomerLayout = ({ children }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <CartProvider>
              <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Customer Routes */}
                    <Route path="/" element={<CustomerLayout><HomePage /></CustomerLayout>} />
                    <Route path="/shop" element={<CustomerLayout><ShopPage /></CustomerLayout>} />
                    <Route path="/categories" element={<CustomerLayout><CategoriesPage /></CustomerLayout>} />
                    <Route path="/product/:identifier" element={<CustomerLayout><ProductDetailsPage /></CustomerLayout>} />
                    <Route path="/cart" element={<CustomerLayout><CartPage /></CustomerLayout>} />
                    <Route path="/checkout" element={<CustomerLayout><CheckoutPage /></CustomerLayout>} />
                    <Route path="/order/:id" element={<CustomerLayout><OrderSuccessPage /></CustomerLayout>} />
                    <Route
                      path="/orders"
                      element={
                        <ProtectedRoute>
                          <CustomerLayout><OrdersPage /></CustomerLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/account"
                      element={
                        <ProtectedRoute>
                          <CustomerLayout><AccountPage /></CustomerLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/my-account" element={<Navigate to="/account" replace />} />
                    <Route path="/profile" element={<Navigate to="/account" replace />} />
                    <Route path="/account-menu" element={<Navigate to="/account" replace />} />
                    <Route path="/login" element={<CustomerLayout><LoginPage /></CustomerLayout>} />
                    <Route path="/register" element={<CustomerLayout><RegisterPage /></CustomerLayout>} />
                    <Route path="/about" element={<CustomerLayout><AboutPage /></CustomerLayout>} />
                    <Route path="/contact" element={<CustomerLayout><ContactPage /></CustomerLayout>} />
                    <Route path="/privacy-policy" element={<CustomerLayout><PolicyPage type="privacy" /></CustomerLayout>} />
                    <Route path="/terms" element={<CustomerLayout><PolicyPage type="terms" /></CustomerLayout>} />
                    <Route path="/shipping-policy" element={<CustomerLayout><PolicyPage type="shipping" /></CustomerLayout>} />
                    <Route path="/return-policy" element={<CustomerLayout><PolicyPage type="returns" /></CustomerLayout>} />

                    {/* Admin Auth Route */}
                    <Route path="/admin/login" element={<AdminLoginPage />} />

                    {/* Admin Panel Protected Routes */}
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute requireAdmin={true}>
                          <AdminLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<Navigate to="/admin/dashboard" replace />} />
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="products" element={<AdminProducts />} />
                      <Route path="categories" element={<AdminCategories />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="customers" element={<AdminCustomers />} />
                      <Route path="inquiries" element={<AdminInquiries />} />
                      <Route path="hero" element={<AdminHero />} />
                      <Route path="features" element={<AdminFeatures />} />
                      <Route path="why-choose-us" element={<AdminFeatures />} />
                      <Route path="about" element={<AdminAbout />} />
                      <Route path="settings" element={<AdminSettings />} />
                    </Route>

                    {/* Admin Panel Direct URL Aliases */}
                    <Route path="/admin-dashboard" element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="/admin-about" element={<Navigate to="/admin/about" replace />} />
                    <Route path="/admin-panel" element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />

                    {/* 404 Route */}
                    <Route path="*" element={<CustomerLayout><NotFoundPage /></CustomerLayout>} />
                  </Routes>
                </Suspense>
                {/* Toast rendered at the root level for proper layering above all layouts and floating buttons */}
                <Toast />
              </BrowserRouter>
            </CartProvider>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

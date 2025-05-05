import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoadingSpinner from './components/ui/LoadingSpinner';
import Layout from './components/layout/Layout';
import AdminLayout from './components/layout/AdminLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import AdminRoute from './components/auth/AdminRoute';
import NotFound from './pages/NotFound';
import HomePage from './pages/HomePage';
import ErrorBoundary from './components/ui/ErrorBoundary';
import NetworkStatusIndicator from './components/ui/NetworkStatusIndicator';
import Button from './components/ui/Button';
import { RefreshCw } from 'lucide-react';

// Lazy-loaded components
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const EligibilityChecker = lazy(() => import('./pages/eligibility/EligibilityChecker'));
const BNPLChecker = lazy(() => import('./pages/eligibility/BNPLChecker'));
const ApplicationForm = lazy(() => import('./pages/application/ApplicationForm'));
const EnhancedApplicationForm = lazy(() => import('./pages/application/EnhancedApplicationForm'));
const UserDashboard = lazy(() => import('./pages/dashboard/UserDashboard'));
const PaymentHistory = lazy(() => import('./pages/dashboard/PaymentHistory'));
const Documents = lazy(() => import('./pages/dashboard/Documents'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));
const HelpCenter = lazy(() => import('./pages/dashboard/HelpCenter'));
const Notifications = lazy(() => import('./pages/dashboard/Notifications'));
const CreateTicket = lazy(() => import('./pages/dashboard/CreateTicket'));
const ViewTickets = lazy(() => import('./pages/dashboard/ViewTickets'));

// Shop Pages
const ProductCatalog = lazy(() => import('./pages/shop/ProductCatalog'));
const Checkout = lazy(() => import('./pages/shop/Checkout'));

// Static Pages
const AboutUs = lazy(() => import('./pages/AboutUs'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const ApplicationProcessing = lazy(() => import('./pages/admin/ApplicationProcessing'));
const PaymentManagement = lazy(() => import('./pages/admin/PaymentManagement'));
const DocumentManagement = lazy(() => import('./pages/admin/DocumentManagement'));
const PropertyManagement = lazy(() => import('./pages/admin/PropertyManagement'));
const SystemConfiguration = lazy(() => import('./pages/admin/SystemConfiguration'));
const SupportManagement = lazy(() => import('./pages/admin/SupportManagement'));
const ReportingAnalytics = lazy(() => import('./pages/admin/ReportingAnalytics'));
const SecuritySettings = lazy(() => import('./pages/admin/SecuritySettings'));
const NotificationCenter = lazy(() => import('./pages/admin/NotificationCenter'));
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'));
const HelpSupport = lazy(() => import('./pages/admin/HelpSupport'));

function App() {
  const { isInitialized, initError, retryInit } = useAuth();

  // Show a loading spinner while authentication is initializing
  if (!isInitialized) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <LoadingSpinner fullScreen size="lg" />
        <p className="mt-4 text-gray-600">Loading application...</p>
      </div>
    );
  }

  // Show error message if initialization failed
  if (initError) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white">
        <div className="bg-red-50 text-red-700 p-6 rounded-lg max-w-md mx-auto mb-6">
          <h2 className="text-xl font-bold mb-2">Authentication Error</h2>
          <p className="mb-4">{initError}</p>
          <Button 
            onClick={retryInit}
            leftIcon={<RefreshCw size={18} />}
          >
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <>
        <Suspense fallback={<LoadingSpinner fullScreen />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              {/* Public routes */}
              <Route index element={<HomePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="eligibility" element={<EligibilityChecker />} />
              <Route path="bnpl" element={<BNPLChecker />} />
              <Route path="about" element={<AboutUs />} />
              <Route path="contact" element={<ContactUs />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route path="terms" element={<TermsAndConditions />} />
              
              {/* Protected user routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="application" element={<EnhancedApplicationForm />} />
                <Route path="dashboard" element={<UserDashboard />} />
                <Route path="payments" element={<PaymentHistory />} />
                <Route path="documents" element={<Documents />} />
                <Route path="profile" element={<Profile />} />
                <Route path="help" element={<HelpCenter />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="tickets/create" element={<CreateTicket />} />
                <Route path="tickets" element={<ViewTickets />} />
                <Route path="shop" element={<ProductCatalog />} />
                <Route path="checkout" element={<Checkout />} />
              </Route>
            </Route>
              
            {/* Admin routes with separate layout */}
            <Route element={<AdminRoute />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="applications" element={<ApplicationProcessing />} />
                <Route path="payments" element={<PaymentManagement />} />
                <Route path="documents" element={<DocumentManagement />} />
                <Route path="configuration" element={<SystemConfiguration />} />
                <Route path="support" element={<SupportManagement />} />
                <Route path="analytics" element={<ReportingAnalytics />} />
                <Route path="properties" element={<PropertyManagement />} />
                <Route path="security" element={<SecuritySettings />} />
                <Route path="notifications" element={<NotificationCenter />} />
                <Route path="settings" element={<SystemSettings />} />
                <Route path="help" element={<HelpSupport />} />
              </Route>
            </Route>

            {/* 404 route - must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>

        <NetworkStatusIndicator />

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              style: {
                background: '#059669',
                color: '#fff',
              },
            },
            error: {
              duration: 4000,
              style: {
                background: '#DC2626',
                color: '#fff',
              },
            },
          }}
        />
      </>
    </ErrorBoundary>
  );
}

export default App;
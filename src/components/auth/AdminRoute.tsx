import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorBoundary from '../ui/ErrorBoundary';
import ConnectionErrorFallback from '../ui/ConnectionErrorFallback';
import Button from '../ui/Button';
import { RefreshCw } from 'lucide-react';

const AdminRoute = () => {
  const { isAuthenticated, isAdmin, isInitialized, initError, retryInit } = useAuth();
  
  console.log('AdminRoute - isAuthenticated:', isAuthenticated); // Added debug log
  console.log('AdminRoute - isAdmin:', isAdmin); // Added debug log
  console.log('AdminRoute - isInitialized:', isInitialized); // Added debug log
  
  if (!isInitialized) {
    return <LoadingSpinner fullScreen message="Checking authentication status..." />;
  }
  
  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 text-red-700 p-6 rounded-lg max-w-md mx-auto">
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
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" />;
  }
  
  return (
    <ErrorBoundary fallback={<ConnectionErrorFallback />}>
      <Outlet />
    </ErrorBoundary>
  );
};

export default AdminRoute;
import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Button from './Button';
import { Link } from 'react-router-dom';

interface ConnectionErrorFallbackProps {
  error?: Error;
  resetErrorBoundary?: () => void;
}

const ConnectionErrorFallback = ({ error, resetErrorBoundary }: ConnectionErrorFallbackProps) => {
  const handleRefresh = () => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
    } else {
      window.location.reload();
    }
  };

  // Determine the appropriate error message based on the error type
  const getErrorMessage = () => {
    if (!error) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }

    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return 'Connection timed out. The server is taking too long to respond. Please try again later.';
    }

    if (error.message.includes('internet') || error.message.includes('offline') || error.message.includes('network')) {
      return 'No internet connection detected. Please check your network settings and try again.';
    }

    if (error.message.includes('Authentication') || error.message.includes('log in')) {
      return 'Your session has expired. Please log in again to continue.';
    }

    return error.message || 'Unable to connect to the server. Please check your internet connection and try again.';
  };

  // Determine if this is an authentication error
  const isAuthError = error?.message?.includes('Authentication') || error?.message?.includes('log in');

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 max-w-lg mx-auto">
        <div className="flex">
          <div className="flex-shrink-0">
            <WifiOff className="h-6 w-6 text-red-500" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-red-800">
              {isAuthError ? 'Authentication Error' : 'Connection Error'}
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{getErrorMessage()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-4">
        {isAuthError ? (
          <Link to="/login">
            <Button>
              Go to Login
            </Button>
          </Link>
        ) : (
          <Button
            onClick={handleRefresh}
            leftIcon={<RefreshCw size={18} />}
          >
            Retry Connection
          </Button>
        )}
        <Link to="/">
          <Button
            variant="outline"
            leftIcon={<Home size={18} />}
          >
            Go to Home
          </Button>
        </Link>
      </div>

      <div className="mt-8 text-sm text-gray-600 max-w-md">
        <p>If the problem persists, please try the following:</p>
        <ul className="list-disc list-inside mt-2 text-left">
          <li>Check your internet connection</li>
          <li>Clear your browser cache</li>
          <li>Try again later</li>
          <li>Contact support if the issue continues</li>
        </ul>
      </div>
    </div>
  );
};

export default ConnectionErrorFallback;
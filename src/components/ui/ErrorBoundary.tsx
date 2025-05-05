import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Button from './Button';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to an error reporting service
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleRefresh = (): void => {
    // Reload the current page
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 py-12">
          <div className="text-center">
            <h1 className="text-9xl font-bold text-primary-600">Oops!</h1>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">Something went wrong</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-md mx-auto">
              We encountered an error while processing your request. Please try refreshing the page.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                onClick={this.handleRefresh}
                leftIcon={<RefreshCw size={18} />}
              >
                Refresh Page
              </Button>
              <Link to="/">
                <Button 
                  variant="outline" 
                  leftIcon={<Home size={18} />}
                >
                  Go to Home
                </Button>
              </Link>
            </div>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details className="mt-6 text-left bg-gray-50 p-4 rounded-lg max-w-2xl mx-auto">
              <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                Error Details (Development Only)
              </summary>
              <pre className="whitespace-pre-wrap text-xs text-gray-600 overflow-auto max-h-[300px] p-2 bg-gray-100 rounded">
                {this.state.error?.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
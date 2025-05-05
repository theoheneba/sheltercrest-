import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { checkDatabaseConnectivity } from '../services/db';
import { toast } from 'react-hot-toast';

export type ApplicationStatus = 'pending' | 'in-review' | 'approved' | 'rejected';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000;
const REQUEST_TIMEOUT = 15000; // 15 seconds timeout

export const useApplicationStatus = () => {
  const [status, setStatus] = useState<ApplicationStatus>('pending');
  const [applicationData, setApplicationData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { applications, fetchApplications, checkAuth } = useUserStore();

  useEffect(() => {
    let mounted = true;
    let authCheckTimer: number | null = null;
    let abortController: AbortController | null = null;

    const fetchWithRetry = async (retryCount = 0): Promise<void> => {
      // Create a new AbortController for each attempt
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();
      
      const timeoutId = setTimeout(() => {
        if (abortController) {
          console.log('Request timed out, aborting');
          abortController.abort();
        }
      }, REQUEST_TIMEOUT);

      try {
        console.log(`Attempting to fetch application status (attempt ${retryCount + 1}/${MAX_RETRIES})`);

        // Check authentication status first
        console.log('Checking authentication status...');
        const isAuthenticated = await checkAuth();
        
        if (!isAuthenticated) {
          console.log('User not authenticated, skipping application status fetch');
          if (mounted) {
            setStatus('pending');
            setApplicationData(null);
            setLoading(false);
          }
          clearTimeout(timeoutId);
          return;
        }

        // Check database connectivity with improved error handling
        try {
          const isDatabaseConnected = await checkDatabaseConnectivity();
          if (!isDatabaseConnected) {
            throw new Error('Database connection failed. Please try again later.');
          }
        } catch (dbError: any) {
          clearTimeout(timeoutId);
          
          // Handle specific database connectivity errors
          if (dbError.message.includes('Authentication error')) {
            throw new Error('Authentication error. Please log in again.');
          }
          
          // For other errors, allow retry if appropriate
          const shouldRetry = (
            retryCount < MAX_RETRIES && 
            navigator.onLine &&
            !dbError.message.includes('Authentication error')
          );
          
          if (shouldRetry) {
            const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
            console.log(`Database connection failed, retrying in ${retryDelay}ms...`);
            await delay(retryDelay);
            return fetchWithRetry(retryCount + 1);
          }
          
          throw dbError;
        }

        console.log('User is authenticated and database is connected, fetching applications...');
        await fetchApplications();
        
        clearTimeout(timeoutId);
        
        if (!mounted) {
          console.log('Component unmounted, aborting');
          return;
        }
        
        if (applications.length > 0) {
          const latestApplication = applications[0];
          setStatus(latestApplication.status as ApplicationStatus);
          setApplicationData(latestApplication);
        } else {
          setStatus('pending');
          setApplicationData(null);
        }
        
        setLoading(false);
        setError(null);
      } catch (err: any) {
        clearTimeout(timeoutId);
        
        console.error(`Attempt ${retryCount + 1} failed:`, err);

        let shouldRetry = retryCount < MAX_RETRIES;
        let errorMessage = err.message || 'An unknown error occurred';

        // Handle specific error types
        if (err.name === 'AbortError' || errorMessage.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        } else if (errorMessage.includes('No internet')) {
          errorMessage = 'No internet connection available';
          shouldRetry = false;
        } else if (errorMessage.includes('Authentication error')) {
          errorMessage = 'You need to log in to access this feature.';
          shouldRetry = false;
        } else if (errorMessage.includes('Database connection failed')) {
          errorMessage = 'Database connection failed. Please try again later.';
        }

        if (shouldRetry && mounted && navigator.onLine) {
          const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`Retrying in ${retryDelay}ms...`);
          await delay(retryDelay);
          return fetchWithRetry(retryCount + 1);
        }

        if (mounted) {
          setError(new Error(errorMessage));
          setLoading(false);
          
          // Only show toast for non-network errors or when online
          if (navigator.onLine && !errorMessage.includes('No internet')) {
            toast.error(errorMessage);
          }
        }
      }
    };

    const fetchApplicationStatus = async () => {
      if (!mounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        await fetchWithRetry();
      } catch (err: any) {
        console.error('Error fetching application status:', err);
        
        if (mounted) {
          setError(err);
          setLoading(false);
          
          // Only show toast for non-network errors or when online
          if (navigator.onLine && !err.message.includes('No internet')) {
            toast.error(err.message);
          }
        }
      }
    };

    // If we have applications already, use them immediately
    if (applications.length > 0) {
      const latestApplication = applications[0];
      setStatus(latestApplication.status as ApplicationStatus);
      setApplicationData(latestApplication);
      setLoading(false);
    } else {
      // Otherwise, check auth and fetch applications
      authCheckTimer = window.setTimeout(() => {
        fetchApplicationStatus();
      }, 1000);
    }

    // Add event listeners for online/offline status
    const handleOnline = () => {
      console.log('Network connection restored');
      if (error) {
        console.log('Retrying fetch due to network restoration');
        fetchApplicationStatus();
      }
    };

    const handleOffline = () => {
      console.log('Network connection lost');
      if (mounted) {
        setError(new Error('Network connection lost. Please check your internet connection.'));
        toast.error('Network connection lost. Please check your internet connection.');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      
      if (authCheckTimer) {
        clearTimeout(authCheckTimer);
      }
      
      if (abortController) {
        abortController.abort('component unmounted');
      }
      
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchApplications, applications, checkAuth]);

  return {
    status,
    applicationData,
    loading,
    error,
  };
};
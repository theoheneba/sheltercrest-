import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { toast } from 'react-hot-toast';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Configuration constants
const DB_TIMEOUT = 15000; // 15 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    url: supabaseUrl ? 'defined' : 'missing',
    key: supabaseAnonKey ? 'defined' : 'missing'
  });
  throw new Error('Missing Supabase environment variables');
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Create Supabase client with enhanced configuration
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: window.localStorage,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey
    },
    fetch: async (url, options = {}) => {
      // Check network connectivity first
      if (!navigator.onLine) {
        throw new Error('No internet connection available');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DB_TIMEOUT);

      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'apikey': supabaseAnonKey,
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Check for refresh token errors
          if (response.status === 400) {
            const responseText = await response.clone().text();
            if (responseText.includes('refresh_token_not_found') || 
                responseText.includes('Invalid Refresh Token')) {
              console.error('Refresh token error detected:', responseText);
              
              // Clear auth data from localStorage
              localStorage.removeItem('supabase.auth.token');
              localStorage.removeItem('sb-refresh-token');
              localStorage.removeItem('sb-access-token');
              localStorage.removeItem('supabase.auth.expires_at');
              localStorage.removeItem('supabase.auth.provider_token');
              
              // Force sign out
              try {
                await supabase.auth.signOut();
              } catch (signOutError) {
                console.error('Error during forced sign out:', signOutError);
              }
              
              // Show error message
              toast.error('Your session has expired. Please log in again.');
              
              // Redirect to login page
              window.location.href = '/login';
              
              throw new Error('Session expired. Please log in again.');
            }
          }
          
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.');
        }
        
        throw error;
      }
    }
  }
});

export const db = {
  execute: async ({ sql, args = [] }: { sql: string; args?: any[] }) => {
    if (!navigator.onLine) {
      throw new Error('No internet connection available');
    }
    
    const { data, error } = await supabase.rpc('execute_sql', { sql, args });
    if (error) throw error;
    return { rows: data || [] };
  }
};

// Enhanced database connectivity check with retry mechanism
export const checkDatabaseConnectivity = async (
  retries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY
): Promise<boolean> => {
  const attemptConnection = async (attempt: number): Promise<boolean> => {
    try {
      console.log(`Checking database connectivity (attempt ${attempt + 1}/${retries + 1})...`);
      
      // Check network connectivity first
      if (!navigator.onLine) {
        console.log('Network is offline');
        throw new Error('No internet connection available');
      }

      // Create a promise that will reject after the timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), DB_TIMEOUT);
      });

      // Race between the database check and the timeout
      const result = await Promise.race([
        supabase
          .from('profiles')
          .select('count')
          .limit(1)
          .single(),
        timeoutPromise
      ]);

      if ('error' in result && result.error) {
        // Handle specific error cases
        if (result.error.message?.includes('JWT')) {
          throw new Error('Authentication error. Please log in again.');
        }
        throw new Error('Database connection failed');
      }

      console.log('Database connectivity check passed');
      return true;
    } catch (error: any) {
      console.error(`Database connectivity check failed (attempt ${attempt + 1}):`, error);

      // Determine if we should retry based on the error type
      const shouldRetry = (
        attempt < retries && 
        navigator.onLine && 
        !error.message?.includes('Authentication error')
      );

      if (shouldRetry) {
        const retryDelay = initialDelay * Math.pow(2, attempt);
        console.log(`Retrying in ${retryDelay}ms...`);
        await delay(retryDelay);
        return attemptConnection(attempt + 1);
      }

      // Determine appropriate error message
      let errorMessage = 'Failed to connect to database';
      
      if (error.message?.includes('No internet')) {
        errorMessage = 'No internet connection available';
      } else if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        errorMessage = 'Database connection timeout. Please try again later.';
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('Unable to connect')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message?.includes('Authentication error')) {
        errorMessage = 'Authentication error. Please log in again.';
      }

      throw new Error(errorMessage);
    }
  };

  try {
    return await attemptConnection(0);
  } catch (error: any) {
    console.error('Database connectivity check failed after all retries:', error);
    
    // Don't show toast for network errors when offline
    if (navigator.onLine) {
      toast.error(error.message);
    }
    
    return false;
  }
};

export const handleDbError = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    console.error('Database error:', error);
    
    if (error.code === '23505') {
      throw new Error('A record with this information already exists');
    }
    
    if (error.code === '23503') {
      throw new Error('Referenced record does not exist');
    }
    
    if (error.code === '42501') {
      throw new Error('Permission denied: You do not have the required permissions for this operation');
    }
    
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    
    throw new Error(error.message || 'An unexpected database error occurred');
  }
};

// Function to subscribe to real-time changes
export const subscribeToChanges = (
  table: string,
  callback: (payload: any) => void
): (() => void) => {
  const subscription = supabase
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      callback
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to ${table} changes`);
      }
      if (status === 'CHANNEL_ERROR') {
        console.error(`Failed to subscribe to ${table} changes`);
        toast.error(`Failed to subscribe to real-time updates for ${table}`);
      }
    });

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
};

// Function to ensure storage bucket exists
export const ensureStorageBucket = async (bucketName: string): Promise<boolean> => {
  const MAX_RETRIES = 3;
  const INITIAL_RETRY_DELAY = 2000;
  
  const attemptOperation = async (retryCount: number = 0): Promise<boolean> => {
    try {
      console.log(`Checking if storage bucket '${bucketName}' exists (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      
      // First check if we're online
      if (!navigator.onLine) {
        console.log('Network is offline, cannot check bucket');
        throw new Error('No internet connection. Please check your network and try again.');
      }
      
      // Check if bucket exists first
      const { data: buckets, error: listError } = await supabase.storage
        .listBuckets();
        
      if (listError) {
        console.error(`Error listing buckets: ${listError.message}`);
        throw listError;
      }
      
      console.log('Available buckets:', buckets?.map(b => b.name));
      
      const bucket = buckets.find(b => b.name === bucketName);
      
      if (bucket) {
        console.log(`Bucket '${bucketName}' exists`);
        return true;
      }
      
      console.log(`Bucket '${bucketName}' does not exist, creating it...`);
      
      // If bucket doesn't exist, create it directly
      try {
        const { data, error } = await supabase.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ]
        });
        
        if (error) {
          console.error(`Error creating bucket directly: ${error.message}`);
          throw error;
        }
        
        console.log(`Bucket '${bucketName}' created successfully`);
        return true;
      } catch (directError: any) {
        console.error(`Direct bucket creation failed: ${directError.message}`);
        
        // Fall back to using Edge Function if direct creation fails
        console.log(`Falling back to Edge Function for bucket creation...`);
        const response = await fetch(`${supabaseUrl}/functions/v1/create-storage-bucket`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bucketName,
            isPublic: false,
            createPolicies: true
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Edge Function returned status ${response.status}: ${errorText}`);
          throw new Error(`Failed to create bucket via Edge Function: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to create bucket');
        }
        
        console.log(`Bucket '${bucketName}' ${result.exists ? 'already exists' : 'created successfully'} via Edge Function`);
        return true;
      }
    } catch (error: any) {
      console.error(`Attempt ${retryCount + 1} failed:`, error);
      
      if (retryCount < MAX_RETRIES - 1) {
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`Retrying in ${retryDelay}ms...`);
        await delay(retryDelay);
        return attemptOperation(retryCount + 1);
      }
      
      throw error;
    }
  };

  try {
    return await attemptOperation();
  } catch (error: any) {
    console.error(`Failed to ensure bucket exists after ${MAX_RETRIES} attempts:`, error);
    
    // Don't show toast for network errors when offline
    if (!navigator.onLine) {
      console.log('Network is offline, suppressing error toast');
      return false;
    }
    
    let errorMessage = `Failed to set up storage: ${error.message}`;
    
    // Customize error message based on error type
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      errorMessage = 'Network error. Please check your internet connection and try again.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Connection timeout. Please try again later.';
    } else if (error.message?.includes('Permission denied')) {
      errorMessage = 'Permission denied. You do not have access to create storage buckets.';
    } else if (error.message?.includes('JWT')) {
      errorMessage = 'Authentication error. Please log in again.';
    }
    
    toast.error(errorMessage);
    return false;
  }
};

// Function to set up storage bucket policies
export const setupBucketPolicies = async (bucketName: string): Promise<void> => {
  try {
    console.log(`Setting up policies for bucket '${bucketName}'...`);
    
    // First check if we're online
    if (!navigator.onLine) {
      console.log('Network is offline, cannot set up policies');
      throw new Error('No internet connection. Please check your network and try again.');
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/create-storage-bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketName,
        isPublic: false,
        createPolicies: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Edge Function returned status ${response.status}: ${errorText}`);
      throw new Error(`Failed to set up policies: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to set up policies');
    }
    
    console.log(`Policies for bucket '${bucketName}' set up successfully`);
  } catch (error: any) {
    console.error(`Error setting up policies for bucket '${bucketName}':`, error);
    
    // Don't show toast for network errors when offline
    if (!navigator.onLine) {
      console.log('Network is offline, suppressing error toast');
      return;
    }
    
    let errorMessage = `Failed to set up storage policies: ${error.message}`;
    
    // Customize error message based on error type
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      errorMessage = 'Network error. Please check your internet connection and try again.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Connection timeout. Please try again later.';
    }
    
    toast.error(errorMessage);
  }
};

// Function to create a bucket directly in the database
export const createBucketDirectly = async (bucketName: string): Promise<boolean> => {
  try {
    console.log(`Creating bucket '${bucketName}' directly...`);
    
    // First check if we're online
    if (!navigator.onLine) {
      console.log('Network is offline, cannot create bucket');
      throw new Error('No internet connection. Please check your network and try again.');
    }
    
    // Check if bucket exists first
    const { data: buckets, error: listError } = await supabase.storage
      .listBuckets();
      
    if (listError) {
      console.error(`Error listing buckets: ${listError.message}`);
      throw listError;
    }
    
    const bucket = buckets.find(b => b.name === bucketName);
    
    if (bucket) {
      console.log(`Bucket '${bucketName}' already exists`);
      return true;
    }
    
    // Create the bucket
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    });
    
    if (error) {
      console.error(`Error creating bucket directly: ${error.message}`);
      
      // Try to use RPC function as a fallback
      try {
        const { error: rpcError } = await supabase.rpc('create_user_documents_bucket');
        
        if (rpcError) {
          console.error(`Error creating bucket via RPC: ${rpcError.message}`);
          throw rpcError;
        }
        
        console.log(`Bucket '${bucketName}' created successfully via RPC`);
        return true;
      } catch (rpcError) {
        console.error(`RPC bucket creation failed: ${rpcError}`);
        throw error; // Throw the original error
      }
    }
    
    console.log(`Bucket '${bucketName}' created successfully`);
    
    // Set up policies for the bucket
    await setupBucketPolicies(bucketName);
    
    return true;
  } catch (error: any) {
    console.error(`Error creating bucket directly: ${error.message}`);
    return false;
  }
};

// Function to check if a bucket exists
export const checkBucketExists = async (bucketName: string): Promise<boolean> => {
  try {
    console.log(`Checking if bucket '${bucketName}' exists...`);
    
    // First check if we're online
    if (!navigator.onLine) {
      console.log('Network is offline, cannot check bucket');
      return false;
    }
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage
      .listBuckets();
      
    if (listError) {
      console.error(`Error listing buckets: ${listError.message}`);
      return false;
    }
    
    const bucket = buckets.find(b => b.name === bucketName);
    
    if (bucket) {
      console.log(`Bucket '${bucketName}' exists`);
      return true;
    }
    
    console.log(`Bucket '${bucketName}' does not exist`);
    return false;
  } catch (error: any) {
    console.error(`Error checking if bucket exists: ${error.message}`);
    return false;
  }
};

// Function to test bucket permissions
export const testBucketPermissions = async (bucketName: string): Promise<boolean> => {
  try {
    console.log(`Testing permissions for bucket '${bucketName}'...`);
    
    // First check if we're online
    if (!navigator.onLine) {
      console.log('Network is offline, cannot test permissions');
      return false;
    }
    
    // Try to list files in the bucket
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list();
      
    if (error) {
      console.error(`Error testing bucket permissions: ${error.message}`);
      return false;
    }
    
    console.log(`Successfully listed files in bucket '${bucketName}'`);
    return true;
  } catch (error: any) {
    console.error(`Error testing bucket permissions: ${error.message}`);
    return false;
  }
};
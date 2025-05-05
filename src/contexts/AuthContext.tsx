import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/db';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'superadmin';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isInitialized: boolean;
  initError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  retryInit: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  employmentStatus?: string;
  employerName?: string;
  monthlyIncome?: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const navigate = useNavigate();

  const retryInit = () => {
    console.log('Retrying authentication initialization...');
    setIsInitialized(false);
    setInitError(null);
    initAuth();
  };

  const initAuth = async () => {
    try {
      console.log('Initializing authentication context');
      setInitError(null);
      
      // First check if there's a session
      console.log('Checking for active session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error during initialization:', sessionError);
        setInitError('Failed to check authentication session: ' + sessionError.message);
        setUser(null);
        setIsInitialized(true);
        return;
      }
      
      if (!session) {
        console.log('No active session found');
        setUser(null);
        setIsInitialized(true);
        return;
      }
      
      console.log('Active session found, fetching user data');
      
      // Get the user from the session
      if (session.user) {
        try {
          console.log('Fetching profile data for user ID:', session.user.id);
          // Fetch the user's profile data directly from the profiles table
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (profileError) {
            console.error('Error fetching profile during initialization:', profileError);
            setInitError('Failed to fetch user profile: ' + profileError.message);
            setUser(null);
            setIsInitialized(true);
            return;
          }
          
          if (profile) {
            console.log('Profile data fetched successfully:', profile);
            console.log('Profile Role:', profile.role); // Log the role specifically
            
            // Set the user state with the profile data
            setUser({
              id: profile.id,
              email: profile.email,
              firstName: profile.first_name,
              lastName: profile.last_name,
              role: profile.role
            });
          } else {
            console.log('No profile found for user');
            setInitError('User profile not found. Please contact support.');
            setUser(null);
          }
        } catch (error) {
          console.error('Error fetching profile data:', error);
          setInitError('Failed to fetch user data: ' + (error instanceof Error ? error.message : String(error)));
          setUser(null);
        }
      }
    } catch (error: any) {
      // Token invalid or expired
      console.error('Error during auth initialization:', error);
      
      // Handle refresh token errors
      if (error.message?.includes('refresh_token_not_found') || 
          error.message?.includes('Invalid Refresh Token')) {
        console.log('Invalid refresh token detected, logging out');
        
        // Clear any stored auth data and log out
        await authService.logout();
        setUser(null);
        setInitError('Your session has expired. Please log in again.');
        
        // Show a toast notification
        toast.error('Your session has expired. Please log in again.');
        
        // Redirect to login page
        navigate('/login', { replace: true });
      } else {
        setUser(null);
        setInitError('Authentication error: ' + error.message);
      }
    } finally {
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    initAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change event:', event);
      
      if (event === 'SIGNED_IN' && session) {
        // User signed in, update the user state
        try {
          console.log('User signed in, fetching profile data');
          
          if (!session.user || !session.user.id) {
            console.error('Session user is undefined or missing ID');
            setUser(null);
            return;
          }
          
          // Fetch the user's profile data directly from the profiles table
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (profileError) {
            console.error('Error fetching profile after sign in:', profileError);
            throw profileError;
          }
          
          if (profile) {
            console.log('Profile data fetched successfully after sign in:', profile);
            console.log('Profile Role:', profile.role); // Log the role specifically
            
            // Set the user state with the profile data
            setUser({
              id: profile.id,
              email: profile.email,
              firstName: profile.first_name,
              lastName: profile.last_name,
              role: profile.role
            });
          } else {
            console.log('No profile found for user after sign in');
            setUser(null);
          }
        } catch (error) {
          console.error('Error fetching profile after sign in:', error);
          setUser(null);
        }
      } else if (event === 'SIGNED_OUT') {
        // User signed out, clear the user state
        console.log('User signed out, clearing state');
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED') {
        // Token refreshed successfully, no need to do anything
        console.log('Token refreshed successfully');
      } else if (event === 'USER_UPDATED') {
        // User updated, refresh the user state
        console.log('User updated, refreshing state');
        try {
          if (!session?.user?.id) {
            console.error('Session user is undefined or missing ID during USER_UPDATED');
            return;
          }
          
          // Fetch the user's profile data directly from the profiles table
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (profileError) {
            console.error('Error fetching profile after user update:', profileError);
            throw profileError;
          }
          
          if (profile) {
            console.log('Profile data fetched successfully after user update:', profile);
            console.log('Profile Role:', profile.role); // Log the role specifically
            
            // Set the user state with the profile data
            setUser({
              id: profile.id,
              email: profile.email,
              firstName: profile.first_name,
              lastName: profile.last_name,
              role: profile.role
            });
          }
        } catch (error) {
          console.error('Error fetching profile after user update:', error);
        }
      } else if (event === 'TOKEN_REFRESH_FAILED') {
        // Token refresh failed, log out the user
        console.log('Token refresh failed, logging out');
        authService.logout();
        setUser(null);
        setInitError('Your session has expired. Please log in again.');
        toast.error('Your session has expired. Please log in again.');
        navigate('/login', { replace: true });
      }
    });

    // Clean up the subscription when the component unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const login = async (email: string, password: string) => {
    try {
      console.log('AuthContext: Login attempt for', email);
      const userData = await authService.login(email, password);
      console.log('AuthContext: Login successful, user data:', userData);
      
      // Check if userData has a valid ID before proceeding
      if (!userData || !userData.id) {
        console.error('Invalid user data returned from login:', userData);
        throw new Error('Invalid user data returned from login');
      }
      
      // After successful login, fetch the complete profile data
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userData.id)
          .single();
          
        if (profileError) {
          console.error('Error fetching complete profile after login:', profileError);
          // Continue with the basic user data
          setUser(userData);
          return;
        }
        
        if (profile) {
          console.log('Complete profile data fetched after login:', profile);
          console.log('Profile Role:', profile.role); // Log the role specifically
          
          // Update the user state with the complete profile data
          setUser({
            id: profile.id,
            email: profile.email,
            firstName: profile.first_name,
            lastName: profile.last_name,
            role: profile.role
          });
        } else {
          // Fall back to the basic user data
          console.log('No profile found, using basic user data');
          setUser(userData);
        }
      } catch (error) {
        console.error('Error fetching complete profile after login:', error);
        // Fall back to the basic user data
        setUser(userData);
      }
    } catch (error) {
      console.error('AuthContext: Login error:', error);
      throw error;
    }
  };

  const register = async (userData: RegisterData) => {
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any;

    while (retryCount < maxRetries) {
      try {
        console.log('AuthContext: Registration attempt', retryCount + 1);
        // Register the user but don't attempt to login automatically
        await authService.register(userData);
        
        // Instead of auto-login, just return success
        console.log('AuthContext: Registration successful');
        return;
      } catch (error: any) {
        lastError = error;
        console.error(`AuthContext: Registration attempt ${retryCount + 1} failed:`, error);
        
        // Check if it's a rate limit error
        if (error.message?.includes('over_email_send_rate_limit')) {
          // Extract wait time from error message or use default 10 seconds
          const waitTime = 10 * 1000 * Math.pow(2, retryCount); // Exponential backoff
          console.log(`Rate limit hit, waiting ${waitTime/1000} seconds before retry`);
          await sleep(waitTime);
          retryCount++;
        } else if (error.message?.includes('row-level security policy')) {
          // RLS policy error - don't retry
          throw new Error('Unable to create user profile. Please contact support.');
        } else {
          // For other errors, don't retry
          throw error;
        }
      }
    }

    // If we've exhausted all retries
    console.error('AuthContext: All registration attempts failed');
    throw lastError;
  };

  const logout = () => {
    console.log('AuthContext: Logout initiated');
    authService.logout();
    setUser(null);
    // Redirect to login page after logout
    navigate('/login', { replace: true });
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
    isInitialized,
    initError,
    login,
    register,
    logout,
    retryInit
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
import { toast } from 'react-hot-toast';
import { supabase } from './db';
import { smsService } from './smsService';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'superadmin';
}

export interface RegisterData {
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

const clearAuthData = () => {
  console.log('Clearing all auth data');
  localStorage.removeItem('supabase.auth.token');
  localStorage.removeItem('sb-refresh-token');
  localStorage.removeItem('sb-access-token');
  // Clear any other auth-related data that might be stored
  localStorage.removeItem('supabase.auth.expires_at');
  localStorage.removeItem('supabase.auth.provider_token');
};

export const authService = {
  async login(email: string, password: string): Promise<AuthUser> {
    try {
      console.log('Attempting login for:', email);
      
      // Validate environment variables
      if (!import.meta.env.VITE_SUPABASE_URL) {
        console.error('Missing VITE_SUPABASE_URL environment variable');
        throw new Error('The authentication service is not properly configured. Please contact support.');
      }
      
      if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.error('Missing VITE_SUPABASE_ANON_KEY environment variable');
        throw new Error('The authentication service is not properly configured. Please contact support.');
      }

      // Test Supabase connection with timeout
      try {
        console.log('Testing Supabase connection...');
        
        const timeout = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Connection timeout. Please check your internet connection and try again.'));
          }, 5000); // 5 second timeout
        });

        const healthCheck = supabase.from('profiles').select('count').limit(1);
        
        const { error: healthCheckError } = await Promise.race([
          healthCheck,
          timeout
        ]);
        
        if (healthCheckError) {
          console.error('Health check failed:', healthCheckError);
          if (healthCheckError.message.includes('FetchError') || healthCheckError.message.includes('Failed to fetch')) {
            throw new Error('Unable to connect to the authentication service. Please check your internet connection.');
          }
          if (healthCheckError.message.includes('CORS')) {
            throw new Error('Unable to connect to the authentication service due to security restrictions. Please try again later.');
          }
          throw healthCheckError;
        }
        console.log('Health check passed');
      } catch (healthCheckError: any) {
        console.error('Health check failed with exception:', healthCheckError);
        
        if (healthCheckError.message.includes('timeout')) {
          throw new Error('Connection timeout. Please check your internet connection and try again.');
        }
        if (healthCheckError.message.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
        if (healthCheckError.message.includes('CORS')) {
          throw new Error('Unable to connect to the authentication service due to security restrictions. Please try again later.');
        }
        throw healthCheckError;
      }
      
      // Clear any existing auth data before attempting new login
      clearAuthData();
      
      // Attempt to sign in with retry logic
      const maxRetries = 2;
      let lastError = null;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Login attempt ${attempt + 1} of ${maxRetries + 1}`);
          
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (signInError) {
            console.error('Sign in error:', signInError);
            
            if (signInError.message?.includes('Email not confirmed') || signInError.message?.includes('check your inbox')) {
              // Try to auto-confirm the email
              try {
                console.log('Attempting to auto-confirm email...');
                const { data: confirmData, error: confirmError } = await supabase.functions.invoke('auto-confirm-email', {
                  body: { email },
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
                
                if (confirmError) {
                  console.error('Error auto-confirming email:', confirmError);
                  throw new Error('Please check your email inbox and confirm your email before logging in.');
                }
                
                if (confirmData && confirmData.success) {
                  console.log('Email auto-confirmed successfully, retrying login...');
                  // Retry login after confirming email
                  const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                  });
                  
                  if (retryError) {
                    console.error('Retry login error after email confirmation:', retryError);
                    throw retryError;
                  }
                  
                  if (!retryData.user) {
                    throw new Error('Login failed after email confirmation. Please try again.');
                  }
                  
                  // Use the data from the retry
                  data.user = retryData.user;
                  data.session = retryData.session;
                } else {
                  throw new Error('Please check your email inbox and confirm your email before logging in.');
                }
              } catch (confirmError: any) {
                console.error('Email confirmation error:', confirmError);
                throw new Error('Please check your email inbox and confirm your email before logging in.');
              }
            } else if (signInError.message.includes('Invalid login credentials')) {
              throw new Error('Invalid email or password. Please check your credentials and try again.');
            } else {
              throw signInError;
            }
          }

          if (!data.user) {
            throw new Error('No user returned from login attempt. Please try again.');
          }

          console.log('User authenticated successfully, fetching profile...');
          
          // Get user profile with timeout
          const profilePromise = supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
            
          const profileTimeout = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Profile fetch timeout. Please try again.'));
            }, 5000);
          });

          const { data: profile, error: profileError } = await Promise.race([
            profilePromise,
            profileTimeout
          ]);

          if (profileError) {
            console.error('Profile fetch error:', profileError);
            throw new Error('Unable to fetch user profile. Please try again.');
          }

          if (!profile) {
            console.error('No profile data returned for user ID:', data.user.id);
            throw new Error('User profile not found. Please contact support.');
          }

          console.log('Profile data fetched:', profile);

          // Validate the profile data has all required fields
          if (!profile.id || !profile.email || !profile.first_name || !profile.last_name || !profile.role) {
            console.error('Incomplete profile data:', profile);
            throw new Error('User profile data is incomplete. Please contact support.');
          }

          const authUser: AuthUser = {
            id: profile.id,
            email: profile.email,
            firstName: profile.first_name,
            lastName: profile.last_name,
            role: profile.role
          };

          console.log('Login successful for user:', authUser.email);
          toast.success('Logged in successfully');
          return authUser;
        } catch (error: any) {
          lastError = error;
          console.error(`Login attempt ${attempt + 1} failed:`, error);
          
          // Don't retry for specific errors
          if (error.message.includes('email') || 
              error.message.includes('Invalid email or password') ||
              error.message.includes('timeout') ||
              error.message.includes('CORS')) {
            throw error;
          }
          
          if (attempt < maxRetries) {
            const backoffTime = Math.pow(2, attempt) * 1000;
            console.log(`Retrying in ${backoffTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          }
        }
      }

      // If we get here, all retries failed
      console.error('All login attempts failed');
      throw lastError || new Error('Login failed after multiple attempts. Please try again later.');
    } catch (error: any) {
      console.error('Login error details:', error);
      
      // Format user-friendly error messages
      let userMessage = 'An unexpected error occurred during login. Please try again.';
      
      if (error.message.includes('timeout')) {
        userMessage = 'Connection timeout. Please check your internet connection and try again.';
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        userMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message.includes('CORS')) {
        userMessage = 'Unable to connect to the authentication service due to security restrictions. Please try again later.';
      } else if (error.message.includes('Invalid email or password')) {
        userMessage = error.message;
      } else if (error.message.includes('not configured')) {
        userMessage = 'The authentication service is not properly configured. Please contact support.';
      } else if (error.message.includes('email')) {
        userMessage = error.message;
      } else if (error.message.includes('User profile not found') || 
                error.message.includes('User profile data is incomplete')) {
        userMessage = error.message;
      }
      
      toast.error(userMessage);
      throw new Error(userMessage);
    }
  },

  async register(data: RegisterData): Promise<void> {
    try {
      console.log('Starting registration process for:', data.email);
      
      // First, create the user in Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName
          },
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      if (signUpError) {
        console.error('Sign up error:', signUpError);
        throw signUpError;
      }
      
      if (!authData.user) {
        throw new Error('No user returned from registration');
      }

      console.log('User created successfully, updating profile...');

      // Update profile with additional information
      if (data.phone || data.address || data.city || data.state || data.zip || 
          data.employmentStatus || data.employerName || data.monthlyIncome) {
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            phone: data.phone,
            address: data.address,
            city: data.city,
            state: data.state,
            zip: data.zip,
            employment_status: data.employmentStatus,
            employer_name: data.employerName,
            monthly_income: data.monthlyIncome
          })
          .eq('id', authData.user.id)
          .select();
          
        if (updateError) {
          console.error('Error updating profile:', updateError);
          // Continue with registration even if profile update fails
        }
      }

      // Send welcome SMS if phone number is provided
      if (data.phone) {
        try {
          await smsService.sendWelcomeSMS(data.phone, data.firstName);
        } catch (smsError) {
          console.error('Error sending welcome SMS:', smsError);
          // Continue with registration even if SMS fails
        }
      }

      // Try to auto-confirm email
      try {
        console.log('Attempting to auto-confirm email...');
        const { data: confirmData, error: confirmError } = await supabase.functions.invoke('auto-confirm-email', {
          body: { email: data.email },
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (confirmError) {
          console.error('Error auto-confirming email:', confirmError);
          // Continue with registration even if auto-confirmation fails
        } else if (confirmData && confirmData.success) {
          console.log('Email auto-confirmed successfully');
        }
      } catch (confirmError) {
        console.error('Error invoking auto-confirm-email function:', confirmError);
        // Continue with registration even if auto-confirmation fails
      }

      console.log('Registration completed successfully');
      toast.success('Registration successful! Please check your email to confirm your account.');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message);
      throw error;
    }
  },

  async logout(): Promise<void> {
    try {
      console.log('Attempting logout');
      
      // Always clear auth data, regardless of session state
      clearAuthData();
      
      // Check if there's a current session before attempting to sign out
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session check error during logout:', sessionError);
      }
      
      // If no session exists, just return successfully
      if (!session) {
        console.log('No active session found, logout successful');
        toast.success('Logged out successfully');
        return;
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        throw error;
      }
      
      console.log('Logout successful');
      toast.success('Logged out successfully');
    } catch (error: any) {
      console.error('Logout error:', error);
      // Don't throw the error if it's just a missing session
      if (error.message !== 'Auth session missing!') {
        toast.error(error.message);
        throw error;
      }
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      console.log('Checking for current user');
      
      // First check if there's a session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        
        // Check for refresh token errors
        if (sessionError.message?.includes('refresh_token_not_found') || 
            sessionError.message?.includes('Invalid Refresh Token')) {
          console.log('Invalid refresh token detected during getCurrentUser');
          clearAuthData();
          
          // Attempt to sign out to clean up any session data
          try {
            await supabase.auth.signOut();
          } catch (signOutError) {
            console.error('Error during forced sign out:', signOutError);
          }
          
          return null;
        }
        
        throw sessionError;
      }
      
      if (!session?.user) {
        console.log('No active session found');
        return null;
      }

      console.log('Session found, refreshing...');
      
      // Try to refresh the session if it exists
      try {
        const { data: { user }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Session refresh error:', refreshError);
          
          // Check for refresh token errors
          if (refreshError.message?.includes('refresh_token_not_found') || 
              refreshError.message?.includes('Invalid Refresh Token')) {
            console.log('Invalid refresh token detected during refresh');
            clearAuthData();
            
            // Attempt to sign out to clean up any session data
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              console.error('Error during forced sign out:', signOutError);
            }
            
            return null;
          }
          
          throw refreshError;
        }

        if (!user) {
          console.log('No user found after refresh');
          return null;
        }

        console.log('Session refreshed, fetching profile...');
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          return null;
        }

        if (!profile) {
          console.log('No profile found for user');
          return null;
        }

        console.log('User authenticated:', profile.email);
        console.log('Profile data:', profile);
        
        return {
          id: profile.id,
          email: profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          role: profile.role
        };
      } catch (error: any) {
        console.error('Error refreshing session:', error);
        
        // If we get a refresh token error, clear the session
        if (error.message?.includes('refresh_token_not_found') || 
            error.message?.includes('Invalid Refresh Token')) {
          console.log('Invalid refresh token detected, clearing session');
          clearAuthData();
          
          // Attempt to sign out to clean up any session data
          try {
            await supabase.auth.signOut();
          } catch (signOutError) {
            console.error('Error during forced sign out:', signOutError);
          }
        }
        
        return null;
      }
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  async confirmEmail(token: string): Promise<void> {
    try {
      console.log('Confirming email with token');
      
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email'
      });
      
      if (error) {
        console.error('Email confirmation error:', error);
        throw error;
      }
      
      console.log('Email confirmed successfully');
      toast.success('Email confirmed successfully. You can now log in.');
    } catch (error: any) {
      console.error('Email confirmation error:', error);
      toast.error(error.message || 'Failed to confirm email. Please try again.');
      throw error;
    }
  },

  async resetPassword(email: string): Promise<void> {
    try {
      console.log('Sending password reset email to:', email);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) {
        console.error('Password reset error:', error);
        throw error;
      }
      
      console.log('Password reset email sent successfully');
      toast.success('Password reset instructions have been sent to your email.');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error(error.message || 'Failed to send password reset email. Please try again.');
      throw error;
    }
  }
};
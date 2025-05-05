import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, subscribeToChanges, checkDatabaseConnectivity } from '../services/db';
import { toast } from 'react-hot-toast';
import { smsService } from '../services/smsService';

interface UserState {
  applications: any[];
  documents: any[];
  payments: any[];
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  
  subscriptions: (() => void)[];
  
  setupSubscriptions: () => void;
  cleanup: () => void;
  checkAuth: () => Promise<boolean>;
  
  fetchApplications: () => Promise<void>;
  createApplication: (data: any) => Promise<any>;
  updateApplication: (id: string, data: any) => Promise<void>;
  fetchDocuments: () => Promise<void>;
  uploadDocument: (data: any) => Promise<void>;
  fetchPayments: () => Promise<void>;
  makePayment: (data: any) => Promise<void>;
  downloadStatement: () => Promise<void>;
  
  // New methods for emergency contacts and employer information
  createEmergencyContact: (data: any) => Promise<any>;
  updateEmergencyContact: (id: string, data: any) => Promise<void>;
  fetchEmergencyContacts: () => Promise<any[]>;
  
  createEmployerInfo: (data: any) => Promise<any>;
  updateEmployerInfo: (id: string, data: any) => Promise<void>;
  fetchEmployerInfo: () => Promise<any[]>;
}

// Utility function for exponential backoff retry
const retry = async (fn: () => Promise<any>, retries = 2, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      applications: [],
      documents: [],
      payments: [],
      loading: false,
      error: null,
      isAuthenticated: false,
      subscriptions: [],

      checkAuth: async () => {
        try {
          console.log('Checking authentication status...');
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error checking auth status:', error);
            set({ isAuthenticated: false });
            return false;
          }

          const isAuthenticated = !!session;
          set({ isAuthenticated });

          // If not authenticated, try to refresh the session
          if (!isAuthenticated) {
            console.log('No active session, attempting to refresh...');
            const { data: { session: refreshedSession }, error: refreshError } = 
              await supabase.auth.refreshSession();
            
            if (!refreshError && refreshedSession) {
              console.log('Session refreshed successfully');
              set({ isAuthenticated: true });
              return true;
            } else if (refreshError) {
              console.error('Session refresh error:', refreshError);
            }
          } else {
            console.log('Active session found');
          }

          return isAuthenticated;
        } catch (error) {
          console.error('Error checking auth status:', error);
          set({ isAuthenticated: false });
          return false;
        }
      },

      setupSubscriptions: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;

        console.log('Setting up realtime subscriptions for user:', user.id);

        const subscriptions = [
          subscribeToChanges('applications', (payload) => {
            const { eventType, new: newApp, old: oldApp } = payload;
            
            if (newApp?.user_id !== user.id && oldApp?.user_id !== user.id) return;
            
            set(state => {
              switch (eventType) {
                case 'INSERT':
                  return {
                    applications: [newApp, ...state.applications]
                  };
                case 'UPDATE':
                  return {
                    applications: state.applications.map(app =>
                      app.id === newApp.id ? { ...app, ...newApp } : app
                    )
                  };
                case 'DELETE':
                  return {
                    applications: state.applications.filter(app => app.id !== oldApp.id)
                  };
                default:
                  return state;
              }
            });
          }),

          subscribeToChanges('documents', (payload) => {
            const { eventType, new: newDoc, old: oldDoc } = payload;
            
            if (newDoc?.user_id !== user.id && oldDoc?.user_id !== user.id) return;
            
            set(state => {
              switch (eventType) {
                case 'INSERT':
                  return {
                    documents: [newDoc, ...state.documents]
                  };
                case 'UPDATE':
                  return {
                    documents: state.documents.map(doc =>
                      doc.id === newDoc.id ? { ...doc, ...newDoc } : doc
                    )
                  };
                case 'DELETE':
                  return {
                    documents: state.documents.filter(doc => doc.id !== oldDoc.id)
                  };
                default:
                  return state;
              }
            });
          }),

          subscribeToChanges('payments', (payload) => {
            const { eventType, new: newPayment, old: oldPayment } = payload;
            
            const isUserPayment = (payment: any) => {
              return payment?.application?.user_id === user.id;
            };
            
            if (!isUserPayment(newPayment) && !isUserPayment(oldPayment)) return;
            
            set(state => {
              switch (eventType) {
                case 'INSERT':
                  return {
                    payments: [newPayment, ...state.payments]
                  };
                case 'UPDATE':
                  return {
                    payments: state.payments.map(payment =>
                      payment.id === newPayment.id ? { ...payment, ...newPayment } : payment
                    )
                  };
                case 'DELETE':
                  return {
                    payments: state.payments.filter(payment => payment.id !== oldPayment.id)
                  };
                default:
                  return state;
              }
            });
          }),
          
          // Add subscriptions for emergency_contacts and employer_information
          subscribeToChanges('emergency_contacts', (payload) => {
            const { eventType, new: newContact, old: oldContact } = payload;
            
            if (newContact?.user_id !== user.id && oldContact?.user_id !== user.id) return;
            
            // Update the application that this emergency contact belongs to
            get().fetchApplications();
          }),
          
          subscribeToChanges('employer_information', (payload) => {
            const { eventType, new: newEmployer, old: oldEmployer } = payload;
            
            // Check if this employer info belongs to the user's application
            const isUserEmployerInfo = async (employerInfo: any) => {
              if (!employerInfo?.application_id) return false;
              
              const { data } = await supabase
                .from('applications')
                .select('user_id')
                .eq('id', employerInfo.application_id)
                .single();
                
              return data?.user_id === user.id;
            };
            
            // If employer info changes, refresh applications
            if (isUserEmployerInfo(newEmployer) || isUserEmployerInfo(oldEmployer)) {
              get().fetchApplications();
            }
          })
        ];
        
        set({ subscriptions });
      },

      cleanup: () => {
        const { subscriptions } = get();
        console.log('Cleaning up subscriptions...');
        subscriptions.forEach(unsubscribe => unsubscribe());
        set({ subscriptions: [] });
      },

      fetchApplications: async () => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError) throw userError;
          if (!user) throw new Error('Not authenticated');

          console.log('Fetching applications for user:', user.id);
          
          // Check database connectivity before making the request
          const isConnected = await checkDatabaseConnectivity(2, 1000);
          if (!isConnected) {
            throw new Error('Unable to connect to the database. Please check your internet connection.');
          }

          const { data, error } = await supabase
            .from('applications')
            .select(`
              *,
              emergency_contacts(*),
              employer_information(*)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          console.log('Applications fetched successfully:', data?.length || 0);
          set({ applications: data || [], loading: false, error: null });
        } catch (error: any) {
          console.error('Error fetching applications:', error);
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      createApplication: async (data) => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) throw new Error('Not authenticated');

          const { data: newApp, error } = await supabase
            .from('applications')
            .insert([{ ...data, user_id: user.id }])
            .select()
            .single();

          if (error) throw error;
          
          // Get user's phone number for SMS notification
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('phone, first_name')
            .eq('id', user.id)
            .single();
            
          if (!profileError && profile && profile.phone) {
            try {
              // Send application submitted SMS
              await smsService.sendSMS({
                recipient: profile.phone,
                message: `Hello ${profile.first_name}, your ShelterCrest application has been submitted successfully. We'll notify you once it's reviewed.`
              });
            } catch (smsError) {
              console.error('Error sending application submission SMS:', smsError);
              // Don't throw error here, just log it
            }
          }
          
          set(state => ({
            applications: [newApp, ...state.applications],
            loading: false,
            error: null
          }));
          
          toast.success('Application submitted successfully');
          return newApp;
        } catch (error: any) {
          set({ error: error.message, loading: false });
          toast.error('Failed to submit application');
          throw error;
        }
      },

      updateApplication: async (id, data) => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: updatedApp, error } = await supabase
            .from('applications')
            .update(data)
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;
          
          set(state => ({
            applications: state.applications.map(app => 
              app.id === id ? { ...app, ...updatedApp } : app
            ),
            loading: false,
            error: null
          }));
          
          toast.success('Application updated successfully');
        } catch (error: any) {
          set({ error: error.message, loading: false });
          toast.error('Failed to update application');
          throw error;
        }
      },

      fetchDocuments: async () => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) throw new Error('Not authenticated');

          console.log('Fetching documents for user:', user.id);
          
          // Check database connectivity before making the request
          const isConnected = await checkDatabaseConnectivity(2, 1000);
          if (!isConnected) {
            throw new Error('Unable to connect to the database. Please check your internet connection.');
          }

          const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          console.log('Documents fetched successfully:', data?.length || 0);
          set({ documents: data || [], loading: false, error: null });
        } catch (error: any) {
          console.error('Error fetching documents:', error);
          set({ error: error.message, loading: false });
        }
      },

      uploadDocument: async (data) => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) throw new Error('Not authenticated');

          const { data: newDoc, error } = await supabase
            .from('documents')
            .insert([{ ...data, user_id: user.id }])
            .select()
            .single();

          if (error) throw error;
          
          // Get user's phone number for SMS notification
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('phone, first_name')
            .eq('id', user.id)
            .single();
            
          if (!profileError && profile && profile.phone) {
            try {
              // Send document upload SMS
              await smsService.sendSMS({
                recipient: profile.phone,
                message: `Hello ${profile.first_name}, your document has been uploaded successfully. We'll notify you once it's verified.`
              });
            } catch (smsError) {
              console.error('Error sending document upload SMS:', smsError);
              // Don't throw error here, just log it
            }
          }
          
          set(state => ({
            documents: [newDoc, ...state.documents],
            loading: false,
            error: null
          }));
          
          toast.success('Document uploaded successfully');
        } catch (error: any) {
          console.error('Error uploading document:', error);
          set({ error: error.message, loading: false });
          toast.error('Failed to upload document');
          throw error;
        }
      },

      fetchPayments: async () => {
        try {
          // First check authentication
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            set({ error: 'Not authenticated', loading: false, payments: [] });
            return; // Exit early instead of throwing
          }

          set({ loading: true, error: null });
          
          // Use retry utility for fetching user
          const { data: { user } } = await retry(async () => {
            const response = await supabase.auth.getUser();
            if (!response.data.user) {
              throw new Error('User not found');
            }
            return response;
          }, 2, 1000);
          
          if (!user) {
            set({ error: 'User not found', loading: false, payments: [] });
            return;
          }

          console.log('Fetching payments for user:', user.id);
          
          // Check database connectivity before making the request
          const isConnected = await checkDatabaseConnectivity(2, 1000);
          if (!isConnected) {
            throw new Error('Unable to connect to the database. Please check your internet connection.');
          }

          // Use retry utility for fetching payments
          const { data, error } = await retry(async () => {
            return await supabase
              .from('payments')
              .select(`
                *,
                application:applications(
                  id,
                  user_id
                )
              `)
              .eq('application.user_id', user.id)
              .order('created_at', { ascending: false });
          }, 2, 1000);

          if (error) throw error;
          
          console.log('Payments fetched successfully:', data?.length || 0);
          
          set({ 
            payments: data || [], 
            loading: false,
            error: null // Clear any previous errors
          });
        } catch (error: any) {
          console.error('Error fetching payments:', error);
          set({ 
            error: error.message, 
            loading: false,
            payments: [] // Reset payments on error
          });
        }
      },

      makePayment: async (data) => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) throw new Error('Not authenticated');

          const { data: newPayment, error } = await supabase
            .from('payments')
            .insert([{ ...data }])
            .select(`
              *,
              application:applications(
                id,
                user_id
              )
            `)
            .single();

          if (error) throw error;
          
          // Get user's phone number for SMS notification
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('phone, first_name')
            .eq('id', user.id)
            .single();
            
          if (!profileError && profile && profile.phone) {
            try {
              // Send payment confirmation SMS
              await smsService.sendPaymentConfirmationSMS(
                profile.phone, 
                profile.first_name, 
                data.amount
              );
            } catch (smsError) {
              console.error('Error sending payment confirmation SMS:', smsError);
              // Don't throw error here, just log it
            }
          }
          
          set(state => ({
            payments: [newPayment, ...state.payments],
            loading: false,
            error: null
          }));
          
          toast.success('Payment successful');
        } catch (error: any) {
          console.error('Error processing payment:', error);
          set({ error: error.message, loading: false });
          toast.error('Failed to process payment');
          throw error;
        }
      },

      downloadStatement: async () => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) throw new Error('Not authenticated');

          // Fetch payments
          const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select(`
              *,
              application:applications(
                id,
                user_id,
                monthly_rent,
                property_address
              )
            `)
            .eq('application.user_id', user.id)
            .order('created_at', { ascending: false });
            
          if (paymentsError) throw paymentsError;
          
          // Generate CSV content
          let csvContent = "Date,Amount,Status,Property,Reference\n";
          
          payments?.forEach(payment => {
            const date = new Date(payment.created_at).toLocaleDateString();
            const amount = payment.amount;
            const status = payment.status;
            const property = payment.application?.property_address || 'N/A';
            const reference = payment.transaction_id || 'N/A';
            
            csvContent += `${date},${amount},${status},${property},${reference}\n`;
          });
          
          // Create a downloadable file
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `payment_statement_${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          set({ loading: false, error: null });
          toast.success('Payment statement downloaded');
        } catch (error: any) {
          console.error('Error downloading statement:', error);
          set({ error: error.message, loading: false });
          toast.error('Failed to download statement');
        }
      },
      
      // New methods for emergency contacts
      createEmergencyContact: async (data) => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) throw new Error('Not authenticated');

          const { data: newContact, error } = await supabase
            .from('emergency_contacts')
            .insert([{ ...data, user_id: user.id }])
            .select()
            .single();

          if (error) throw error;
          
          set({ loading: false, error: null });
          return newContact;
        } catch (error: any) {
          set({ error: error.message, loading: false });
          toast.error('Failed to create emergency contact');
          throw error;
        }
      },
      
      updateEmergencyContact: async (id, data) => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: updatedContact, error } = await supabase
            .from('emergency_contacts')
            .update(data)
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;
          
          set({ loading: false, error: null });
          toast.success('Emergency contact updated successfully');
        } catch (error: any) {
          set({ error: error.message, loading: false });
          toast.error('Failed to update emergency contact');
          throw error;
        }
      },
      
      fetchEmergencyContacts: async () => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) throw new Error('Not authenticated');

          const { data, error } = await supabase
            .from('emergency_contacts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          set({ loading: false, error: null });
          return data || [];
        } catch (error: any) {
          set({ error: error.message, loading: false });
          return [];
        }
      },
      
      // New methods for employer information
      createEmployerInfo: async (data) => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: newEmployerInfo, error } = await supabase
            .from('employer_information')
            .insert([data])
            .select()
            .single();

          if (error) throw error;
          
          set({ loading: false, error: null });
          return newEmployerInfo;
        } catch (error: any) {
          set({ error: error.message, loading: false });
          toast.error('Failed to create employer information');
          throw error;
        }
      },
      
      updateEmployerInfo: async (id, data) => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: updatedEmployerInfo, error } = await supabase
            .from('employer_information')
            .update(data)
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;
          
          set({ loading: false, error: null });
          toast.success('Employer information updated successfully');
        } catch (error: any) {
          set({ error: error.message, loading: false });
          toast.error('Failed to update employer information');
          throw error;
        }
      },
      
      fetchEmployerInfo: async () => {
        try {
          const isAuthenticated = await get().checkAuth();
          if (!isAuthenticated) {
            throw new Error('Not authenticated');
          }

          set({ loading: true, error: null });
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) throw new Error('Not authenticated');

          const { data: applications } = await supabase
            .from('applications')
            .select('id')
            .eq('user_id', user.id);
            
          if (!applications || applications.length === 0) {
            set({ loading: false, error: null });
            return [];
          }
          
          const appIds = applications.map(app => app.id);
          
          const { data, error } = await supabase
            .from('employer_information')
            .select('*')
            .in('application_id', appIds)
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          set({ loading: false, error: null });
          return data || [];
        } catch (error: any) {
          set({ error: error.message, loading: false });
          return [];
        }
      }
    }),
    {
      name: 'user-store',
      partialize: (state) => ({
        applications: state.applications,
        documents: state.documents,
        payments: state.payments,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
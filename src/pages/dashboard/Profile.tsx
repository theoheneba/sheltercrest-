import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, Building, Camera, Lock, Shield, Download } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/db';
import { toast } from 'react-hot-toast';

const Profile = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Initialize form data when user object changes
  useEffect(() => {
    if (user) {
      console.log('Setting initial form data from user object:', user);
      setFormData(prev => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || ''
      }));
    }
  }, [user]);
  
  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!user?.id) {
        console.log('No user ID available, skipping profile fetch');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        console.log('Fetching profile data for user:', user.id);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('phone, address, city, state, zip, first_name, last_name, email')
          .eq('id', user.id)
          .single();
          
        if (error) {
          console.error('Error fetching profile:', error);
          
          // Check if it's an auth error
          if (error.message?.includes('JWT') || error.message?.includes('auth')) {
            setError('Session expired. Please log in again.');
            toast.error('Session expired. Please log in again.');
            setIsLoading(false);
            return;
          }
          
          throw error;
        }
        
        console.log('Profile data fetched successfully:', data);
        
        if (data) {
          setFormData(prev => ({
            ...prev,
            firstName: data.first_name || user.firstName || '',
            lastName: data.last_name || user.lastName || '',
            email: data.email || user.email || '',
            phone: data.phone || '',
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            zip: data.zip || ''
          }));
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching user details:', error);
        setError('Failed to load user data. Please try again later.');
        toast.error('Failed to load user data. Please try again later.');
        setIsLoading(false);
      }
    };
    
    fetchUserDetails();
  }, [user]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is authenticated before proceeding
    if (!user?.id) {
      toast.error('Please log in to update your profile');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      console.log('Updating profile for user:', user.id);
      console.log('Update data:', {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip
      });
      
      // Update profile in Supabase
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
        
      if (error) {
        console.error('Error updating profile:', error);
        
        // Check if it's an auth error
        if (error.message?.includes('JWT') || error.message?.includes('auth')) {
          throw new Error('Session expired. Please log in again.');
        }
        
        throw error;
      }
      
      console.log('Profile updated successfully');
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile');
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is authenticated before proceeding
    if (!user?.id) {
      toast.error('Please log in to change your password');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (error) throw error;
      
      toast.success('Password updated successfully');
      setIsChangingPassword(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Failed to change password');
    }
  };

  const handleToggle2FA = async () => {
    // Check if user is authenticated before proceeding
    if (!user?.id) {
      toast.error('Please log in to manage 2FA settings');
      return;
    }
    
    try {
      // In a real implementation, this would integrate with a 2FA provider
      setIs2FAEnabled(!is2FAEnabled);
      toast.success(`Two-factor authentication ${is2FAEnabled ? 'disabled' : 'enabled'}`);
    } catch (error: any) {
      console.error('Error toggling 2FA:', error);
      toast.error(error.message || 'Failed to toggle 2FA');
    }
  };

  const handleDownloadData = async () => {
    // Check if user is authenticated before proceeding
    if (!user?.id) {
      toast.error('Please log in to download your data');
      return;
    }
    
    setIsDownloading(true);
    
    try {
      // Fetch user data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (profileError) throw profileError;
      
      // Fetch applications
      const { data: applications, error: applicationsError } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id);
        
      if (applicationsError) throw applicationsError;
      
      // Fetch payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .in('application_id', applications.map(app => app.id) || []);
        
      if (paymentsError) throw paymentsError;
      
      // Fetch documents
      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id);
        
      if (documentsError) throw documentsError;
      
      // Combine all data
      const userData = {
        profile: profileData,
        applications,
        payments,
        documents
      };
      
      // Create a downloadable file
      const dataStr = JSON.stringify(userData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      // Create a link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `user_data_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Data downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading data:', error);
      toast.error(error.message || 'Failed to download data');
    } finally {
      setIsDownloading(false);
    }
  };
  
  // If still loading, show a loading indicator
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile data...</p>
        </div>
      </div>
    );
  }
  
  // If user is not authenticated, show a message
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-4">Please log in to view and manage your profile.</p>
            <Link to="/login">
              <Button>
                Log In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // If there was an error loading the profile, show an error message
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Error Loading Profile</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex space-x-4">
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
              <Link to="/">
                <Button variant="outline">
                  Go to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant={isEditing ? 'outline' : 'primary'}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Info */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  <div className="flex items-center">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                        {formData.firstName && formData.lastName ? (
                          <span className="text-2xl font-semibold text-gray-700">
                            {formData.firstName[0]}{formData.lastName[0]}
                          </span>
                        ) : (
                          <User size={40} className="text-gray-400" />
                        )}
                      </div>
                      {isEditing && (
                        <button
                          type="button"
                          className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary-800 text-white hover:bg-primary-700 transition-colors"
                          onClick={() => toast.success('Profile picture upload would be implemented here')}
                        >
                          <Camera size={16} />
                        </button>
                      )}
                    </div>
                    <div className="ml-6">
                      <h3 className="text-lg font-medium">
                        {formData.firstName || user.firstName} {formData.lastName || user.lastName}
                      </h3>
                      <p className="text-gray-500">{formData.email || user.email}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        disabled={true} // Email cannot be changed
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">Address Information</h4>
                    <div>
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="col-span-2">
                        <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          id="state"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">
                          ZIP Code
                        </label>
                        <input
                          type="text"
                          id="zip"
                          name="zip"
                          value={formData.zip}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {isEditing && (
                    <div className="flex justify-end space-x-3">
                      <Button
                        type="submit"
                        isLoading={isSaving}
                      >
                        Save Changes
                      </Button>
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<Lock size={18} />}
                  onClick={() => setIsChangingPassword(true)}
                >
                  Change Password
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<Shield size={18} />}
                  onClick={handleToggle2FA}
                >
                  {is2FAEnabled ? 'Disable' : 'Enable'} Two-Factor Authentication
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Connected Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Building size={20} className="text-gray-400" />
                    <span className="ml-2">Property Management</span>
                  </div>
                  <span className="text-green-600 text-sm">Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Mail size={20} className="text-gray-400" />
                    <span className="ml-2">Email Notifications</span>
                  </div>
                  <span className="text-green-600 text-sm">Enabled</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Data & Privacy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Your data is protected under our privacy policy.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleDownloadData}
                  isLoading={isDownloading}
                  leftIcon={<Download size={16} />}
                >
                  Download My Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Password Change Modal */}
      {isChangingPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Change Password</h2>
            <form onSubmit={handleChangePassword}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="currentPassword"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setIsChangingPassword(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                >
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
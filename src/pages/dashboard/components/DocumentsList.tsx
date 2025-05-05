import { useState, useRef } from 'react';
import { FileText, Download, Eye, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { useUserStore } from '../../../store/userStore';
import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { supabase, ensureStorageBucket, createBucketDirectly, checkBucketExists, testBucketPermissions } from '../../../services/db';

const DocumentsList = () => {
  const { documents, fetchDocuments } = useUserStore();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bucketReady, setBucketReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bucketError, setBucketError] = useState<string | null>(null);
  
  useEffect(() => {
    const checkBucket = async () => {
      try {
        setIsLoading(true);
        setBucketError(null);
        
        console.log('DocumentsList: Checking if bucket exists...');
        
        // First check if bucket exists
        const bucketExists = await checkBucketExists('user-documents');
        console.log(`DocumentsList: Bucket exists = ${bucketExists}`);
        
        if (bucketExists) {
          // Test permissions on the bucket
          const hasPermissions = await testBucketPermissions('user-documents');
          console.log(`DocumentsList: Has permissions = ${hasPermissions}`);
          
          if (hasPermissions) {
            setBucketReady(true);
          } else {
            console.error('DocumentsList: User does not have permissions for the bucket');
            setBucketError('You do not have permission to access the document storage. Please contact support.');
            setBucketReady(false);
          }
        } else {
          // Try to create bucket directly first
          let exists = await createBucketDirectly('user-documents');
          
          if (!exists) {
            // Fall back to Edge Function approach
            exists = await ensureStorageBucket('user-documents');
          }
          
          setBucketReady(exists);
          if (!exists) {
            console.error('Failed to ensure storage bucket exists');
            setBucketError('Document storage is not properly configured. Please contact support.');
          }
        }
      } catch (error) {
        console.error('Error checking bucket:', error);
        setBucketReady(false);
        setBucketError('Failed to configure document storage. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkBucket();
    fetchDocuments();
  }, [fetchDocuments]);
  
  const getStatusIcon = (status: string) => {
    if (status === 'verified') {
      return <CheckCircle size={16} className="text-green-500" />;
    } else if (status === 'pending') {
      return <AlertCircle size={16} className="text-orange-500" />;
    } else if (status === 'rejected') {
      return <AlertCircle size={16} className="text-red-500" />;
    }
    return null;
  };
  
  const getStatusClass = (status: string) => {
    if (status === 'verified') {
      return 'bg-green-100 text-green-800';
    } else if (status === 'pending') {
      return 'bg-orange-100 text-orange-800';
    } else if (status === 'rejected') {
      return 'bg-red-100 text-red-800';
    }
    return '';
  };
  
  const handleUpload = () => {
    if (!bucketReady) {
      toast.error(bucketError || 'Document storage is not properly configured. Please try again later or contact support.');
      return;
    }
    
    if (!navigator.onLine) {
      toast.error('You are currently offline. Please check your internet connection and try again.');
      return;
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      const file = files[0];
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size exceeds the 10MB limit. Please upload a smaller file.');
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPG, PNG, PDF, or DOC file.');
      }
      
      // Get file extension
      const fileExt = file.name.split('.').pop();
      // Create a unique file name
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      
      // Get the user's ID for the folder structure
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Auth error:', userError);
        throw new Error('Authentication error. Please log in again.');
      }
      
      if (!user) {
        throw new Error('User not authenticated. Please log in again.');
      }
      
      // Create a user-specific path
      const filePath = `${user.id}/${fileName}`;
      
      // Check if bucket exists first
      console.log('Checking if bucket exists...');
      const { data: buckets, error: bucketsError } = await supabase.storage
        .listBuckets();
        
      if (bucketsError) {
        console.error('Error checking buckets:', bucketsError);
        throw new Error('Failed to check storage buckets');
      }
      
      console.log('Available buckets:', buckets?.map(b => b.name));
      
      // Use the user-documents bucket
      const bucketName = 'user-documents';
      const documentsBucket = buckets?.find(b => b.name === bucketName);
      
      if (!documentsBucket) {
        console.error(`Bucket '${bucketName}' not found`);
        
        // Try to create the bucket on-the-fly
        const bucketCreated = await createBucketDirectly(bucketName);
        if (!bucketCreated) {
          throw new Error('Document storage is not properly configured. Please contact support.');
        }
      }
      
      console.log(`Using bucket: ${bucketName}`);
      console.log(`Uploading file to path: ${filePath}`);
      
      // Upload file to Supabase Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
        
      if (storageError) {
        console.error('Storage error:', storageError);
        if (storageError.message.includes('Bucket not found')) {
          throw new Error('Document storage is not properly configured. Please contact support.');
        } else if (storageError.message.includes('Permission denied')) {
          throw new Error('You do not have permission to upload to this storage location.');
        } else if (storageError.message.includes('already exists')) {
          throw new Error('A file with this name already exists. Please try again.');
        }
        throw storageError;
      }
      
      console.log('File uploaded successfully:', storageData);
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
        
      if (!publicUrlData.publicUrl) {
        throw new Error('Failed to generate document URL');
      }
      
      console.log('Public URL generated:', publicUrlData.publicUrl);
      
      // Save document metadata to database
      await useUserStore.getState().uploadDocument({
        document_type: 'other',
        file_name: file.name,
        file_path: publicUrlData.publicUrl,
        status: 'pending',
        description: `Document uploaded on ${new Date().toLocaleDateString()}`
      });
      
      toast.success('Document uploaded successfully');
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Refresh documents list
      fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      
      let errorMessage = 'Failed to upload document';
      
      if (error.message.includes('storage is not properly configured')) {
        errorMessage = 'Document storage is not properly configured. Please contact support.';
      } else if (error.message.includes('Bucket not found')) {
        errorMessage = 'The specified storage bucket was not found. Please contact support.';
      } else if (error.message.includes('Permission denied') || error.message.includes('Access denied')) {
        errorMessage = 'You do not have permission to upload to this storage location.';
      } else if (error.message.includes('File size exceeds')) {
        errorMessage = error.message;
      } else if (error.message.includes('Invalid file type')) {
        errorMessage = error.message;
      } else if (error.message.includes('already exists')) {
        errorMessage = error.message;
      } else if (error.message.includes('Failed to fetch') || error.message.includes('Network error')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }
      
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleViewDocument = (url: string) => {
    window.open(url, '_blank');
  };
  
  const handleDownloadDocument = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to download document');
      }
      
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };
  
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading documents...</p>
      </div>
    );
  }
  
  if (bucketError) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200 mb-6">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
          <div>
            <h3 className="font-medium text-red-800">Storage Configuration Error</h3>
            <p className="text-sm text-red-700 mt-1">{bucketError}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={async () => {
                setIsLoading(true);
                setBucketError(null);
                
                try {
                  // Try to create bucket directly
                  const success = await createBucketDirectly('user-documents');
                  if (success) {
                    setBucketReady(true);
                    toast.success('Document storage is now ready');
                  } else {
                    setBucketError('Failed to configure document storage. Please try again later.');
                  }
                } catch (error) {
                  console.error('Error retrying bucket creation:', error);
                  setBucketError('Failed to configure document storage. Please try again later.');
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              Retry Configuration
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <p className="text-sm text-gray-600">Upload your documents for verification</p>
        <Button 
          size="sm" 
          onClick={handleUpload} 
          isLoading={isUploading}
          leftIcon={<Upload size={16} />}
          disabled={!bucketReady || !navigator.onLine}
        >
          Upload Document
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        />
      </div>
      
      {!navigator.onLine && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
            <p className="text-sm text-red-700">
              You are currently offline. Document upload is not available while offline.
            </p>
          </div>
        </div>
      )}
      
      {documents.length > 0 ? (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Upload Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText size={18} className="text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{doc.file_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {doc.document_type.split('_').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(doc.status)}`}>
                      {getStatusIcon(doc.status)}
                      <span className="ml-1">{doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button 
                        className="text-gray-500 hover:text-primary-800 transition-colors" 
                        title="View"
                        onClick={() => handleViewDocument(doc.file_path)}
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        className="text-gray-500 hover:text-primary-800 transition-colors" 
                        title="Download"
                        onClick={() => handleDownloadDocument(doc.file_path, doc.file_name)}
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <FileText size={48} className="mx-auto text-gray-400 mb-2" />
          <h3 className="text-lg font-medium text-gray-900">No Documents</h3>
          <p className="mt-1 text-sm text-gray-500">You haven't uploaded any documents yet.</p>
          <Button
            className="mt-4"
            size="sm"
            leftIcon={<Upload size={16} />}
            onClick={handleUpload}
            disabled={!bucketReady || !navigator.onLine}
          >
            Upload Document
          </Button>
        </div>
      )}
    </div>
  );
};

export default DocumentsList;
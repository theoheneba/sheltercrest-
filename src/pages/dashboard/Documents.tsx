import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Filter, Search, AlertCircle, Info } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card, { CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import DocumentsList from './components/DocumentsList';
import { supabase, ensureStorageBucket, checkDatabaseConnectivity, createBucketDirectly, checkBucketExists, testBucketPermissions } from '../../services/db';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../../store/userStore';
import { smsService } from '../../services/smsService';

// Define document types for each employment status
const EMPLOYEE_DOCUMENTS = [
  { id: 'ghana_card', label: 'Ghana Card or Valid Passport (Front and Back)', required: true },
  { id: 'employee_id', label: 'Employee ID', required: false },
  { id: 'offer_letter', label: 'Offer Letter', required: true },
  { id: 'payslip', label: 'Payslip', required: true },
  { id: 'bank_statement', label: 'Three Months Bank Statement/MoMo Statement', required: true },
  { id: 'supervisor_contact', label: 'Supervisor Contact', required: true },
  { id: 'work_email', label: 'Work Email', required: false },
  { id: 'employer_details', label: 'Employer (Company) Name, Contact and Location', required: true },
  { id: 'emergency_contact', label: 'Emergency Contact', required: true },
  { id: 'live_selfie', label: 'Live Selfie', required: true }
];

const SELF_EMPLOYED_DOCUMENTS = [
  { id: 'ghana_card', label: 'Ghana Card or Valid Passport', required: true },
  { id: 'bank_statement', label: 'Four Months Bank/MoMo Statement or Both', required: true },
  { id: 'business_certificate', label: 'Business Certificate Including Form A', required: true },
  { id: 'business_address', label: 'Physical Address of Business', required: true },
  { id: 'guarantor_contact', label: 'Guarantor Contact (Salaried Worker)', required: true },
  { id: 'live_selfie', label: 'Live Selfie', required: true }
];

const Documents = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [currentDocType, setCurrentDocType] = useState<string | null>(null);
  const [employmentStatus, setEmploymentStatus] = useState<'full-time' | 'self-employed' | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, boolean>>({});
  const [bucketReady, setBucketReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [bucketError, setBucketError] = useState<string | null>(null);
  const { documents, fetchDocuments, uploadDocument } = useUserStore();

  // Fetch user's employment status and documents on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return;

      try {
        setIsInitializing(true);
        setBucketError(null);
        
        // First check database connectivity
        const isConnected = await checkDatabaseConnectivity();
        if (!isConnected) {
          console.error('Database connectivity check failed');
          toast.error('Unable to connect to the database. Please check your internet connection and try again.');
          setIsInitializing(false);
          return;
        }
        
        console.log('Documents.tsx: Checking if user-documents bucket exists...');
        
        // First check if bucket exists
        const bucketExists = await checkBucketExists('user-documents');
        console.log(`Documents.tsx: Bucket exists = ${bucketExists}`);
        
        if (bucketExists) {
          // Test permissions on the bucket
          const hasPermissions = await testBucketPermissions('user-documents');
          console.log(`Documents.tsx: Has permissions = ${hasPermissions}`);
          
          if (hasPermissions) {
            setBucketReady(true);
          } else {
            console.error('Documents.tsx: User does not have permissions for the bucket');
            setBucketError('You do not have permission to access the document storage. Please contact support.');
            setBucketReady(false);
          }
        } else {
          // Try to create bucket directly first
          console.log('Documents.tsx: Attempting to create bucket directly...');
          let bucketSuccess = await createBucketDirectly('user-documents');
          
          if (!bucketSuccess) {
            // Fall back to Edge Function approach
            console.log('Documents.tsx: Direct creation failed, falling back to Edge Function...');
            bucketSuccess = await ensureStorageBucket('user-documents');
          }
          
          console.log(`Documents.tsx: bucketSuccess = ${bucketSuccess}`);
          setBucketReady(bucketSuccess);
          
          if (!bucketSuccess) {
            console.error('Documents.tsx: Failed to ensure storage bucket exists');
            setBucketError('Document storage is not properly configured. Please try again later or contact support.');
          }
        }

        // Fetch user's employment status
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('employment_status')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          throw profileError;
        }

        // Set employment status based on profile data
        if (profile?.employment_status === 'self-employed') {
          setEmploymentStatus('self-employed');
        } else {
          // Default to employee for all other statuses (full-time, part-time, contract)
          setEmploymentStatus('full-time');
        }

        // Fetch user's documents
        await fetchDocuments();
      } catch (error) {
        console.error('Documents.tsx: Error fetching user data:', error);
        toast.error('Failed to load user data. Please try again later.');
      } finally {
        setIsInitializing(false);
      }
    };

    fetchUserData();
  }, [user?.id, fetchDocuments]);

  // Update uploaded documents state when documents change
  useEffect(() => {
    const uploadedDocs: Record<string, boolean> = {};
    
    documents.forEach(doc => {
      uploadedDocs[doc.document_type] = true;
    });
    
    setUploadedDocuments(uploadedDocs);
  }, [documents]);

  // Get the appropriate document list based on employment status
  const getDocumentList = () => {
    if (employmentStatus === 'self-employed') {
      return SELF_EMPLOYED_DOCUMENTS;
    }
    return EMPLOYEE_DOCUMENTS;
  };

  const handleUpload = (docType: string) => {
    if (!bucketReady) {
      toast.error(bucketError || 'Document storage is not properly configured. Please try again later or contact support.');
      return;
    }
    
    if (!navigator.onLine) {
      toast.error('You are currently offline. Please check your internet connection and try again.');
      return;
    }
    
    if (!user?.id) {
      toast.error('You must be logged in to upload documents.');
      return;
    }
    
    setCurrentDocType(docType);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentDocType) return;
    
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
      
      // Create a user-specific path with document type
      const filePath = `${user.id}/${currentDocType}_${fileName}`;
      
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
      await uploadDocument({
        document_type: currentDocType,
        file_name: file.name,
        file_path: publicUrlData.publicUrl,
        status: 'pending',
        description: `${currentDocType} document uploaded on ${new Date().toLocaleDateString()}`
      });
      
      // Update local state
      setUploadedDocuments(prev => ({
        ...prev,
        [currentDocType]: true
      }));
      
      toast.success('Document uploaded successfully');
      
      // Send SMS notification for document upload
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone, first_name')
          .eq('id', user.id)
          .single();
          
        if (profile && profile.phone) {
          // Format document type for display
          const docTypeDisplay = currentDocType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
            
          await smsService.sendDocumentUploadedSMS(
            profile.phone,
            profile.first_name,
            docTypeDisplay
          );
        }
      }
      
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
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }
      
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      setCurrentDocType(null);
    }
  };

  // Get document status
  const getDocumentStatus = (docType: string) => {
    const doc = documents.find(d => d.document_type === docType);
    return doc ? doc.status : null;
  };

  // Get status badge
  const getStatusBadge = (docType: string) => {
    const status = getDocumentStatus(docType);
    
    if (!status) {
      return <span className="text-gray-500">Not uploaded</span>;
    }
    
    if (status === 'verified') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Verified</span>;
    }
    
    if (status === 'rejected') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Rejected</span>;
    }
    
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>;
  };

  // Calculate completion percentage
  const calculateCompletionPercentage = () => {
    const documentList = getDocumentList();
    const requiredDocs = documentList.filter(doc => doc.required);
    
    if (requiredDocs.length === 0) return 0;
    
    const uploadedRequiredDocs = requiredDocs.filter(doc => uploadedDocuments[doc.id]);
    return Math.round((uploadedRequiredDocs.length / requiredDocs.length) * 100);
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading document management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-primary-100 rounded-lg">
                <FileText size={24} className="text-primary-800" />
              </div>
              <span className="text-2xl font-bold">{documents.length}</span>
            </div>
            <h3 className="mt-2 font-medium">Total Documents</h3>
            <p className="text-sm text-gray-500">All uploaded documents</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-green-100 rounded-lg">
                <FileText size={24} className="text-green-800" />
              </div>
              <span className="text-2xl font-bold">{documents.filter(doc => doc.status === 'verified').length}</span>
            </div>
            <h3 className="mt-2 font-medium">Verified Documents</h3>
            <p className="text-sm text-gray-500">Approved and verified</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-orange-100 rounded-lg">
                <FileText size={24} className="text-orange-800" />
              </div>
              <span className="text-2xl font-bold">{documents.filter(doc => doc.status === 'pending').length}</span>
            </div>
            <h3 className="mt-2 font-medium">Pending Documents</h3>
            <p className="text-sm text-gray-500">Awaiting verification</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Management</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">Document Completion</h3>
              <span className="text-sm font-medium">{calculateCompletionPercentage()}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-primary-600 h-2.5 rounded-full" 
                style={{ width: `${calculateCompletionPercentage()}%` }}
              ></div>
            </div>
          </div>

          {/* Network Status Warning */}
          {!navigator.onLine && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
                <div>
                  <h3 className="font-medium text-red-800">You are offline</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Document upload is not available while offline. Please check your internet connection and try again.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bucket Error Warning */}
          {bucketError && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
                <div>
                  <h3 className="font-medium text-red-800">Storage Configuration Error</h3>
                  <p className="text-sm text-red-700 mt-1">
                    {bucketError}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={async () => {
                      setIsInitializing(true);
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
                        setIsInitializing(false);
                      }
                    }}
                  >
                    Retry Configuration
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Employment Status Notice */}
          {employmentStatus && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex">
                <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />
                <div>
                  <h3 className="font-medium text-blue-800">Document Requirements</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    {employmentStatus === 'self-employed' 
                      ? 'Please upload the following documents required for self-employed applicants.'
                      : 'Please upload the following documents required for employed applicants.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Document Upload List */}
          <div className="space-y-4">
            {employmentStatus ? (
              getDocumentList().map((doc) => (
                <div 
                  key={doc.id} 
                  className="p-4 border rounded-lg flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="flex items-center">
                      <FileText size={18} className="text-gray-400 mr-2" />
                      <span className="font-medium">{doc.label}</span>
                      {doc.required && (
                        <span className="ml-2 text-xs text-red-500">*Required</span>
                      )}
                    </div>
                    <div className="mt-1">
                      {getStatusBadge(doc.id)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={uploadedDocuments[doc.id] ? "outline" : "primary"}
                    leftIcon={<Upload size={16} />}
                    onClick={() => handleUpload(doc.id)}
                    isLoading={isUploading && currentDocType === doc.id}
                    disabled={isUploading || !bucketReady || !navigator.onLine}
                  >
                    {uploadedDocuments[doc.id] ? "Re-upload" : "Upload"}
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading document requirements...</p>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />

          {/* Document Requirements Notice */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-gray-500 mt-0.5 mr-2" />
              <div>
                <h3 className="font-medium text-gray-700">Document Requirements</h3>
                <ul className="text-sm text-gray-600 mt-1 space-y-1">
                  <li>• Accepted formats: PDF, DOC, DOCX, JPG, JPEG, PNG</li>
                  <li>• Maximum file size: 10MB</li>
                  <li>• Documents must be clear and legible</li>
                  <li>• All required documents must be uploaded for application processing</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Documents;
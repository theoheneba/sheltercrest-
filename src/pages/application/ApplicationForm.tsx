import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  calculateInitialPayment, 
  formatCurrency, 
  calculateDocumentReviewFee,
  calculateDepositAndInterest
} from '../../utils/paymentCalculations';
import { useConditionalEligibility } from '../../hooks/useConditionalEligibility';
import { useUserStore } from '../../store/userStore';
import { toast } from 'react-hot-toast';
import PaymentModal from '../../components/payment/PaymentModal';
import { useAuth } from '../../contexts/AuthContext';
import { paymentService } from '../../services/paymentService';
import PaymentSummary from '../../components/payment/PaymentSummary';
import { supabase } from '../../services/db';
import { Upload, X, Check, AlertTriangle, Info } from 'lucide-react';
import { ApplicationFormData, DocumentUpload } from '../../types/application';

const REQUIRED_DOCUMENTS = [
  { id: 'selfie_photo', label: 'Selfie Photo', required: true },
  { id: 'id_card', label: 'ID Card (Passport/Ghana Card)', required: true },
  { id: 'bank_statement', label: 'Bank Statement', required: true },
  { id: 'momo_statement', label: 'MoMo Statement', required: true },
  { id: 'employment_offer_letter', label: 'Employment Offer Letter', required: true },
  { id: 'employment_payslip', label: 'Employment Payslip', required: true },
  { id: 'company_id_card', label: 'Company ID Card', required: true }
];

const ApplicationForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isEligible, isLoading, redirectToEligibilityCheck } = useConditionalEligibility();
  const { createApplication, applications, fetchApplications, loading } = useUserStore();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'document_review' | 'deposit_interest'>('document_review');
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentDocType, setCurrentDocType] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<ApplicationFormData>({
    personalInfo: {
      firstName: '',
      lastName: '',
      gender: 'male',
      dateOfBirth: '',
      maritalStatus: 'single',
      educationLevel: '',
      whatsappNumber: '',
      email: '',
      currentResidence: '',
      heardFrom: ''
    },
    emergencyContact: {
      firstName: '',
      lastName: '',
      whatsappNumber: '',
      residenceAddress: ''
    },
    employmentInfo: {
      status: 'full-time',
      type: '',
      contractEndDate: '',
      contractRenewable: false,
      hasOutstandingLoans: false,
      loanRepaymentAmount: 0,
      monthlyIncome: 0,
      employmentStartDate: '',
      employeeIdNumber: '',
      mandateNumber: '',
      mandatePin: '',
      hasSavingsAccount: false,
      savingsAmount: 0
    },
    employerInfo: {
      companyName: '',
      companyWebsite: '',
      companyLocation: '',
      companyLocationGps: '',
      companyPhone: '',
      supervisorName: '',
      supervisorPhone: ''
    },
    documents: REQUIRED_DOCUMENTS.reduce((acc, doc) => {
      acc[doc.id] = {
        type: doc.id,
        file: null,
        uploaded: false,
        status: 'pending'
      };
      return acc;
    }, {} as Record<string, DocumentUpload>),
    monthlyRent: '',
    depositAmount: '',
    landlordName: '',
    landlordPhone: '',
    propertyAddress: '',
    leaseStartDate: '',
    leaseEndDate: '',
    landlordPaymentDate: '',
    paymentTerm: '12'
  });

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    // If user already has an application, populate the form with that data
    if (applications.length > 0) {
      const latestApplication = applications[0];
      
      // Update form data with application values
      setFormData(prevData => ({
        ...prevData,
        monthlyRent: latestApplication.monthly_rent.toString(),
        depositAmount: latestApplication.deposit_amount.toString(),
        landlordName: latestApplication.landlord_name,
        landlordPhone: latestApplication.landlord_phone,
        propertyAddress: latestApplication.property_address,
        leaseStartDate: latestApplication.lease_start_date,
        leaseEndDate: latestApplication.lease_end_date,
        landlordPaymentDate: latestApplication.landlord_payment_date || '',
        paymentTerm: latestApplication.payment_term?.toString() || '12',
        employmentInfo: {
          ...prevData.employmentInfo,
          contractEndDate: latestApplication.contract_end_date || '',
          contractRenewable: latestApplication.contract_renewable || false,
          hasOutstandingLoans: latestApplication.has_outstanding_loans || false,
          loanRepaymentAmount: latestApplication.loan_repayment_amount || 0,
          hasSavingsAccount: latestApplication.has_savings_account || false,
          savingsAmount: latestApplication.savings_amount || 0,
          employeeIdNumber: latestApplication.employee_id_number || '',
          mandateNumber: latestApplication.mandate_number || '',
          mandatePin: latestApplication.mandate_pin || ''
        }
      }));
      
      setApplicationId(latestApplication.id);
      
      // Fetch employer information if available
      fetchEmployerInfo(latestApplication.id);
      
      // Fetch emergency contact if available
      fetchEmergencyContact(latestApplication.id);
    }
    
    // If user profile exists, populate personal info
    if (user) {
      fetchUserProfile();
    }
  }, [applications, user]);

  useEffect(() => {
    if (!isLoading && !isEligible) {
      redirectToEligibilityCheck();
    }
  }, [isEligible, isLoading, redirectToEligibilityCheck]);

  const fetchUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error) throw error;
      
      if (profile) {
        setFormData(prevData => ({
          ...prevData,
          personalInfo: {
            ...prevData.personalInfo,
            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
            email: profile.email || '',
            gender: profile.gender || 'male',
            dateOfBirth: profile.date_of_birth || '',
            maritalStatus: profile.marital_status || 'single',
            educationLevel: profile.education_level || '',
            whatsappNumber: profile.whatsapp_number || profile.phone || '',
            currentResidence: profile.address || '',
            heardFrom: profile.heard_from || ''
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchEmployerInfo = async (appId: string) => {
    try {
      const { data, error } = await supabase
        .from('employer_information')
        .select('*')
        .eq('application_id', appId)
        .single();
        
      if (error) {
        console.error('Error fetching employer info:', error);
        return;
      }
      
      if (data) {
        setFormData(prevData => ({
          ...prevData,
          employerInfo: {
            companyName: data.company_name,
            companyWebsite: data.company_website || '',
            companyLocation: data.company_location,
            companyLocationGps: data.company_location_gps || '',
            companyPhone: data.company_phone,
            supervisorName: data.supervisor_name,
            supervisorPhone: data.supervisor_phone
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching employer info:', error);
    }
  };

  const fetchEmergencyContact = async (appId: string) => {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('application_id', appId)
        .single();
        
      if (error) {
        console.error('Error fetching emergency contact:', error);
        return;
      }
      
      if (data) {
        setFormData(prevData => ({
          ...prevData,
          emergencyContact: {
            firstName: data.first_name,
            lastName: data.last_name,
            whatsappNumber: data.whatsapp_number,
            residenceAddress: data.residence_address
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching emergency contact:', error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isEligible) {
    return null; // Component will redirect in useEffect
  }

  const handleInputChange = (
    section: keyof ApplicationFormData, 
    field: string, 
    value: string | number | boolean
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
    
    // Calculate all fees when monthly rent changes
    if (section === 'monthlyRent' && typeof value === 'string' && value) {
      const monthlyRent = parseFloat(value);
      const paymentTerm = parseInt(formData.paymentTerm);
      const { initialPaymentRequired, serviceFee, propertyInspectionFee, documentUploadFee, total } = calculateInitialPayment(monthlyRent, paymentTerm);
      setFormData(prev => ({
        ...prev,
        monthlyRent: value,
        depositAmount: initialPaymentRequired.toString(),
      }));
    }
    
    // Recalculate when payment term changes
    if (field === 'paymentTerm' && formData.monthlyRent) {
      const monthlyRent = parseFloat(formData.monthlyRent);
      const paymentTerm = parseInt(value as string);
      const { initialPaymentRequired, serviceFee, propertyInspectionFee, documentUploadFee, total } = calculateInitialPayment(monthlyRent, paymentTerm);
      setFormData(prev => ({
        ...prev,
        paymentTerm: value as string,
        depositAmount: initialPaymentRequired.toString(),
      }));
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
      
      // Update form data with the selected file
      setFormData(prev => ({
        ...prev,
        documents: {
          ...prev.documents,
          [currentDocType]: {
            ...prev.documents[currentDocType],
            file,
            status: 'uploaded'
          }
        }
      }));
      
      toast.success(`${currentDocType.replace(/_/g, ' ')} selected successfully`);
    } catch (error: any) {
      console.error('Error selecting document:', error);
      toast.error(error.message || 'Failed to select document');
    } finally {
      setIsUploading(false);
      setCurrentDocType(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadDocument = (docType: string) => {
    setCurrentDocType(docType);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const uploadDocuments = async (applicationId: string) => {
    const uploadPromises = Object.entries(formData.documents)
      .filter(([_, doc]) => doc.file !== null)
      .map(async ([docType, doc]) => {
        try {
          if (!doc.file) return null;
          
          // Get file extension
          const fileExt = doc.file.name.split('.').pop();
          // Create a unique file name
          const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          
          // Create a user-specific path
          const filePath = `${user?.id}/${docType}_${fileName}`;
          
          // Upload file to Supabase Storage
          const { data: storageData, error: storageError } = await supabase.storage
            .from('user-documents')
            .upload(filePath, doc.file, {
              cacheControl: '3600',
              upsert: false
            });
            
          if (storageError) throw storageError;
          
          // Get public URL
          const { data: publicUrlData } = supabase.storage
            .from('user-documents')
            .getPublicUrl(filePath);
            
          if (!publicUrlData.publicUrl) {
            throw new Error('Failed to generate document URL');
          }
          
          // Save document metadata to database
          const { data: docData, error: docError } = await supabase
            .from('documents')
            .insert({
              user_id: user?.id,
              application_id: applicationId,
              document_type: docType,
              file_name: doc.file.name,
              file_path: publicUrlData.publicUrl,
              status: 'pending',
              description: `${docType.replace(/_/g, ' ')} uploaded on ${new Date().toLocaleDateString()}`
            })
            .select()
            .single();
            
          if (docError) throw docError;
          
          return docData;
        } catch (error) {
          console.error(`Error uploading ${docType}:`, error);
          throw error;
        }
      });
      
    return Promise.all(uploadPromises);
  };

  const nextStep = () => {
    setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const validateStep = (step: number) => {
    switch (step) {
      case 1: // Personal Information
        const { personalInfo } = formData;
        return (
          personalInfo.firstName.trim() !== '' &&
          personalInfo.lastName.trim() !== '' &&
          personalInfo.dateOfBirth.trim() !== '' &&
          personalInfo.whatsappNumber.trim() !== '' &&
          personalInfo.email.trim() !== '' &&
          personalInfo.currentResidence.trim() !== ''
        );
      case 2: // Emergency Contact
        const { emergencyContact } = formData;
        return (
          emergencyContact.firstName.trim() !== '' &&
          emergencyContact.lastName.trim() !== '' &&
          emergencyContact.whatsappNumber.trim() !== '' &&
          emergencyContact.residenceAddress.trim() !== ''
        );
      case 3: // Employment Information
        const { employmentInfo } = formData;
        return (
          employmentInfo.type.trim() !== '' &&
          employmentInfo.monthlyIncome > 0 &&
          employmentInfo.employmentStartDate.trim() !== '' &&
          employmentInfo.employeeIdNumber.trim() !== ''
        );
      case 4: // Employer Information
        const { employerInfo } = formData;
        return (
          employerInfo.companyName.trim() !== '' &&
          employerInfo.companyLocation.trim() !== '' &&
          employerInfo.companyPhone.trim() !== '' &&
          employerInfo.supervisorName.trim() !== '' &&
          employerInfo.supervisorPhone.trim() !== ''
        );
      case 5: // Rental Information
        return (
          formData.monthlyRent.trim() !== '' &&
          formData.landlordName.trim() !== '' &&
          formData.landlordPhone.trim() !== '' &&
          formData.propertyAddress.trim() !== '' &&
          formData.leaseStartDate.trim() !== '' &&
          formData.leaseEndDate.trim() !== '' &&
          formData.landlordPaymentDate.trim() !== ''
        );
      case 6: // Document Upload
        // Check if all required documents are uploaded
        const requiredDocs = REQUIRED_DOCUMENTS.filter(doc => doc.required);
        const allUploaded = requiredDocs.every(doc => 
          formData.documents[doc.id].file !== null
        );
        return allUploaded;
      default:
        return true;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate all steps
      for (let i = 1; i <= 6; i++) {
        if (!validateStep(i)) {
          setCurrentStep(i);
          toast.error(`Please complete all required fields in step ${i}`);
          return;
        }
      }

      // Calculate document review fee
      const monthlyRent = parseFloat(formData.monthlyRent);
      const paymentTerm = parseInt(formData.paymentTerm);
      const documentReviewFee = calculateDocumentReviewFee(monthlyRent);
      
      // Show payment modal for document review fee
      setPaymentStep('document_review');
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Application submission error:', error);
      toast.error('Failed to submit application. Please try again.');
    }
  };

  const handlePaymentSuccess = async (reference: string) => {
    try {
      const monthlyRent = parseFloat(formData.monthlyRent);
      const paymentTerm = parseInt(formData.paymentTerm);
      
      if (paymentStep === 'document_review') {
        // Process document review fee payment
        await paymentService.verifyPayment({
          reference,
          amount: calculateDocumentReviewFee(monthlyRent).total,
          applicationId: 'document_review_fee'
        });
        
        // Create application in pending status
        const applicationData = {
          monthly_rent: monthlyRent,
          deposit_amount: parseFloat(formData.depositAmount),
          interest_amount: monthlyRent * 0.2808 * paymentTerm, // Calculate interest
          service_fee: monthlyRent,
          visit_fee: 0,
          processing_fee: 60,
          total_initial_payment: parseFloat(formData.depositAmount) + (monthlyRent * 0.2808 * paymentTerm) + monthlyRent + 60,
          landlord_name: formData.landlordName,
          landlord_phone: formData.landlordPhone,
          property_address: formData.propertyAddress,
          lease_start_date: formData.leaseStartDate,
          lease_end_date: formData.leaseEndDate,
          landlord_payment_date: formData.landlordPaymentDate,
          payment_term: paymentTerm,
          prorated_rent: 0, // Will be calculated after approval
          status: 'pending',
          // New fields
          contract_end_date: formData.employmentInfo.contractEndDate || null,
          contract_renewable: formData.employmentInfo.contractRenewable || false,
          has_outstanding_loans: formData.employmentInfo.hasOutstandingLoans,
          loan_repayment_amount: formData.employmentInfo.loanRepaymentAmount || null,
          has_savings_account: formData.employmentInfo.hasSavingsAccount,
          savings_amount: formData.employmentInfo.savingsAmount || null,
          employee_id_number: formData.employmentInfo.employeeIdNumber,
          mandate_number: formData.employmentInfo.mandateNumber || null,
          mandate_pin: formData.employmentInfo.mandatePin || null
        };
        
        const response = await createApplication(applicationData);
        setApplicationId(response.id);
        
        // Create emergency contact
        await supabase.from('emergency_contacts').insert({
          user_id: user?.id,
          application_id: response.id,
          first_name: formData.emergencyContact.firstName,
          last_name: formData.emergencyContact.lastName,
          whatsapp_number: formData.emergencyContact.whatsappNumber,
          residence_address: formData.emergencyContact.residenceAddress
        });
        
        // Create employer information
        await supabase.from('employer_information').insert({
          application_id: response.id,
          company_name: formData.employerInfo.companyName,
          company_website: formData.employerInfo.companyWebsite || null,
          company_location: formData.employerInfo.companyLocation,
          company_location_gps: formData.employerInfo.companyLocationGps || null,
          company_phone: formData.employerInfo.companyPhone,
          supervisor_name: formData.employerInfo.supervisorName,
          supervisor_phone: formData.employerInfo.supervisorPhone
        });
        
        // Update user profile with personal information
        await supabase.from('profiles').update({
          gender: formData.personalInfo.gender,
          date_of_birth: formData.personalInfo.dateOfBirth,
          marital_status: formData.personalInfo.maritalStatus,
          education_level: formData.personalInfo.educationLevel,
          whatsapp_number: formData.personalInfo.whatsappNumber,
          heard_from: formData.personalInfo.heardFrom
        }).eq('id', user?.id);
        
        // Upload documents
        await uploadDocuments(response.id);
        
        toast.success('Document upload fee paid successfully. Your application is now pending review.');
        navigate('/dashboard');
      } else if (paymentStep === 'deposit_interest') {
        // Calculate prorated rent if landlord payment date is after 15th
        const landlordPaymentDate = new Date(formData.landlordPaymentDate);
        const dayOfMonth = landlordPaymentDate.getDate();
        
        let proratedRent = 0;
        if (dayOfMonth >= 15) {
          // Calculate days remaining in the month
          const daysInMonth = new Date(
            landlordPaymentDate.getFullYear(),
            landlordPaymentDate.getMonth() + 1,
            0
          ).getDate();
          
          const daysRemaining = daysInMonth - dayOfMonth + 1;
          const dailyRent = monthlyRent / daysInMonth;
          proratedRent = dailyRent * daysRemaining;
        }
        
        // Process deposit and interest payment
        const depositAndInterest = calculateDepositAndInterest(monthlyRent, paymentTerm);
        const totalPayment = depositAndInterest.total + proratedRent;
        
        await paymentService.verifyPayment({
          reference,
          amount: totalPayment,
          applicationId: applicationId || ''
        });
        
        // Update application status to approved
        if (applicationId) {
          await useUserStore.getState().updateApplication(applicationId, {
            status: 'approved',
            prorated_rent: proratedRent
          });
        }
        
        toast.success('Payment successful! Your application has been approved.');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Payment or application submission error:', error);
      toast.error('Failed to process payment. Please try again.');
    }
  };

  const monthlyRent = formData.monthlyRent ? parseFloat(formData.monthlyRent) : 0;
  const paymentTerm = parseInt(formData.paymentTerm || '12');
  const initialPayment = calculateInitialPayment(monthlyRent, paymentTerm);
  const documentReviewFee = calculateDocumentReviewFee(monthlyRent);
  const depositAndInterest = calculateDepositAndInterest(monthlyRent, paymentTerm);
  
  // Calculate prorated rent if applicable
  const landlordPaymentDate = formData.landlordPaymentDate ? new Date(formData.landlordPaymentDate) : null;
  let proratedRent = 0;
  
  if (landlordPaymentDate) {
    const dayOfMonth = landlordPaymentDate.getDate();
    if (dayOfMonth >= 15) {
      const daysInMonth = new Date(
        landlordPaymentDate.getFullYear(),
        landlordPaymentDate.getMonth() + 1,
        0
      ).getDate();
      
      const daysRemaining = daysInMonth - dayOfMonth + 1;
      const dailyRent = monthlyRent / daysInMonth;
      proratedRent = dailyRent * daysRemaining;
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name*
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={formData.personalInfo.firstName}
                  onChange={(e) => handleInputChange('personalInfo', 'firstName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name*
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={formData.personalInfo.lastName}
                  onChange={(e) => handleInputChange('personalInfo', 'lastName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender*
                </label>
                <select
                  id="gender"
                  value={formData.personalInfo.gender}
                  onChange={(e) => handleInputChange('personalInfo', 'gender', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth*
                </label>
                <input
                  type="date"
                  id="dateOfBirth"
                  value={formData.personalInfo.dateOfBirth}
                  onChange={(e) => handleInputChange('personalInfo', 'dateOfBirth', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="maritalStatus" className="block text-sm font-medium text-gray-700 mb-1">
                  Marital Status*
                </label>
                <select
                  id="maritalStatus"
                  value={formData.personalInfo.maritalStatus}
                  onChange={(e) => handleInputChange('personalInfo', 'maritalStatus', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="educationLevel" className="block text-sm font-medium text-gray-700 mb-1">
                  Highest Level of Education*
                </label>
                <select
                  id="educationLevel"
                  value={formData.personalInfo.educationLevel}
                  onChange={(e) => handleInputChange('personalInfo', 'educationLevel', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select Education Level</option>
                  <option value="primary">Primary</option>
                  <option value="jhs">JHS</option>
                  <option value="shs">SHS</option>
                  <option value="diploma">Diploma</option>
                  <option value="bachelors">Bachelor's Degree</option>
                  <option value="masters">Master's Degree</option>
                  <option value="doctorate">Doctorate</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  WhatsApp Number*
                </label>
                <input
                  type="tel"
                  id="whatsappNumber"
                  value={formData.personalInfo.whatsappNumber}
                  onChange={(e) => handleInputChange('personalInfo', 'whatsappNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address*
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.personalInfo.email}
                  onChange={(e) => handleInputChange('personalInfo', 'email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label htmlFor="currentResidence" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Place of Residence*
                </label>
                <input
                  type="text"
                  id="currentResidence"
                  value={formData.personalInfo.currentResidence}
                  onChange={(e) => handleInputChange('personalInfo', 'currentResidence', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label htmlFor="heardFrom" className="block text-sm font-medium text-gray-700 mb-1">
                  How did you hear about us?*
                </label>
                <select
                  id="heardFrom"
                  value={formData.personalInfo.heardFrom}
                  onChange={(e) => handleInputChange('personalInfo', 'heardFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select an option</option>
                  <option value="social_media">Social Media</option>
                  <option value="friend">Friend or Family</option>
                  <option value="search_engine">Search Engine</option>
                  <option value="advertisement">Advertisement</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <Button 
                onClick={nextStep}
                disabled={!validateStep(1)}
              >
                Next: Emergency Contact
              </Button>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Emergency Contact</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="ecFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name*
                </label>
                <input
                  type="text"
                  id="ecFirstName"
                  value={formData.emergencyContact.firstName}
                  onChange={(e) => handleInputChange('emergencyContact', 'firstName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="ecLastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name*
                </label>
                <input
                  type="text"
                  id="ecLastName"
                  value={formData.emergencyContact.lastName}
                  onChange={(e) => handleInputChange('emergencyContact', 'lastName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="ecWhatsappNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  WhatsApp Number*
                </label>
                <input
                  type="tel"
                  id="ecWhatsappNumber"
                  value={formData.emergencyContact.whatsappNumber}
                  onChange={(e) => handleInputChange('emergencyContact', 'whatsappNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label htmlFor="ecResidenceAddress" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Place of Residence (GPS Address)*
                </label>
                <input
                  type="text"
                  id="ecResidenceAddress"
                  value={formData.emergencyContact.residenceAddress}
                  onChange={(e) => handleInputChange('emergencyContact', 'residenceAddress', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-between mt-6">
              <Button 
                variant="outline" 
                onClick={prevStep}
              >
                Previous: Personal Information
              </Button>
              <Button 
                onClick={nextStep}
                disabled={!validateStep(2)}
              >
                Next: Employment Information
              </Button>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Employment Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="employmentStatus" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Employment Status*
                </label>
                <select
                  id="employmentStatus"
                  value={formData.employmentInfo.status}
                  onChange={(e) => handleInputChange('employmentInfo', 'status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="full-time">Full-time Employee</option>
                  <option value="part-time">Part-time Employee</option>
                  <option value="contract">Contract Worker</option>
                  <option value="self-employed">Self-employed</option>
                  <option value="unemployed">Unemployed</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="employmentType" className="block text-sm font-medium text-gray-700 mb-1">
                  Type of Employment*
                </label>
                <input
                  type="text"
                  id="employmentType"
                  value={formData.employmentInfo.type}
                  onChange={(e) => handleInputChange('employmentInfo', 'type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  placeholder="e.g., CAGD Payroll, Non-CAGD Payroll, Private Sector"
                />
              </div>
              
              {formData.employmentInfo.status === 'contract' && (
                <>
                  <div>
                    <label htmlFor="contractEndDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Contract End Date*
                    </label>
                    <input
                      type="date"
                      id="contractEndDate"
                      value={formData.employmentInfo.contractEndDate}
                      onChange={(e) => handleInputChange('employmentInfo', 'contractEndDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contractRenewable" className="block text-sm font-medium text-gray-700 mb-1">
                      Is Contract Renewable?
                    </label>
                    <select
                      id="contractRenewable"
                      value={formData.employmentInfo.contractRenewable ? 'yes' : 'no'}
                      onChange={(e) => handleInputChange('employmentInfo', 'contractRenewable', e.target.value === 'yes')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </>
              )}
              
              <div>
                <label htmlFor="hasOutstandingLoans" className="block text-sm font-medium text-gray-700 mb-1">
                  Any Outstanding Loans?*
                </label>
                <select
                  id="hasOutstandingLoans"
                  value={formData.employmentInfo.hasOutstandingLoans ? 'yes' : 'no'}
                  onChange={(e) => handleInputChange('employmentInfo', 'hasOutstandingLoans', e.target.value === 'yes')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              
              {formData.employmentInfo.hasOutstandingLoans && (
                <div>
                  <label htmlFor="loanRepaymentAmount" className="block text-sm font-medium text-gray-700 mb-1">
                    Repayment Amount (GH₵)*
                  </label>
                  <input
                    type="number"
                    id="loanRepaymentAmount"
                    value={formData.employmentInfo.loanRepaymentAmount || ''}
                    onChange={(e) => handleInputChange('employmentInfo', 'loanRepaymentAmount', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              )}
              
              <div>
                <label htmlFor="monthlyIncome" className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Income (GH₵)*
                </label>
                <input
                  type="number"
                  id="monthlyIncome"
                  value={formData.employmentInfo.monthlyIncome || ''}
                  onChange={(e) => handleInputChange('employmentInfo', 'monthlyIncome', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="employmentStartDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Start Date*
                </label>
                <input
                  type="date"
                  id="employmentStartDate"
                  value={formData.employmentInfo.employmentStartDate}
                  onChange={(e) => handleInputChange('employmentInfo', 'employmentStartDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="employeeIdNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Employee/Staff ID Number*
                </label>
                <input
                  type="text"
                  id="employeeIdNumber"
                  value={formData.employmentInfo.employeeIdNumber}
                  onChange={(e) => handleInputChange('employmentInfo', 'employeeIdNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              {formData.employmentInfo.type.toLowerCase().includes('cagd') && (
                <>
                  <div>
                    <label htmlFor="mandateNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Mandate Number (for CAGD Applicants)*
                    </label>
                    <input
                      type="text"
                      id="mandateNumber"
                      value={formData.employmentInfo.mandateNumber}
                      onChange={(e) => handleInputChange('employmentInfo', 'mandateNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="mandatePin" className="block text-sm font-medium text-gray-700 mb-1">
                      Mandate PIN (for CAGD Applicants)*
                    </label>
                    <input
                      type="text"
                      id="mandatePin"
                      value={formData.employmentInfo.mandatePin}
                      onChange={(e) => handleInputChange('employmentInfo', 'mandatePin', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </>
              )}
              
              <div>
                <label htmlFor="hasSavingsAccount" className="block text-sm font-medium text-gray-700 mb-1">
                  Any Savings or Investment Account?*
                </label>
                <select
                  id="hasSavingsAccount"
                  value={formData.employmentInfo.hasSavingsAccount ? 'yes' : 'no'}
                  onChange={(e) => handleInputChange('employmentInfo', 'hasSavingsAccount', e.target.value === 'yes')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              
              {formData.employmentInfo.hasSavingsAccount && (
                <div>
                  <label htmlFor="savingsAmount" className="block text-sm font-medium text-gray-700 mb-1">
                    Amount in Savings (GH₵)*
                  </label>
                  <input
                    type="number"
                    id="savingsAmount"
                    value={formData.employmentInfo.savingsAmount || ''}
                    onChange={(e) => handleInputChange('employmentInfo', 'savingsAmount', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-between mt-6">
              <Button 
                variant="outline" 
                onClick={prevStep}
              >
                Previous: Emergency Contact
              </Button>
              <Button 
                onClick={nextStep}
                disabled={!validateStep(3)}
              >
                Next: Employer Information
              </Button>
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Employer Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                  Company's Name*
                </label>
                <input
                  type="text"
                  id="companyName"
                  value={formData.employerInfo.companyName}
                  onChange={(e) => handleInputChange('employerInfo', 'companyName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700 mb-1">
                  Company's Website
                </label>
                <input
                  type="url"
                  id="companyWebsite"
                  value={formData.employerInfo.companyWebsite}
                  onChange={(e) => handleInputChange('employerInfo', 'companyWebsite', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="https://example.com"
                />
              </div>
              
              <div>
                <label htmlFor="companyLocation" className="block text-sm font-medium text-gray-700 mb-1">
                  Company's Location*
                </label>
                <input
                  type="text"
                  id="companyLocation"
                  value={formData.employerInfo.companyLocation}
                  onChange={(e) => handleInputChange('employerInfo', 'companyLocation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="companyLocationGps" className="block text-sm font-medium text-gray-700 mb-1">
                  Company's Location (GPS)
                </label>
                <input
                  type="text"
                  id="companyLocationGps"
                  value={formData.employerInfo.companyLocationGps}
                  onChange={(e) => handleInputChange('employerInfo', 'companyLocationGps', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., GA-123-4567"
                />
              </div>
              
              <div>
                <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Company's Phone Number*
                </label>
                <input
                  type="tel"
                  id="companyPhone"
                  value={formData.employerInfo.companyPhone}
                  onChange={(e) => handleInputChange('employerInfo', 'companyPhone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="supervisorName" className="block text-sm font-medium text-gray-700 mb-1">
                  Supervisor's Name*
                </label>
                <input
                  type="text"
                  id="supervisorName"
                  value={formData.employerInfo.supervisorName}
                  onChange={(e) => handleInputChange('employerInfo', 'supervisorName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="supervisorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Supervisor's Phone Number*
                </label>
                <input
                  type="tel"
                  id="supervisorPhone"
                  value={formData.employerInfo.supervisorPhone}
                  onChange={(e) => handleInputChange('employerInfo', 'supervisorPhone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-between mt-6">
              <Button 
                variant="outline" 
                onClick={prevStep}
              >
                Previous: Employment Information
              </Button>
              <Button 
                onClick={nextStep}
                disabled={!validateStep(4)}
              >
                Next: Rental Information
              </Button>
            </div>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Rental Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="monthlyRent" className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Rent Amount (GH₵)*
                </label>
                <input
                  type="number"
                  id="monthlyRent"
                  name="monthlyRent"
                  value={formData.monthlyRent}
                  onChange={(e) => handleInputChange('monthlyRent', '', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="paymentTerm" className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Term*
                </label>
                <select
                  id="paymentTerm"
                  name="paymentTerm"
                  value={formData.paymentTerm}
                  onChange={(e) => handleInputChange('paymentTerm', '', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="6">6 Months</option>
                  <option value="12">12 Months</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="leaseStartDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Lease Start Date*
                </label>
                <input
                  type="date"
                  id="leaseStartDate"
                  name="leaseStartDate"
                  value={formData.leaseStartDate}
                  onChange={(e) => handleInputChange('leaseStartDate', '', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="leaseEndDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Lease End Date*
                </label>
                <input
                  type="date"
                  id="leaseEndDate"
                  name="leaseEndDate"
                  value={formData.leaseEndDate}
                  onChange={(e) => handleInputChange('leaseEndDate', '', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="propertyAddress" className="block text-sm font-medium text-gray-700 mb-1">
                  Property Address*
                </label>
                <input
                  type="text"
                  id="propertyAddress"
                  name="propertyAddress"
                  value={formData.propertyAddress}
                  onChange={(e) => handleInputChange('propertyAddress', '', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="landlordName" className="block text-sm font-medium text-gray-700 mb-1">
                  Landlord Name*
                </label>
                <input
                  type="text"
                  id="landlordName"
                  name="landlordName"
                  value={formData.landlordName}
                  onChange={(e) => handleInputChange('landlordName', '', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="landlordPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Landlord Phone*
                </label>
                <input
                  type="tel"
                  id="landlordPhone"
                  name="landlordPhone"
                  value={formData.landlordPhone}
                  onChange={(e) => handleInputChange('landlordPhone', '', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="landlordPaymentDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Landlord Payment Date*
                </label>
                <input
                  type="date"
                  id="landlordPaymentDate"
                  name="landlordPaymentDate"
                  value={formData.landlordPaymentDate}
                  onChange={(e) => handleInputChange('landlordPaymentDate', '', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Date when ShelterCrest will pay your landlord
                </p>
              </div>
            </div>
            
            <div className="flex justify-between mt-6">
              <Button 
                variant="outline" 
                onClick={prevStep}
              >
                Previous: Employer Information
              </Button>
              <Button 
                onClick={nextStep}
                disabled={!validateStep(5)}
              >
                Next: Document Upload
              </Button>
            </div>
          </div>
        );
      
      case 6:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Document Upload</h2>
            
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <div className="flex">
                <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />
                <div>
                  <h3 className="font-medium text-blue-800">Document Requirements</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Please upload all required documents. All documents must be clear and legible.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              {REQUIRED_DOCUMENTS.map((doc) => (
                <div 
                  key={doc.id} 
                  className="p-4 border rounded-lg flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="flex items-center">
                      <span className="font-medium">{doc.label}</span>
                      {doc.required && (
                        <span className="ml-2 text-xs text-red-500">*Required</span>
                      )}
                    </div>
                    <div className="mt-1">
                      {formData.documents[doc.id].file ? (
                        <div className="flex items-center text-green-600">
                          <Check size={16} className="mr-1" />
                          <span>{formData.documents[doc.id].file.name}</span>
                          <button 
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                documents: {
                                  ...prev.documents,
                                  [doc.id]: {
                                    ...prev.documents[doc.id],
                                    file: null,
                                    status: 'pending'
                                  }
                                }
                              }));
                            }}
                            className="ml-2 text-red-500 hover:text-red-700"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">No file selected</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={formData.documents[doc.id].file ? "outline" : "primary"}
                    leftIcon={<Upload size={16} />}
                    onClick={() => handleUploadDocument(doc.id)}
                    isLoading={isUploading && currentDocType === doc.id}
                  >
                    {formData.documents[doc.id].file ? "Change" : "Upload"}
                  </Button>
                </div>
              ))}
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
            
            <div className="flex justify-between mt-6">
              <Button 
                variant="outline" 
                onClick={prevStep}
              >
                Previous: Rental Information
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!validateStep(6) || loading}
                isLoading={loading}
              >
                Submit Application
              </Button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Rent Assistance Application</h1>
      
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5, 6].map((step) => (
            <div key={step} className="flex items-center">
              <div 
                className={`flex items-center justify-center h-8 w-8 rounded-full border-2 
                  ${step < currentStep 
                    ? 'bg-primary-800 border-primary-800 text-white' 
                    : step === currentStep 
                      ? 'border-primary-800 text-primary-800' 
                      : 'border-gray-300 text-gray-300'}`}
              >
                {step < currentStep ? <Check size={16} /> : step}
              </div>
              
              {step < 6 && (
                <div 
                  className={`w-12 sm:w-24 h-1 mx-2 
                    ${step < currentStep ? 'bg-primary-800' : 'bg-gray-300'}`}
                ></div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Personal</span>
          <span>Emergency</span>
          <span>Employment</span>
          <span>Employer</span>
          <span>Rental</span>
          <span>Documents</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <form className="space-y-6 p-6">
              {renderStepContent()}
            </form>
          </Card>
        </div>
        
        <div>
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Payment Summary</h2>
              
              <PaymentSummary
                monthlyRent={monthlyRent}
                initialPaymentRequired={initialPayment.initialPaymentRequired}
                serviceFee={initialPayment.serviceFee}
                propertyInspectionFee={initialPayment.propertyInspectionFee}
                documentUploadFee={initialPayment.documentUploadFee}
                totalAmount={initialPayment.total + proratedRent}
                proratedRent={proratedRent}
                landlordPaymentDate={landlordPaymentDate}
                paymentTerm={paymentTerm}
                isInitialDocumentFee={currentStep === 6}
              />
            </div>
          </Card>
        </div>
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        amount={paymentStep === 'document_review' 
          ? documentReviewFee.total 
          : depositAndInterest.total + proratedRent}
        dueDate={new Date().toISOString()}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default ApplicationForm;
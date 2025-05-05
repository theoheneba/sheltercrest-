import { useState, useEffect } from 'react';
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
import { ApplicationFormData } from '../../types/application';
import { supabase } from '../../services/db';

const EnhancedApplicationForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isEligible, isLoading, redirectToEligibilityCheck } = useConditionalEligibility();
  const { 
    createApplication, 
    applications, 
    fetchApplications, 
    loading,
    createEmergencyContact,
    createEmployerInfo
  } = useUserStore();
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'document_review' | 'deposit_interest'>('document_review');
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
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
    documents: {},
    monthlyRent: 0,
    depositAmount: 0,
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
      
      // Populate personal info from user profile
      if (user) {
        setFormData(prev => ({
          ...prev,
          personalInfo: {
            ...prev.personalInfo,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || ''
          }
        }));
        
        // Fetch additional profile data
        supabase
          .from('profiles')
          .select('gender, date_of_birth, marital_status, education_level, whatsapp_number, address, heard_from')
          .eq('id', user.id)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              setFormData(prev => ({
                ...prev,
                personalInfo: {
                  ...prev.personalInfo,
                  gender: data.gender as any || 'male',
                  dateOfBirth: data.date_of_birth || '',
                  maritalStatus: data.marital_status as any || 'single',
                  educationLevel: data.education_level || '',
                  whatsappNumber: data.whatsapp_number || '',
                  currentResidence: data.address || '',
                  heardFrom: data.heard_from || ''
                }
              }));
            }
          });
      }
      
      // Populate application data
      setFormData(prev => ({
        ...prev,
        monthlyRent: latestApplication.monthly_rent,
        depositAmount: latestApplication.deposit_amount,
        landlordName: latestApplication.landlord_name,
        landlordPhone: latestApplication.landlord_phone,
        propertyAddress: latestApplication.property_address,
        leaseStartDate: latestApplication.lease_start_date,
        leaseEndDate: latestApplication.lease_end_date,
        landlordPaymentDate: latestApplication.landlord_payment_date || '',
        paymentTerm: latestApplication.payment_term?.toString() || '12'
      }));
      
      // Populate employment info
      setFormData(prev => ({
        ...prev,
        employmentInfo: {
          ...prev.employmentInfo,
          status: 'full-time',
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
      
      // Fetch emergency contact if exists
      if (latestApplication.emergency_contacts && latestApplication.emergency_contacts.length > 0) {
        const emergencyContact = latestApplication.emergency_contacts[0];
        setFormData(prev => ({
          ...prev,
          emergencyContact: {
            firstName: emergencyContact.first_name,
            lastName: emergencyContact.last_name,
            whatsappNumber: emergencyContact.whatsapp_number,
            residenceAddress: emergencyContact.residence_address
          }
        }));
      }
      
      // Fetch employer info if exists
      if (latestApplication.employer_information && latestApplication.employer_information.length > 0) {
        const employerInfo = latestApplication.employer_information[0];
        setFormData(prev => ({
          ...prev,
          employerInfo: {
            companyName: employerInfo.company_name,
            companyWebsite: employerInfo.company_website || '',
            companyLocation: employerInfo.company_location,
            companyLocationGps: employerInfo.company_location_gps || '',
            companyPhone: employerInfo.company_phone,
            supervisorName: employerInfo.supervisor_name,
            supervisorPhone: employerInfo.supervisor_phone
          }
        }));
      }
    }
  }, [applications, user]);

  useEffect(() => {
    if (!isLoading && !isEligible) {
      redirectToEligibilityCheck();
    }
  }, [isEligible, isLoading, redirectToEligibilityCheck]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isEligible) {
    return null; // Component will redirect in useEffect
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    section: keyof ApplicationFormData
  ) => {
    const { name, value, type } = e.target;
    
    // Handle checkbox inputs
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [name]: checked
        }
      }));
      return;
    }
    
    // Handle all other inputs
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [name]: value
      }
    }));
    
    // Calculate all fees when monthly rent changes
    if (section === 'monthlyRent' && value) {
      const monthlyRent = parseFloat(value);
      const paymentTerm = parseInt(formData.paymentTerm);
      const { initialPaymentRequired, serviceFee, propertyInspectionFee, documentUploadFee, total } = calculateInitialPayment(monthlyRent, paymentTerm);
      setFormData(prev => ({
        ...prev,
        depositAmount: initialPaymentRequired,
        serviceFee,
        visitFee: propertyInspectionFee,
        processingFee: documentUploadFee,
        totalInitialPayment: total
      }));
    }
    
    // Recalculate when payment term changes
    if (name === 'paymentTerm' && formData.monthlyRent) {
      const monthlyRent = formData.monthlyRent;
      const paymentTerm = parseInt(value);
      const { initialPaymentRequired, serviceFee, propertyInspectionFee, documentUploadFee, total } = calculateInitialPayment(monthlyRent, paymentTerm);
      setFormData(prev => ({
        ...prev,
        depositAmount: initialPaymentRequired,
        serviceFee,
        visitFee: propertyInspectionFee,
        processingFee: documentUploadFee,
        totalInitialPayment: total
      }));
    }
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1: // Personal Information
        if (!formData.personalInfo.firstName || !formData.personalInfo.lastName || 
            !formData.personalInfo.email || !formData.personalInfo.whatsappNumber ||
            !formData.personalInfo.dateOfBirth || !formData.personalInfo.currentResidence) {
          toast.error('Please fill in all required personal information fields');
          return false;
        }
        break;
      case 2: // Emergency Contact
        if (!formData.emergencyContact.firstName || !formData.emergencyContact.lastName || 
            !formData.emergencyContact.whatsappNumber || !formData.emergencyContact.residenceAddress) {
          toast.error('Please fill in all emergency contact fields');
          return false;
        }
        break;
      case 3: // Employment Information
        if (!formData.employmentInfo.monthlyIncome || !formData.employmentInfo.employmentStartDate ||
            !formData.employerInfo.companyName || !formData.employerInfo.companyLocation ||
            !formData.employerInfo.companyPhone || !formData.employerInfo.supervisorName ||
            !formData.employerInfo.supervisorPhone) {
          toast.error('Please fill in all required employment information fields');
          return false;
        }
        break;
      case 4: // Rental Information
        if (!formData.monthlyRent || !formData.landlordName || !formData.landlordPhone ||
            !formData.propertyAddress || !formData.leaseStartDate || !formData.leaseEndDate ||
            !formData.landlordPaymentDate) {
          toast.error('Please fill in all required rental information fields');
          return false;
        }
        break;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCurrentStep()) {
      return;
    }
    
    if (currentStep < totalSteps) {
      nextStep();
      return;
    }
    
    try {
      // Validate required fields
      const requiredFields = [
        'monthlyRent',
        'landlordName',
        'landlordPhone',
        'propertyAddress',
        'leaseStartDate',
        'leaseEndDate',
        'landlordPaymentDate',
        'paymentTerm'
      ];

      const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
      
      if (missingFields.length > 0) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Calculate document review fee
      const monthlyRent = formData.monthlyRent;
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
      const monthlyRent = formData.monthlyRent;
      const paymentTerm = parseInt(formData.paymentTerm);
      
      if (paymentStep === 'document_review') {
        // Process document review fee payment
        await paymentService.verifyPayment({
          reference,
          amount: calculateDocumentReviewFee(monthlyRent).total,
          applicationId: 'document_review_fee'
        });
        
        // Create application in pending status
        const response = await createApplication({
          monthly_rent: monthlyRent,
          deposit_amount: formData.depositAmount,
          interest_amount: monthlyRent * 0.2808 * paymentTerm, // Calculate interest
          service_fee: calculateInitialPayment(monthlyRent, paymentTerm).serviceFee,
          visit_fee: calculateInitialPayment(monthlyRent, paymentTerm).propertyInspectionFee,
          processing_fee: calculateInitialPayment(monthlyRent, paymentTerm).documentUploadFee,
          total_initial_payment: calculateInitialPayment(monthlyRent, paymentTerm).total,
          landlord_name: formData.landlordName,
          landlord_phone: formData.landlordPhone,
          property_address: formData.propertyAddress,
          lease_start_date: formData.leaseStartDate,
          lease_end_date: formData.leaseEndDate,
          landlord_payment_date: formData.landlordPaymentDate,
          payment_term: parseInt(formData.paymentTerm),
          prorated_rent: 0, // Will be calculated after approval
          status: 'pending',
          // Additional fields
          contract_end_date: formData.employmentInfo.contractEndDate,
          contract_renewable: formData.employmentInfo.contractRenewable,
          has_outstanding_loans: formData.employmentInfo.hasOutstandingLoans,
          loan_repayment_amount: formData.employmentInfo.loanRepaymentAmount,
          has_savings_account: formData.employmentInfo.hasSavingsAccount,
          savings_amount: formData.employmentInfo.savingsAmount,
          employee_id_number: formData.employmentInfo.employeeIdNumber,
          mandate_number: formData.employmentInfo.mandateNumber,
          mandate_pin: formData.employmentInfo.mandatePin
        });
        
        setApplicationId(response.id);
        
        // Create emergency contact
        await createEmergencyContact({
          application_id: response.id,
          first_name: formData.emergencyContact.firstName,
          last_name: formData.emergencyContact.lastName,
          whatsapp_number: formData.emergencyContact.whatsappNumber,
          residence_address: formData.emergencyContact.residenceAddress
        });
        
        // Create employer information
        await createEmployerInfo({
          application_id: response.id,
          company_name: formData.employerInfo.companyName,
          company_website: formData.employerInfo.companyWebsite,
          company_location: formData.employerInfo.companyLocation,
          company_location_gps: formData.employerInfo.companyLocationGps,
          company_phone: formData.employerInfo.companyPhone,
          supervisor_name: formData.employerInfo.supervisorName,
          supervisor_phone: formData.employerInfo.supervisorPhone
        });
        
        // Update user profile with additional information
        if (user) {
          await supabase
            .from('profiles')
            .update({
              gender: formData.personalInfo.gender,
              date_of_birth: formData.personalInfo.dateOfBirth,
              marital_status: formData.personalInfo.maritalStatus,
              education_level: formData.personalInfo.educationLevel,
              whatsapp_number: formData.personalInfo.whatsappNumber,
              address: formData.personalInfo.currentResidence,
              heard_from: formData.personalInfo.heardFrom,
              employment_status: formData.employmentInfo.status,
              employer_name: formData.employerInfo.companyName,
              employment_start_date: formData.employmentInfo.employmentStartDate,
              monthly_income: formData.employmentInfo.monthlyIncome
            })
            .eq('id', user.id);
        }
        
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

  const monthlyRent = formData.monthlyRent;
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
            <h2 className="text-xl font-semibold">Personal Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name*
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.personalInfo.firstName}
                  onChange={(e) => handleInputChange(e, 'personalInfo')}
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
                  name="lastName"
                  value={formData.personalInfo.lastName}
                  onChange={(e) => handleInputChange(e, 'personalInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender*
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.personalInfo.gender}
                  onChange={(e) => handleInputChange(e, 'personalInfo')}
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
                  name="dateOfBirth"
                  value={formData.personalInfo.dateOfBirth}
                  onChange={(e) => handleInputChange(e, 'personalInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="maritalStatus" className="block text-sm font-medium text-gray-700 mb-1">
                  Marital Status*
                </label>
                <select
                  id="maritalStatus"
                  name="maritalStatus"
                  value={formData.personalInfo.maritalStatus}
                  onChange={(e) => handleInputChange(e, 'personalInfo')}
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
                  Education Level*
                </label>
                <select
                  id="educationLevel"
                  name="educationLevel"
                  value={formData.personalInfo.educationLevel}
                  onChange={(e) => handleInputChange(e, 'personalInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select education level</option>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="diploma">Diploma</option>
                  <option value="bachelor">Bachelor's Degree</option>
                  <option value="master">Master's Degree</option>
                  <option value="phd">PhD</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email*
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.personalInfo.email}
                  onChange={(e) => handleInputChange(e, 'personalInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  disabled={!!user?.email}
                />
              </div>
              
              <div>
                <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  WhatsApp Number*
                </label>
                <input
                  type="tel"
                  id="whatsappNumber"
                  name="whatsappNumber"
                  value={formData.personalInfo.whatsappNumber}
                  onChange={(e) => handleInputChange(e, 'personalInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  placeholder="e.g., 0244123456"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="currentResidence" className="block text-sm font-medium text-gray-700 mb-1">
                Current Residence Address*
              </label>
              <input
                type="text"
                id="currentResidence"
                name="currentResidence"
                value={formData.personalInfo.currentResidence}
                onChange={(e) => handleInputChange(e, 'personalInfo')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="heardFrom" className="block text-sm font-medium text-gray-700 mb-1">
                How did you hear about us?
              </label>
              <select
                id="heardFrom"
                name="heardFrom"
                value={formData.personalInfo.heardFrom}
                onChange={(e) => handleInputChange(e, 'personalInfo')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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
        );
      
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Emergency Contact</h2>
            <p className="text-sm text-gray-600 mb-4">
              Please provide details of someone we can contact in case of an emergency.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="ecFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name*
                </label>
                <input
                  type="text"
                  id="ecFirstName"
                  name="firstName"
                  value={formData.emergencyContact.firstName}
                  onChange={(e) => handleInputChange(e, 'emergencyContact')}
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
                  name="lastName"
                  value={formData.emergencyContact.lastName}
                  onChange={(e) => handleInputChange(e, 'emergencyContact')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="ecWhatsappNumber" className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp Number*
              </label>
              <input
                type="tel"
                id="ecWhatsappNumber"
                name="whatsappNumber"
                value={formData.emergencyContact.whatsappNumber}
                onChange={(e) => handleInputChange(e, 'emergencyContact')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                placeholder="e.g., 0244123456"
              />
            </div>
            
            <div>
              <label htmlFor="ecResidenceAddress" className="block text-sm font-medium text-gray-700 mb-1">
                Residence Address*
              </label>
              <input
                type="text"
                id="ecResidenceAddress"
                name="residenceAddress"
                value={formData.emergencyContact.residenceAddress}
                onChange={(e) => handleInputChange(e, 'emergencyContact')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Employment Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="employmentStatus" className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Status*
                </label>
                <select
                  id="employmentStatus"
                  name="status"
                  value={formData.employmentInfo.status}
                  onChange={(e) => handleInputChange(e, 'employmentInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="self-employed">Self-employed</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="employmentType" className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Type*
                </label>
                <select
                  id="employmentType"
                  name="type"
                  value={formData.employmentInfo.type}
                  onChange={(e) => handleInputChange(e, 'employmentInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select employment type</option>
                  <option value="cagd_payroll">CAGD Payroll (e.g., Teachers)</option>
                  <option value="non_cagd_payroll">Non-CAGD Payroll (e.g., Police)</option>
                  <option value="private_sector">Private Sector</option>
                  <option value="self_employed">Self-employed</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="monthlyIncome" className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Income (GH₵)*
                </label>
                <input
                  type="number"
                  id="monthlyIncome"
                  name="monthlyIncome"
                  value={formData.employmentInfo.monthlyIncome || ''}
                  onChange={(e) => handleInputChange(e, 'employmentInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  min="1000"
                />
                {formData.employmentInfo.monthlyIncome > 0 && formData.employmentInfo.monthlyIncome < 1000 && (
                  <p className="mt-1 text-sm text-red-600">Minimum monthly income is GH₵ 1,000</p>
                )}
              </div>
              
              <div>
                <label htmlFor="employmentStartDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Start Date*
                </label>
                <input
                  type="date"
                  id="employmentStartDate"
                  name="employmentStartDate"
                  value={formData.employmentInfo.employmentStartDate}
                  onChange={(e) => handleInputChange(e, 'employmentInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>
            
            {formData.employmentInfo.status === 'contract' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="contractEndDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Contract End Date*
                  </label>
                  <input
                    type="date"
                    id="contractEndDate"
                    name="contractEndDate"
                    value={formData.employmentInfo.contractEndDate}
                    onChange={(e) => handleInputChange(e, 'employmentInfo')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required={formData.employmentInfo.status === 'contract'}
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="contractRenewable"
                    name="contractRenewable"
                    checked={formData.employmentInfo.contractRenewable}
                    onChange={(e) => handleInputChange(e, 'employmentInfo')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="contractRenewable" className="ml-2 block text-sm text-gray-700">
                    Contract is renewable
                  </label>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="employeeIdNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID Number
                </label>
                <input
                  type="text"
                  id="employeeIdNumber"
                  name="employeeIdNumber"
                  value={formData.employmentInfo.employeeIdNumber}
                  onChange={(e) => handleInputChange(e, 'employmentInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              {(formData.employmentInfo.type === 'cagd_payroll' || formData.employmentInfo.type === 'non_cagd_payroll') && (
                <div>
                  <label htmlFor="mandateNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Mandate Number
                  </label>
                  <input
                    type="text"
                    id="mandateNumber"
                    name="mandateNumber"
                    value={formData.employmentInfo.mandateNumber}
                    onChange={(e) => handleInputChange(e, 'employmentInfo')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>
            
            {(formData.employmentInfo.type === 'cagd_payroll' || formData.employmentInfo.type === 'non_cagd_payroll') && (
              <div>
                <label htmlFor="mandatePin" className="block text-sm font-medium text-gray-700 mb-1">
                  Mandate PIN
                </label>
                <input
                  type="text"
                  id="mandatePin"
                  name="mandatePin"
                  value={formData.employmentInfo.mandatePin}
                  onChange={(e) => handleInputChange(e, 'employmentInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="hasOutstandingLoans"
                  name="hasOutstandingLoans"
                  checked={formData.employmentInfo.hasOutstandingLoans}
                  onChange={(e) => handleInputChange(e, 'employmentInfo')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="hasOutstandingLoans" className="ml-2 block text-sm text-gray-700">
                  I have outstanding loans
                </label>
              </div>
              
              {formData.employmentInfo.hasOutstandingLoans && (
                <div>
                  <label htmlFor="loanRepaymentAmount" className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Loan Repayment Amount (GH₵)
                  </label>
                  <input
                    type="number"
                    id="loanRepaymentAmount"
                    name="loanRepaymentAmount"
                    value={formData.employmentInfo.loanRepaymentAmount || ''}
                    onChange={(e) => handleInputChange(e, 'employmentInfo')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required={formData.employmentInfo.hasOutstandingLoans}
                  />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="hasSavingsAccount"
                  name="hasSavingsAccount"
                  checked={formData.employmentInfo.hasSavingsAccount}
                  onChange={(e) => handleInputChange(e, 'employmentInfo')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="hasSavingsAccount" className="ml-2 block text-sm text-gray-700">
                  I have a savings account
                </label>
              </div>
              
              {formData.employmentInfo.hasSavingsAccount && (
                <div>
                  <label htmlFor="savingsAmount" className="block text-sm font-medium text-gray-700 mb-1">
                    Savings Amount (GH₵)
                  </label>
                  <input
                    type="number"
                    id="savingsAmount"
                    name="savingsAmount"
                    value={formData.employmentInfo.savingsAmount || ''}
                    onChange={(e) => handleInputChange(e, 'employmentInfo')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required={formData.employmentInfo.hasSavingsAccount}
                  />
                </div>
              )}
            </div>
            
            <h3 className="text-lg font-semibold mt-6">Employer Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name*
                </label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.employerInfo.companyName}
                  onChange={(e) => handleInputChange(e, 'employerInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Website
                </label>
                <input
                  type="url"
                  id="companyWebsite"
                  name="companyWebsite"
                  value={formData.employerInfo.companyWebsite}
                  onChange={(e) => handleInputChange(e, 'employerInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="https://example.com"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="companyLocation" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Location*
                </label>
                <input
                  type="text"
                  id="companyLocation"
                  name="companyLocation"
                  value={formData.employerInfo.companyLocation}
                  onChange={(e) => handleInputChange(e, 'employerInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="companyLocationGps" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Location GPS
                </label>
                <input
                  type="text"
                  id="companyLocationGps"
                  name="companyLocationGps"
                  value={formData.employerInfo.companyLocationGps}
                  onChange={(e) => handleInputChange(e, 'employerInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., GA-123-4567"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 mb-1">
                Company Phone*
              </label>
              <input
                type="tel"
                id="companyPhone"
                name="companyPhone"
                value={formData.employerInfo.companyPhone}
                onChange={(e) => handleInputChange(e, 'employerInfo')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                placeholder="e.g., 0302123456"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="supervisorName" className="block text-sm font-medium text-gray-700 mb-1">
                  Supervisor Name*
                </label>
                <input
                  type="text"
                  id="supervisorName"
                  name="supervisorName"
                  value={formData.employerInfo.supervisorName}
                  onChange={(e) => handleInputChange(e, 'employerInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="supervisorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Supervisor Phone*
                </label>
                <input
                  type="tel"
                  id="supervisorPhone"
                  name="supervisorPhone"
                  value={formData.employerInfo.supervisorPhone}
                  onChange={(e) => handleInputChange(e, 'employerInfo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  placeholder="e.g., 0244123456"
                />
              </div>
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Rental Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="monthlyRent" className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Rent Amount (GH₵)*
                </label>
                <input
                  type="number"
                  id="monthlyRent"
                  name="monthlyRent"
                  value={formData.monthlyRent || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    monthlyRent: parseFloat(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  min="250"
                />
                {formData.monthlyRent > 0 && formData.monthlyRent < 250 && (
                  <p className="mt-1 text-sm text-red-600">Minimum monthly rent is GH₵ 250</p>
                )}
              </div>
              
              <div>
                <label htmlFor="paymentTerm" className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Term*
                </label>
                <select
                  id="paymentTerm"
                  name="paymentTerm"
                  value={formData.paymentTerm}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    paymentTerm: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="6">6 Months</option>
                  <option value="12">12 Months</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="leaseStartDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Lease Start Date*
                </label>
                <input
                  type="date"
                  id="leaseStartDate"
                  name="leaseStartDate"
                  value={formData.leaseStartDate}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    leaseStartDate: e.target.value
                  }))}
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
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    leaseEndDate: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
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
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  propertyAddress: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="landlordName" className="block text-sm font-medium text-gray-700 mb-1">
                  Landlord Name*
                </label>
                <input
                  type="text"
                  id="landlordName"
                  name="landlordName"
                  value={formData.landlordName}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    landlordName: e.target.value
                  }))}
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
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    landlordPhone: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
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
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  landlordPaymentDate: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Date when ShelterCrest will pay your landlord
              </p>
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
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className="flex items-center">
              <div className={`flex items-center justify-center h-8 w-8 rounded-full border-2 
                ${i + 1 <= currentStep 
                  ? 'bg-primary-600 border-primary-600 text-white' 
                  : 'border-gray-300 text-gray-300'}`}
              >
                {i + 1}
              </div>
              
              {i < totalSteps - 1 && (
                <div className={`w-12 sm:w-24 h-1 mx-2 
                  ${i + 1 < currentStep ? 'bg-primary-600' : 'bg-gray-300'}`}
                ></div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Personal Info</span>
          <span>Emergency Contact</span>
          <span>Employment</span>
          <span>Rental Details</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              {renderStepContent()}
              
              <div className="flex justify-between mt-6">
                {currentStep > 1 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={prevStep}
                  >
                    Previous
                  </Button>
                )}
                
                <div className={`${currentStep > 1 ? 'ml-auto' : ''}`}>
                  <Button 
                    type="submit" 
                    isLoading={loading}
                  >
                    {currentStep < totalSteps ? "Next" : "Submit Application"}
                  </Button>
                </div>
              </div>
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
                isInitialDocumentFee={true}
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

export default EnhancedApplicationForm;
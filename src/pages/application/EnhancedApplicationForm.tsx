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
import { ApplicationFormData, EmergencyContact, EmployerInformation } from '../../types/application';
import { RefreshCw, AlertCircle } from 'lucide-react';

const EnhancedApplicationForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isEligible, isLoading, redirectToEligibilityCheck } = useConditionalEligibility();
  const { 
    createApplication, 
    applications, 
    fetchApplications, 
    loading, 
    error,
    createEmergencyContact,
    createEmployerInfo
  } = useUserStore();
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'document_review' | 'deposit_interest'>('document_review');
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const [formData, setFormData] = useState({
    monthlyRent: '',
    depositAmount: '',
    serviceFee: '',
    visitFee: '',
    processingFee: '',
    totalInitialPayment: '',
    landlordName: '',
    landlordPhone: '',
    propertyAddress: '',
    leaseStartDate: '',
    leaseEndDate: '',
    landlordPaymentDate: '',
    paymentTerm: '12',
    // Emergency contact
    emergencyFirstName: '',
    emergencyLastName: '',
    emergencyWhatsappNumber: '',
    emergencyResidenceAddress: '',
    // Employer information
    companyName: '',
    companyWebsite: '',
    companyLocation: '',
    companyLocationGps: '',
    companyPhone: '',
    supervisorName: '',
    supervisorPhone: '',
    // Employment details
    employeeIdNumber: '',
    mandateNumber: '',
    mandatePin: '',
    hasOutstandingLoans: false,
    loanRepaymentAmount: '',
    hasSavingsAccount: false,
    savingsAmount: '',
    contractEndDate: '',
    contractRenewable: false
  });

  useEffect(() => {
    fetchApplications().catch(err => {
      console.error('Error fetching applications:', err);
      toast.error('Failed to load application data. Please try again.');
    });
  }, [fetchApplications]);

  useEffect(() => {
    // If user already has an application, populate the form with that data
    if (applications.length > 0) {
      const latestApplication = applications[0];
      setFormData(prev => ({
        ...prev,
        monthlyRent: latestApplication.monthly_rent?.toString() || '',
        depositAmount: latestApplication.deposit_amount?.toString() || '',
        serviceFee: latestApplication.service_fee?.toString() || '',
        visitFee: latestApplication.visit_fee?.toString() || '',
        processingFee: latestApplication.processing_fee?.toString() || '',
        totalInitialPayment: latestApplication.total_initial_payment?.toString() || '',
        landlordName: latestApplication.landlord_name || '',
        landlordPhone: latestApplication.landlord_phone || '',
        propertyAddress: latestApplication.property_address || '',
        leaseStartDate: latestApplication.lease_start_date || '',
        leaseEndDate: latestApplication.lease_end_date || '',
        landlordPaymentDate: latestApplication.landlord_payment_date || '',
        paymentTerm: latestApplication.payment_term?.toString() || '12',
        employeeIdNumber: latestApplication.employee_id_number || '',
        mandateNumber: latestApplication.mandate_number || '',
        mandatePin: latestApplication.mandate_pin || '',
        hasOutstandingLoans: latestApplication.has_outstanding_loans || false,
        loanRepaymentAmount: latestApplication.loan_repayment_amount?.toString() || '',
        hasSavingsAccount: latestApplication.has_savings_account || false,
        savingsAmount: latestApplication.savings_amount?.toString() || '',
        contractEndDate: latestApplication.contract_end_date || '',
        contractRenewable: latestApplication.contract_renewable || false
      }));
      
      setApplicationId(latestApplication.id);
      
      // If there's emergency contact data, populate it
      if (latestApplication.emergency_contacts && latestApplication.emergency_contacts.length > 0) {
        const emergencyContact = latestApplication.emergency_contacts[0];
        setFormData(prev => ({
          ...prev,
          emergencyFirstName: emergencyContact.first_name || '',
          emergencyLastName: emergencyContact.last_name || '',
          emergencyWhatsappNumber: emergencyContact.whatsapp_number || '',
          emergencyResidenceAddress: emergencyContact.residence_address || ''
        }));
      }
      
      // If there's employer information data, populate it
      if (latestApplication.employer_information && latestApplication.employer_information.length > 0) {
        const employerInfo = latestApplication.employer_information[0];
        setFormData(prev => ({
          ...prev,
          companyName: employerInfo.company_name || '',
          companyWebsite: employerInfo.company_website || '',
          companyLocation: employerInfo.company_location || '',
          companyLocationGps: employerInfo.company_location_gps || '',
          companyPhone: employerInfo.company_phone || '',
          supervisorName: employerInfo.supervisor_name || '',
          supervisorPhone: employerInfo.supervisor_phone || ''
        }));
      }
    }
  }, [applications]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Handle checkbox inputs
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Calculate all fees when monthly rent changes
    if (name === 'monthlyRent' && value) {
      const monthlyRent = parseFloat(value);
      const paymentTerm = parseInt(formData.paymentTerm);
      const { initialPaymentRequired, serviceFee, propertyInspectionFee, documentUploadFee, total } = calculateInitialPayment(monthlyRent, paymentTerm);
      setFormData(prev => ({
        ...prev,
        [name]: value,
        depositAmount: initialPaymentRequired.toString(),
        serviceFee: serviceFee.toString(),
        visitFee: propertyInspectionFee.toString(),
        processingFee: documentUploadFee.toString(),
        totalInitialPayment: total.toString()
      }));
    }
    
    // Recalculate when payment term changes
    if (name === 'paymentTerm' && formData.monthlyRent) {
      const monthlyRent = parseFloat(formData.monthlyRent);
      const paymentTerm = parseInt(value);
      const { initialPaymentRequired, serviceFee, propertyInspectionFee, documentUploadFee, total } = calculateInitialPayment(monthlyRent, paymentTerm);
      setFormData(prev => ({
        ...prev,
        [name]: value,
        depositAmount: initialPaymentRequired.toString(),
        serviceFee: serviceFee.toString(),
        visitFee: propertyInspectionFee.toString(),
        processingFee: documentUploadFee.toString(),
        totalInitialPayment: total.toString()
      }));
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    try {
      await fetchApplications();
      toast.success('Connection restored successfully');
    } catch (error) {
      console.error('Retry failed:', error);
      toast.error('Failed to reconnect. Please try again later.');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        'paymentTerm',
        'emergencyFirstName',
        'emergencyLastName',
        'emergencyWhatsappNumber',
        'emergencyResidenceAddress',
        'companyName',
        'companyLocation',
        'companyPhone',
        'supervisorName',
        'supervisorPhone'
      ];

      const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
      
      if (missingFields.length > 0) {
        toast.error('Please fill in all required fields');
        return;
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
          service_fee: parseFloat(formData.serviceFee),
          visit_fee: parseFloat(formData.visitFee),
          processing_fee: parseFloat(formData.processingFee),
          total_initial_payment: parseFloat(formData.totalInitialPayment),
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
          employee_id_number: formData.employeeIdNumber,
          mandate_number: formData.mandateNumber,
          mandate_pin: formData.mandatePin,
          has_outstanding_loans: formData.hasOutstandingLoans,
          loan_repayment_amount: formData.loanRepaymentAmount ? parseFloat(formData.loanRepaymentAmount) : null,
          has_savings_account: formData.hasSavingsAccount,
          savings_amount: formData.savingsAmount ? parseFloat(formData.savingsAmount) : null,
          contract_end_date: formData.contractEndDate || null,
          contract_renewable: formData.contractRenewable
        };
        
        // Create the application
        const response = await createApplication(applicationData);
        setApplicationId(response.id);
        
        // Create emergency contact
        const emergencyContactData: EmergencyContact = {
          firstName: formData.emergencyFirstName,
          lastName: formData.emergencyLastName,
          whatsappNumber: formData.emergencyWhatsappNumber,
          residenceAddress: formData.emergencyResidenceAddress
        };
        
        await createEmergencyContact({
          application_id: response.id,
          first_name: emergencyContactData.firstName,
          last_name: emergencyContactData.lastName,
          whatsapp_number: emergencyContactData.whatsappNumber,
          residence_address: emergencyContactData.residenceAddress
        });
        
        // Create employer information
        const employerInfoData: EmployerInformation = {
          companyName: formData.companyName,
          companyWebsite: formData.companyWebsite,
          companyLocation: formData.companyLocation,
          companyLocationGps: formData.companyLocationGps,
          companyPhone: formData.companyPhone,
          supervisorName: formData.supervisorName,
          supervisorPhone: formData.supervisorPhone
        };
        
        await createEmployerInfo({
          application_id: response.id,
          company_name: employerInfoData.companyName,
          company_website: employerInfoData.companyWebsite,
          company_location: employerInfoData.companyLocation,
          company_location_gps: employerInfoData.companyLocationGps,
          company_phone: employerInfoData.companyPhone,
          supervisor_name: employerInfoData.supervisorName,
          supervisor_phone: employerInfoData.supervisorPhone
        });
        
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

  // Show error state if there's an error
  if (error && !isRetrying) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-center flex-col">
              <AlertCircle size={48} className="text-red-500 mb-4" />
              <h2 className="text-xl font-semibold text-red-700 mb-2">Connection Error</h2>
              <p className="text-gray-600 mb-6 text-center">
                {error}
              </p>
              <Button 
                onClick={handleRetry}
                leftIcon={<RefreshCw size={18} />}
                isLoading={isRetrying}
              >
                Retry Connection
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Rent Assistance Application</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Rental Details</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="monthlyRent" className="block text-sm font-medium text-gray-700 mb-1">
                      Monthly Rent Amount (GH₵)
                    </label>
                    <input
                      type="number"
                      id="monthlyRent"
                      name="monthlyRent"
                      value={formData.monthlyRent}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="paymentTerm" className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Term
                    </label>
                    <select
                      id="paymentTerm"
                      name="paymentTerm"
                      value={formData.paymentTerm}
                      onChange={handleInputChange}
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
                      Lease Start Date
                    </label>
                    <input
                      type="date"
                      id="leaseStartDate"
                      name="leaseStartDate"
                      value={formData.leaseStartDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="leaseEndDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Lease End Date
                    </label>
                    <input
                      type="date"
                      id="leaseEndDate"
                      name="leaseEndDate"
                      value={formData.leaseEndDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="propertyAddress" className="block text-sm font-medium text-gray-700 mb-1">
                    Property Address
                  </label>
                  <input
                    type="text"
                    id="propertyAddress"
                    name="propertyAddress"
                    value={formData.propertyAddress}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="landlordName" className="block text-sm font-medium text-gray-700 mb-1">
                      Landlord Name
                    </label>
                    <input
                      type="text"
                      id="landlordName"
                      name="landlordName"
                      value={formData.landlordName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="landlordPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Landlord Phone
                    </label>
                    <input
                      type="tel"
                      id="landlordPhone"
                      name="landlordPhone"
                      value={formData.landlordPhone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="landlordPaymentDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Landlord Payment Date
                  </label>
                  <input
                    type="date"
                    id="landlordPaymentDate"
                    name="landlordPaymentDate"
                    value={formData.landlordPaymentDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Date when ShelterCrest will pay your landlord
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h2 className="text-xl font-semibold">Emergency Contact</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="emergencyFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="emergencyFirstName"
                      name="emergencyFirstName"
                      value={formData.emergencyFirstName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="emergencyLastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="emergencyLastName"
                      name="emergencyLastName"
                      value={formData.emergencyLastName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="emergencyWhatsappNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    id="emergencyWhatsappNumber"
                    name="emergencyWhatsappNumber"
                    value={formData.emergencyWhatsappNumber}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="emergencyResidenceAddress" className="block text-sm font-medium text-gray-700 mb-1">
                    Residence Address
                  </label>
                  <input
                    type="text"
                    id="emergencyResidenceAddress"
                    name="emergencyResidenceAddress"
                    value={formData.emergencyResidenceAddress}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h2 className="text-xl font-semibold">Employer Information</h2>
                
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700 mb-1">
                      Company Website (Optional)
                    </label>
                    <input
                      type="url"
                      id="companyWebsite"
                      name="companyWebsite"
                      value={formData.companyWebsite}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Company Phone
                    </label>
                    <input
                      type="tel"
                      id="companyPhone"
                      name="companyPhone"
                      value={formData.companyPhone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="companyLocation" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Location
                  </label>
                  <input
                    type="text"
                    id="companyLocation"
                    name="companyLocation"
                    value={formData.companyLocation}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="companyLocationGps" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Location GPS (Optional)
                  </label>
                  <input
                    type="text"
                    id="companyLocationGps"
                    name="companyLocationGps"
                    value={formData.companyLocationGps}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="supervisorName" className="block text-sm font-medium text-gray-700 mb-1">
                      Supervisor Name
                    </label>
                    <input
                      type="text"
                      id="supervisorName"
                      name="supervisorName"
                      value={formData.supervisorName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="supervisorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Supervisor Phone
                    </label>
                    <input
                      type="tel"
                      id="supervisorPhone"
                      name="supervisorPhone"
                      value={formData.supervisorPhone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h2 className="text-xl font-semibold">Employment Details</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="employeeIdNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Employee ID Number (Optional)
                    </label>
                    <input
                      type="text"
                      id="employeeIdNumber"
                      name="employeeIdNumber"
                      value={formData.employeeIdNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contractEndDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Contract End Date (Optional)
                    </label>
                    <input
                      type="date"
                      id="contractEndDate"
                      name="contractEndDate"
                      value={formData.contractEndDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="contractRenewable"
                    name="contractRenewable"
                    checked={formData.contractRenewable}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="contractRenewable" className="ml-2 block text-sm text-gray-700">
                    Contract is renewable
                  </label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="mandateNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Mandate Number (Optional)
                    </label>
                    <input
                      type="text"
                      id="mandateNumber"
                      name="mandateNumber"
                      value={formData.mandateNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="mandatePin" className="block text-sm font-medium text-gray-700 mb-1">
                      Mandate PIN (Optional)
                    </label>
                    <input
                      type="text"
                      id="mandatePin"
                      name="mandatePin"
                      value={formData.mandatePin}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="hasOutstandingLoans"
                    name="hasOutstandingLoans"
                    checked={formData.hasOutstandingLoans}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="hasOutstandingLoans" className="ml-2 block text-sm text-gray-700">
                    I have outstanding loans
                  </label>
                </div>
                
                {formData.hasOutstandingLoans && (
                  <div>
                    <label htmlFor="loanRepaymentAmount" className="block text-sm font-medium text-gray-700 mb-1">
                      Monthly Loan Repayment Amount (GH₵)
                    </label>
                    <input
                      type="number"
                      id="loanRepaymentAmount"
                      name="loanRepaymentAmount"
                      value={formData.loanRepaymentAmount}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required={formData.hasOutstandingLoans}
                    />
                  </div>
                )}
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="hasSavingsAccount"
                    name="hasSavingsAccount"
                    checked={formData.hasSavingsAccount}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="hasSavingsAccount" className="ml-2 block text-sm text-gray-700">
                    I have a savings account
                  </label>
                </div>
                
                {formData.hasSavingsAccount && (
                  <div>
                    <label htmlFor="savingsAmount" className="block text-sm font-medium text-gray-700 mb-1">
                      Savings Amount (GH₵)
                    </label>
                    <input
                      type="number"
                      id="savingsAmount"
                      name="savingsAmount"
                      value={formData.savingsAmount}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required={formData.hasSavingsAccount}
                    />
                  </div>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full"
                isLoading={loading}
              >
                {applications.length > 0 ? "Update Application" : "Submit Application"}
              </Button>
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
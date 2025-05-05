export interface PersonalInformation {
  firstName: string;
  lastName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  educationLevel: string;
  whatsappNumber: string;
  email: string;
  currentResidence: string;
  heardFrom: string;
}

export interface EmergencyContact {
  firstName: string;
  lastName: string;
  whatsappNumber: string;
  residenceAddress: string;
}

export interface EmploymentInformation {
  status: 'full-time' | 'part-time' | 'contract' | 'self-employed' | 'unemployed';
  type: string;
  contractEndDate?: string;
  contractRenewable?: boolean;
  hasOutstandingLoans: boolean;
  loanRepaymentAmount?: number;
  monthlyIncome: number;
  employmentStartDate: string;
  employeeIdNumber: string;
  mandateNumber?: string;
  mandatePin?: string;
  hasSavingsAccount: boolean;
  savingsAmount?: number;
}

export interface EmployerInformation {
  companyName: string;
  companyWebsite?: string;
  companyLocation: string;
  companyLocationGps?: string;
  companyPhone: string;
  supervisorName: string;
  supervisorPhone: string;
}

export interface DocumentUpload {
  type: string;
  file: File | null;
  uploaded: boolean;
  status: 'pending' | 'uploaded' | 'verified' | 'rejected';
}

export interface ApplicationFormData {
  personalInfo: PersonalInformation;
  emergencyContact: EmergencyContact;
  employmentInfo: EmploymentInformation;
  employerInfo: EmployerInformation;
  documents: Record<string, DocumentUpload>;
  monthlyRent: number;
  depositAmount: number;
  landlordName: string;
  landlordPhone: string;
  propertyAddress: string;
  leaseStartDate: string;
  leaseEndDate: string;
  landlordPaymentDate: string;
  paymentTerm: string;
}
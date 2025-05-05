import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, AlertCircle, ArrowRight, Mail } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { useAdminStore } from '../../store/adminStore';

interface FormData {
  salary: number;
  itemPrice: number;
  itemDescription: string;
  paymentTerm: '3' | '4' | '5' | '6';
}

interface PaymentScheduleItem {
  period: string;
  amount: number;
  dueDate: Date;
}

const BNPLChecker = () => {
  const [formData, setFormData] = useState<FormData>({
    salary: 0,
    itemPrice: 0,
    itemDescription: '',
    paymentTerm: '5'
  });
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>([]);
  const [monthlyPayment, setMonthlyPayment] = useState<number>(0);
  const [repaymentToIncomeRatio, setRepaymentToIncomeRatio] = useState<number>(0);
  
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { notifyAdminBNPLQualification } = useAdminStore();
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'salary' || name === 'itemPrice' 
        ? parseFloat(value) 
        : value
    });
  };
  
  const calculatePaymentSchedule = (itemPrice: number, paymentTerm: number) => {
    // Monthly interest rate is 4%
    const monthlyInterestRate = 0.04;
    
    // Calculate total interest
    const totalInterest = itemPrice * monthlyInterestRate * paymentTerm;

    // Calculate total amount
    const totalAmount = itemPrice + totalInterest;
    
    // Calculate monthly payment
    const monthlyPayment = totalAmount / paymentTerm;
    
    const schedule: PaymentScheduleItem[] = [];
    const today = new Date();
    
    for (let i = 0; i < paymentTerm; i++) {
      const dueDate = new Date(today);
      dueDate.setMonth(today.getMonth() + i + 1);
      
      schedule.push({
        period: `Month ${i + 1}`,
        amount: monthlyPayment,
        dueDate
      });
    }
    
    return {
      schedule,
      totalAmount,
      monthlyPayment,
      totalInterest
    };
  };
  
  const checkEligibility = () => {
    setIsLoading(true);
    
    // Eligibility logic:
    // 1. Minimum salary of 1000 cedis
    const meetsMinSalary = formData.salary >= 1000;
    
    const paymentTerm = parseInt(formData.paymentTerm);

    // Calculate payment schedule
    const { schedule, totalAmount, monthlyPayment, totalInterest } = calculatePaymentSchedule(formData.itemPrice, paymentTerm);
    
    // Check if monthly repayment is less than 40% of salary
    const repaymentToIncomeRatio = (monthlyPayment / formData.salary) * 100;
    const meetsRepaymentCriteria = repaymentToIncomeRatio <= 40;

    const eligible = meetsMinSalary && meetsRepaymentCriteria;
    
    // Store eligibility result in localStorage
    localStorage.setItem('bnplEligibilityData', JSON.stringify({
      eligible,
      timestamp: Date.now(),
      formData,
      paymentSchedule: schedule,
      totalAmount,
      monthlyPayment,
      totalInterest
    }));

    setPaymentSchedule(schedule);
    setMonthlyPayment(monthlyPayment);
    setRepaymentToIncomeRatio(repaymentToIncomeRatio);
    setIsEligible(eligible);
    setIsLoading(false);
  };
  
  const handleApply = async () => {
    if (!isAuthenticated) {
      navigate('/register');
      return; 
    }
    
    try {
      setIsLoading(true);
      
      // Notify admin about BNPL qualification
      if (user?.id) {
        await notifyAdminBNPLQualification( 
          user.id, 
          `Item Price: GH₵${formData.itemPrice}, Description: ${formData.itemDescription}, Payment Term: ${formData.paymentTerm} months`
        );
      }
      
      // Show success message
      toast.success('Your application has been submitted! Please email the items you need to Sales@sheltercrest.org');
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error applying for BNPL:', error);
      toast.error('Failed to submit application. Please try again.');
      setIsLoading(false);
    }
  };
  
  const renderEligibilityResult = () => {
    if (isEligible === null) return null;

    return (
      <div className="text-center mt-8 mb-4">
        {isEligible ? (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600 mb-2">
              <Check size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">You Are Eligible!</h2> 
            <p className="text-gray-600 max-w-md mx-auto">
              Based on the information provided, you qualify for our Buy Now Pay Later program.
            </p>
            
            {/* Payment Summary */}
            <div className="mt-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold mb-3">Payment Schedule</h3>
              <div className="bg-gray-50 p-4 rounded-lg"> 
                <div className="flex justify-between mb-2 text-sm font-medium">
                  <span>Total Item Price:</span>
                  <span>GH₵ {formData.itemPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2 text-sm font-medium">
                  <span>Monthly Interest Rate:</span>
                  <span>4%</span>
                </div>
                <div className="flex justify-between mb-2 text-sm font-medium">
                  <span>Total Interest ({formData.paymentTerm} months):</span>
                  <span>GH₵ {(formData.itemPrice * 0.04 * parseInt(formData.paymentTerm)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-4 text-sm font-medium border-t border-gray-200 pt-2">
                  <span>Total Amount:</span>
                  <span>GH₵ {(formData.itemPrice + (formData.itemPrice * 0.04 * parseInt(formData.paymentTerm))).toLocaleString()}</span>
                </div>
                
                <div className="border-t border-gray-200 pt-3">
                  <div className="text-sm font-medium mb-2">Monthly Payments:</div>
                  <div className="space-y-2">
                    {paymentSchedule.map((payment, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{payment.period} ({payment.dueDate.toLocaleDateString()}):</span>
                        <span>GH₵ {payment.amount.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg max-w-md mx-auto">
              <div className="flex items-start">
                <Mail className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Next Steps</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Please email the items you need to <strong>Sales@sheltercrest.org</strong> with your account details.
                  </p>
                </div>
              </div>
            </div>
            <div className="pt-4">
              <Button 
                size="lg"
                onClick={handleApply}
                isLoading={isLoading}
              >
                Apply Now
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4"> 
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-100 text-red-600 mb-2">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Not Eligible</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Based on the information provided, you don't currently meet our eligibility criteria for the Buy Now Pay Later program.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg max-w-md mx-auto"> 
              <h3 className="font-semibold mb-2">Common reasons for ineligibility:</h3>
              <ul className="text-left text-sm space-y-1">
                <li>• Monthly salary below GH₵ 1,000</li>
                <li>• Monthly payment exceeds 40% of income</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="max-w-2xl mx-auto py-8 animate-fade-in">
      <h1 className="text-3xl font-bold text-center mb-8">Buy Now Pay Later Eligibility</h1> 
      
      <Card>
        <div className="p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="salary" className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Salary (GH₵)
              </label>
              <div className="relative"> 
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500">GH₵</span>
                </div>
                <input
                  type="number"
                  id="salary"
                  name="salary"
                  value={formData.salary || ''}
                  onChange={handleInputChange}
                  placeholder="1000"
                  className="w-full pl-12 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              {formData.salary > 0 && formData.salary < 1000 && ( 
                <p className="mt-1 text-sm text-red-600">
                  Minimum monthly salary requirement is GH₵ 1,000
                </p>
              )}
            </div>
            
            <div> 
              <label htmlFor="itemPrice" className="block text-sm font-medium text-gray-700 mb-1">
                Item Price (GH₵)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500">GH₵</span>
                </div>
                <input 
                  type="number"
                  id="itemPrice"
                  name="itemPrice"
                  value={formData.itemPrice || ''}
                  onChange={handleInputChange}
                  placeholder="400"
                  className="w-full pl-12 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              {formData.salary > 0 && formData.itemPrice > 0 && ( 
                <div className="mt-2 text-sm">
                  <p className="font-medium">
                    Maximum item price allowed: {new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(formData.salary * 0.4)}
                  </p>
                  <p className="font-medium">
                    Item price to income ratio: {((formData.itemPrice / formData.salary) * 100).toFixed(1)}%
                  </p> 
                  {formData.itemPrice <= formData.salary * 0.4 ? (
                    <span className="text-green-600">(Within 40% threshold)</span>
                  ) : (
                    <span className="text-red-600">(Exceeds 40% threshold)</span>
                  )}
                </div>
              )}
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
              >
                <option value="3">3 Months</option>
                <option value="4">4 Months</option>
                <option value="5">5 Months</option>
                <option value="6">6 Months</option>
              </select>
            </div>
            
            <div> 
              <label htmlFor="itemDescription" className="block text-sm font-medium text-gray-700 mb-1">
                Item Description
              </label>
              <textarea
                id="itemDescription"
                name="itemDescription"
                value={formData.itemDescription}
                onChange={handleInputChange}
                rows={3}
                placeholder="Please describe the item(s) you're interested in purchasing"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              ></textarea>
            </div>
            
            <div className="flex justify-center mt-6">
              <Button 
                onClick={checkEligibility}
                isLoading={isLoading}
                rightIcon={<ArrowRight size={16} />}
              >
                Check Eligibility
              </Button>
            </div>
          </div>
          
          {renderEligibilityResult()}
        </div>
      </Card>
      
      <div className="mt-8 bg-gray-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">How Buy Now Pay Later Works</h2>
        <ol className="space-y-4 list-decimal list-inside">
          <li className="pl-2">
            <span className="font-medium">Check Eligibility:</span> Verify if you qualify based on your income and the item price.
          </li>
          <li className="pl-2">
            <span className="font-medium">Apply:</span> Submit your application and email the items you need to Sales@sheltercrest.org.
          </li>
          <li className="pl-2">
            <span className="font-medium">Approval:</span> Our team will review your application and contact you within 24-48 hours.
          </li>
          <li className="pl-2">
            <span className="font-medium">Payment Plan:</span> Choose a payment plan that works for you (3, 4, 5, or 6 months).
          </li>
          <li className="pl-2">
            <span className="font-medium">Receive Items:</span> Once approved, we'll arrange for you to receive your items.
          </li>
        </ol>
      </div>
    </div>
  );
};

export default BNPLChecker;
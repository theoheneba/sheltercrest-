import { supabase } from './db';
import { toast } from 'react-hot-toast';
import { emailService } from './emailService';
import { smsService } from './smsService';

export interface Payment {
  id: string;
  application_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  payment_method: string;
  transaction_id: string;
  created_at: string;
}

export interface PaymentVerification {
  reference: string;
  amount: number;
  applicationId: string;
  userId?: string;
}

export const paymentService = {
  async createPayment(data: Omit<Payment, 'id' | 'created_at'>) {
    try {
      const { data: payment, error } = await supabase
        .from('payments')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return payment;
    } catch (error: any) {
      toast.error(error.message || 'Failed to create payment');
      throw error;
    }
  },

  async getUserPayments(userId: string) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          application:applications(
            id,
            user_id
          )
        `)
        .eq('application.user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch payments');
      throw error;
    }
  },

  async verifyPayment(data: PaymentVerification) {
    try {
      // First, verify the payment with Paystack
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ reference: data.reference }),
      });

      if (!response.ok) {
        throw new Error('Payment verification failed');
      }

      const verificationResult = await response.json();
      
      if (!verificationResult.success) {
        throw new Error(verificationResult.message || 'Payment verification failed');
      }

      // If verification is successful, update the payment record
      const { data: payment, error } = await supabase
        .from('payments')
        .insert([{
          application_id: data.applicationId,
          amount: data.amount,
          due_date: new Date().toISOString().split('T')[0], // Today's date
          paid_date: new Date().toISOString(),
          status: 'completed',
          payment_method: 'paystack',
          transaction_id: data.reference
        }])
        .select(`
          *,
          application:applications(
            id,
            user_id
          )
        `)
        .single();

      if (error) throw error;
      
      // Get user email and phone for sending confirmation
      if (data.userId) {
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('email, phone, first_name')
          .eq('id', data.userId)
          .single();
          
        if (!userError && userData) {
          // Send payment confirmation email
          await emailService.sendPaymentConfirmation(userData.email, {
            amount: data.amount,
            date: new Date().toISOString(),
            reference: data.reference
          });
          
          // Send payment confirmation SMS if phone number exists
          if (userData.phone) {
            try {
              await smsService.sendPaymentConfirmationSMS(
                userData.phone,
                userData.first_name,
                data.amount
              );
            } catch (smsError) {
              console.error('Error sending payment confirmation SMS:', smsError);
              // Don't throw error here, just log it
            }
          }
        }
      }
      
      toast.success('Payment successful!');
      return payment;
    } catch (error: any) {
      toast.error(error.message || 'Payment verification failed');
      throw error;
    }
  },

  async schedulePaymentReminder(userId: string, paymentId: string, dueDate: string, amount: number) {
    try {
      // Get user's phone number and name
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('phone, first_name')
        .eq('id', userId)
        .single();
        
      if (userError) throw userError;
      
      if (!userData || !userData.phone) {
        console.log('No phone number found for user, skipping payment reminder');
        return;
      }
      
      // Calculate days until due date
      const today = new Date();
      const due = new Date(dueDate);
      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // If due date is within 3 days, send a reminder
      if (diffDays <= 3 && diffDays >= 0) {
        await smsService.sendPaymentReminderSMS(
          userData.phone,
          userData.first_name,
          amount,
          new Date(dueDate).toLocaleDateString()
        );
        
        console.log(`Payment reminder sent to ${userData.first_name} for payment due on ${dueDate}`);
      }
      
      // If payment is overdue, send an overdue notification
      if (diffDays < 0) {
        await smsService.sendPaymentOverdueSMS(
          userData.phone,
          userData.first_name,
          amount,
          Math.abs(diffDays)
        );
        
        console.log(`Payment overdue notification sent to ${userData.first_name} for payment ${Math.abs(diffDays)} days late`);
      }
      
      return true;
    } catch (error: any) {
      console.error('Error scheduling payment reminder:', error);
      return false;
    }
  },

  async sendIncomingPaymentAlert(userId: string, dueDate: string, amount: number) {
    try {
      // Get user's phone number and name
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('phone, first_name')
        .eq('id', userId)
        .single();
        
      if (userError) throw userError;
      
      if (!userData || !userData.phone) {
        console.log('No phone number found for user, skipping incoming payment alert');
        return;
      }
      
      // Send incoming payment alert
      await smsService.sendIncomingPaymentSMS(
        userData.phone,
        userData.first_name,
        amount,
        new Date(dueDate).toLocaleDateString()
      );
      
      console.log(`Incoming payment alert sent to ${userData.first_name} for payment due on ${dueDate}`);
      return true;
    } catch (error: any) {
      console.error('Error sending incoming payment alert:', error);
      return false;
    }
  }
};
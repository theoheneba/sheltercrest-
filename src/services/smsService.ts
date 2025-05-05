import { supabase } from './db';
import { toast } from 'react-hot-toast';

interface SMSMessage {
  recipient: string;
  message: string;
  sender_id?: string;
  notification_type?: string;
}

export const smsService = {
  async sendSMS(data: SMSMessage): Promise<any> {
    try {
      // Format phone number if needed
      let recipient = data.recipient;
      
      // Remove any non-digit characters
      recipient = recipient.replace(/\D/g, '');
      
      // Ensure Ghana country code
      if (!recipient.startsWith('233')) {
        // If it starts with 0, replace it with 233
        if (recipient.startsWith('0')) {
          recipient = '233' + recipient.substring(1);
        } else {
          // Otherwise, just add 233 prefix
          recipient = '233' + recipient;
        }
      }
      
      // Call the Supabase Edge Function to send SMS
      const { data: response, error } = await supabase.functions.invoke('send-sms', {
        body: {
          recipient: recipient,
          message: data.message,
          sender_id: data.sender_id || 'ShelterCrest',
          notification_type: data.notification_type || 'general'
        }
      });

      if (error) throw error;
      return response;
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      // Don't show toast for background notifications
      return null;
    }
  },

  // Application status notifications
  async sendApplicationApprovedSMS(phone: string, name: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, your ShelterCrest application has been APPROVED! Please log in to your account to complete the process.`,
      notification_type: 'application_approved'
    });
  },

  async sendApplicationRejectedSMS(phone: string, name: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, we regret to inform you that your ShelterCrest application has been declined. Please contact our support team for more information.`,
      notification_type: 'application_rejected'
    });
  },

  async sendApplicationInReviewSMS(phone: string, name: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, your ShelterCrest application is now under review. We'll notify you once the review is complete.`,
      notification_type: 'application_in_review'
    });
  },

  async sendApplicationSubmittedSMS(phone: string, name: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, your ShelterCrest application has been submitted successfully. We'll begin processing it shortly.`,
      notification_type: 'application_submitted'
    });
  },

  // Payment notifications
  async sendPaymentConfirmationSMS(phone: string, name: string, amount: number): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, your payment of GH₵${amount.toLocaleString()} has been received. Thank you for your payment!`,
      notification_type: 'payment_confirmation'
    });
  },

  async sendPaymentReminderSMS(phone: string, name: string, amount: number, dueDate: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, this is a reminder that your payment of GH₵${amount.toLocaleString()} is due on ${dueDate}. Please log in to make your payment.`,
      notification_type: 'payment_reminder'
    });
  },

  async sendPaymentOverdueSMS(phone: string, name: string, amount: number, daysLate: number): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, your payment of GH₵${amount.toLocaleString()} is now ${daysLate} days overdue. Please log in to make your payment as soon as possible to avoid additional fees.`,
      notification_type: 'payment_overdue'
    });
  },

  async sendIncomingPaymentSMS(phone: string, name: string, amount: number, dueDate: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, your next payment of GH₵${amount.toLocaleString()} is due on ${dueDate}. Please ensure your account has sufficient funds.`,
      notification_type: 'incoming_payment'
    });
  },

  // Document notifications
  async sendDocumentVerifiedSMS(phone: string, name: string, documentType: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, your ${documentType} document has been verified successfully.`,
      notification_type: 'document_verified'
    });
  },

  async sendDocumentRejectedSMS(phone: string, name: string, documentType: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, your ${documentType} document has been rejected. Please log in to upload a new document.`,
      notification_type: 'document_rejected'
    });
  },

  async sendDocumentUploadedSMS(phone: string, name: string, documentType: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, your ${documentType} document has been uploaded successfully. We'll notify you once it's verified.`,
      notification_type: 'document_uploaded'
    });
  },

  // Registration notification
  async sendWelcomeSMS(phone: string, name: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Welcome to ShelterCrest, ${name}! Your account has been created successfully. Log in to start your application.`,
      notification_type: 'welcome'
    });
  },

  // BNPL notifications
  async sendBNPLApprovedSMS(phone: string, name: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, your Buy Now Pay Later application has been approved! Please log in to your account to view your available credit.`,
      notification_type: 'bnpl_approved'
    });
  },

  async sendBNPLPaymentDueSMS(phone: string, name: string, amount: number, dueDate: string): Promise<any> {
    return this.sendSMS({
      recipient: phone,
      message: `Hello ${name}, your BNPL payment of GH₵${amount.toLocaleString()} is due on ${dueDate}. Please log in to make your payment.`,
      notification_type: 'bnpl_payment_due'
    });
  }
};
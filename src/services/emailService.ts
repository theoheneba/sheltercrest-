import { supabase } from './db';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export const emailService = {
  async sendEmail(options: EmailOptions): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('send-custom-email', {
        body: {
          to: options.to,
          subject: options.subject,
          html: options.html,
          from: options.from
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  },

  async sendConfirmationEmail(email: string, confirmationUrl: string): Promise<any> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0284c7;">Welcome to ShelterCrest</h1>
        </div>
        <div style="margin-bottom: 30px;">
          <p>Thank you for registering with ShelterCrest. Please confirm your email address to activate your account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmationUrl}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Confirm Email</a>
          </div>
          <p>If you did not create an account, please ignore this email.</p>
        </div>
        <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; font-size: 12px; color: #666;">
          <p>&copy; ${new Date().getFullYear()} ShelterCrest. All rights reserved.</p>
          <p>Developed by <a href="https://celeteck.com" style="color: #0284c7; text-decoration: none;">Celeteck</a></p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Confirm Your ShelterCrest Account',
      html
    });
  },

  async sendAgreementEmail(userEmail: string, agreementPdfPath: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a365d;">Your ShelterCrest Agreement</h2>
        <p>Thank you for using ShelterCrest. Please find your signed agreement attached to this email.</p>
        <p>Keep this document for your records. If you have any questions, please don't hesitate to contact our support team.</p>
        <div style="margin-top: 20px; padding: 15px; background-color: #f7fafc; border-radius: 5px;">
          <p style="margin: 0; color: #4a5568;">Best regards,<br>The ShelterCrest Team</p>
        </div>
        <div style="margin-top: 20px; font-size: 12px; color: #718096; text-align: center;">
          <p>&copy; ${new Date().getFullYear()} ShelterCrest. All rights reserved.</p>
          <p>Developed by <a href="https://celeteck.com" style="color: #0284c7; text-decoration: none;">Celeteck</a></p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: 'Your ShelterCrest Agreement',
      html,
      from: '"ShelterCrest" <no-reply@sheltercrest.org>'
    });
  },

  async sendAdminNotification(agreementPdfPath: string, userData: any) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a365d;">New Agreement Signed</h2>
        <p>A new agreement has been signed by a user.</p>
        <div style="margin: 20px 0; padding: 15px; background-color: #f7fafc; border-radius: 5px;">
          <h3 style="margin-top: 0;">User Details:</h3>
          <p style="margin: 5px 0;">Name: ${userData.firstName} ${userData.lastName}</p>
          <p style="margin: 5px 0;">Email: ${userData.email}</p>
          <p style="margin: 5px 0;">Application ID: ${userData.applicationId}</p>
        </div>
        <p>The signed agreement is attached to this email.</p>
        <div style="margin-top: 20px; font-size: 12px; color: #718096; text-align: center;">
          <p>&copy; ${new Date().getFullYear()} ShelterCrest. All rights reserved.</p>
          <p>Developed by <a href="https://celeteck.com" style="color: #0284c7; text-decoration: none;">Celeteck</a></p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: 'info@sheltercrest.org',
      subject: 'New Agreement Signed',
      html,
      from: '"ShelterCrest System" <no-reply@sheltercrest.org>'
    });
  },
  
  async sendPaymentConfirmation(userEmail: string, paymentDetails: any) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a365d;">Payment Confirmation</h2>
        <p>Thank you for your payment. Your transaction has been processed successfully.</p>
        <div style="margin: 20px 0; padding: 15px; background-color: #f7fafc; border-radius: 5px;">
          <h3 style="margin-top: 0;">Payment Details:</h3>
          <p style="margin: 5px 0;">Amount: GH₵ ${paymentDetails.amount.toLocaleString()}</p>
          <p style="margin: 5px 0;">Date: ${new Date(paymentDetails.date).toLocaleDateString()}</p>
          <p style="margin: 5px 0;">Reference: ${paymentDetails.reference}</p>
        </div>
        <p>If you have any questions about this payment, please contact our support team.</p>
        <div style="margin-top: 20px; font-size: 12px; color: #718096; text-align: center;">
          <p>&copy; ${new Date().getFullYear()} ShelterCrest. All rights reserved.</p>
          <p>Developed by <a href="https://celeteck.com" style="color: #0284c7; text-decoration: none;">Celeteck</a></p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: 'Payment Confirmation',
      html,
      from: '"ShelterCrest Payments" <no-reply@sheltercrest.org>'
    });
  }
};
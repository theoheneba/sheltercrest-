/*
  # Enhance SMS Notification Triggers

  1. Changes
    - Update application status change notification trigger
    - Update document verification notification trigger
    - Update payment completion notification trigger
    - Add new triggers for payment reminders
    
  2. Security
    - Maintain existing RLS policies
*/

-- Update the notify_application_status_change function to include more details
CREATE OR REPLACE FUNCTION notify_application_status_change()
RETURNS TRIGGER AS $$
DECLARE
  user_phone text;
  user_name text;
  message text;
BEGIN
  -- Only proceed if status has changed
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  
  -- Get user's phone number and name
  SELECT profiles.phone, profiles.first_name INTO user_phone, user_name
  FROM profiles
  WHERE profiles.id = NEW.user_id;
  
  -- If no phone number, return
  IF user_phone IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Prepare message based on status
  CASE NEW.status
    WHEN 'approved' THEN
      message := format('Hello %s, your ShelterCrest application has been APPROVED! Please log in to your account to complete the process. Your monthly rent is GH₵%s.', 
                       user_name, NEW.monthly_rent);
    WHEN 'rejected' THEN
      message := format('Hello %s, we regret to inform you that your ShelterCrest application has been declined. Please contact our support team at 0204090400 for more information.', 
                       user_name);
    WHEN 'in_review' THEN
      message := format('Hello %s, your ShelterCrest application is now under review. We''ll notify you once the review is complete. This usually takes 24-48 hours.', 
                       user_name);
    ELSE
      RETURN NEW;
  END CASE;
  
  -- Send SMS notification
  PERFORM send_sms_notification(user_phone, message);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the notify_document_verification function to include more details
CREATE OR REPLACE FUNCTION notify_document_verification()
RETURNS TRIGGER AS $$
DECLARE
  user_phone text;
  user_name text;
  message text;
  doc_type_display text;
BEGIN
  -- Only proceed if status has changed
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  
  -- Get user's phone number and name
  SELECT profiles.phone, profiles.first_name INTO user_phone, user_name
  FROM profiles
  WHERE profiles.id = NEW.user_id;
  
  -- If no phone number, return
  IF user_phone IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Format document type for display
  doc_type_display := INITCAP(REPLACE(NEW.document_type, '_', ' '));
  
  -- Prepare message based on status
  CASE NEW.status
    WHEN 'verified' THEN
      message := format('Hello %s, your %s document has been verified successfully. You can proceed with your application.', 
                       user_name, doc_type_display);
    WHEN 'rejected' THEN
      message := format('Hello %s, your %s document has been rejected. Please log in to upload a new document. Reason: %s', 
                       user_name, doc_type_display, COALESCE(NEW.verification_notes, 'Document did not meet requirements'));
    ELSE
      RETURN NEW;
  END CASE;
  
  -- Send SMS notification
  PERFORM send_sms_notification(user_phone, message);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the notify_payment_completion function to include more details
CREATE OR REPLACE FUNCTION notify_payment_completion()
RETURNS TRIGGER AS $$
DECLARE
  user_id uuid;
  user_phone text;
  user_name text;
  message text;
  next_payment_date date;
  next_payment_amount numeric;
  application_data record;
BEGIN
  -- Only proceed if status has changed to completed
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  
  -- Get application data
  SELECT * INTO application_data
  FROM applications
  WHERE id = NEW.application_id;
  
  -- Get user ID from application
  user_id := application_data.user_id;
  
  -- Get user's phone number and name
  SELECT phone, first_name INTO user_phone, user_name
  FROM profiles
  WHERE id = user_id;
  
  -- If no phone number, return
  IF user_phone IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate next payment date (25th of next month)
  next_payment_date := (date_trunc('month', CURRENT_DATE) + interval '1 month' + interval '25 days')::date;
  
  -- Calculate next payment amount (monthly rent + interest)
  next_payment_amount := application_data.monthly_rent + (application_data.monthly_rent * 0.2808);
  
  -- Prepare message
  message := format(
    'Hello %s, your payment of GH₵%s has been received. Thank you! Your next payment of GH₵%s is due on %s.',
    user_name, 
    NEW.amount, 
    next_payment_amount,
    to_char(next_payment_date, 'DD-MM-YYYY')
  );
  
  -- Send SMS notification
  PERFORM send_sms_notification(user_phone, message);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to send payment reminders
CREATE OR REPLACE FUNCTION send_payment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payment_record record;
  user_phone text;
  user_name text;
  message text;
BEGIN
  -- Find payments due in the next 3 days
  FOR payment_record IN
    SELECT 
      p.id, 
      p.amount, 
      p.due_date, 
      a.user_id,
      a.monthly_rent
    FROM 
      payments p
      JOIN applications a ON p.application_id = a.id
    WHERE 
      p.status = 'pending' 
      AND p.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + interval '3 days')
  LOOP
    -- Get user's phone number and name
    SELECT phone, first_name INTO user_phone, user_name
    FROM profiles
    WHERE id = payment_record.user_id;
    
    -- If no phone number, skip
    IF user_phone IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Prepare message
    message := format(
      'Hello %s, your payment of GH₵%s is due on %s. Please log in to make your payment.',
      user_name, 
      payment_record.amount, 
      to_char(payment_record.due_date, 'DD-MM-YYYY')
    );
    
    -- Send SMS notification
    PERFORM send_sms_notification(user_phone, message);
    
    -- Log the reminder
    INSERT INTO audit_log (action, details)
    VALUES ('payment_reminder_sent', format('Payment ID: %s, User ID: %s', payment_record.id, payment_record.user_id));
  END LOOP;
  
  -- Find overdue payments
  FOR payment_record IN
    SELECT 
      p.id, 
      p.amount, 
      p.due_date, 
      a.user_id,
      a.monthly_rent,
      CURRENT_DATE - p.due_date AS days_overdue
    FROM 
      payments p
      JOIN applications a ON p.application_id = a.id
    WHERE 
      p.status = 'pending' 
      AND p.due_date < CURRENT_DATE
  LOOP
    -- Get user's phone number and name
    SELECT phone, first_name INTO user_phone, user_name
    FROM profiles
    WHERE id = payment_record.user_id;
    
    -- If no phone number, skip
    IF user_phone IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Prepare message
    message := format(
      'IMPORTANT: Hello %s, your payment of GH₵%s is now %s days overdue. Please make your payment immediately to avoid additional penalties.',
      user_name, 
      payment_record.amount, 
      payment_record.days_overdue
    );
    
    -- Send SMS notification
    PERFORM send_sms_notification(user_phone, message);
    
    -- Log the reminder
    INSERT INTO audit_log (action, details)
    VALUES ('payment_overdue_notification_sent', format('Payment ID: %s, User ID: %s, Days Overdue: %s', payment_record.id, payment_record.user_id, payment_record.days_overdue));
  END LOOP;
END;
$$;

-- Create a function to notify users of document upload
CREATE OR REPLACE FUNCTION notify_document_upload()
RETURNS TRIGGER AS $$
DECLARE
  user_phone text;
  user_name text;
  message text;
  doc_type_display text;
BEGIN
  -- Get user's phone number and name
  SELECT profiles.phone, profiles.first_name INTO user_phone, user_name
  FROM profiles
  WHERE profiles.id = NEW.user_id;
  
  -- If no phone number, return
  IF user_phone IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Format document type for display
  doc_type_display := INITCAP(REPLACE(NEW.document_type, '_', ' '));
  
  -- Prepare message
  message := format('Hello %s, your %s document has been uploaded successfully. We''ll notify you once it''s verified.', 
                   user_name, doc_type_display);
  
  -- Send SMS notification
  PERFORM send_sms_notification(user_phone, message);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for document upload notification
DROP TRIGGER IF EXISTS document_upload_notification ON documents;
CREATE TRIGGER document_upload_notification
AFTER INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION notify_document_upload();

-- Create a function to notify users of application submission
CREATE OR REPLACE FUNCTION notify_application_submission()
RETURNS TRIGGER AS $$
DECLARE
  user_phone text;
  user_name text;
  message text;
BEGIN
  -- Get user's phone number and name
  SELECT profiles.phone, profiles.first_name INTO user_phone, user_name
  FROM profiles
  WHERE profiles.id = NEW.user_id;
  
  -- If no phone number, return
  IF user_phone IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Prepare message
  message := format('Hello %s, your ShelterCrest application has been submitted successfully. We''ll begin processing it shortly. Your application ID is %s.', 
                   user_name, NEW.id);
  
  -- Send SMS notification
  PERFORM send_sms_notification(user_phone, message);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for application submission notification
DROP TRIGGER IF EXISTS application_submission_notification ON applications;
CREATE TRIGGER application_submission_notification
AFTER INSERT ON applications
FOR EACH ROW
EXECUTE FUNCTION notify_application_submission();
-- Add SMS notification columns to system_settings
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS sms_notifications boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_sender_id text DEFAULT 'ShelterCrest';

-- Update existing system settings with default SMS values
UPDATE system_settings
SET 
  sms_notifications = true,
  sms_sender_id = 'ShelterCrest'
WHERE 
  sms_notifications IS NULL OR
  sms_sender_id IS NULL;

-- Create function to send SMS notifications
CREATE OR REPLACE FUNCTION send_sms_notification(
  phone_number text,
  message text,
  sender_id text DEFAULT 'ShelterCrest'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sms_enabled boolean;
BEGIN
  -- Check if SMS notifications are enabled
  SELECT sms_notifications INTO sms_enabled FROM system_settings LIMIT 1;
  
  -- If SMS notifications are disabled, return false
  IF NOT sms_enabled THEN
    RETURN false;
  END IF;
  
  -- In a real implementation, this would call an external SMS API
  -- For now, we'll just log the message
  INSERT INTO audit_log (action, details)
  VALUES (
    'sms_notification', 
    format('To: %s, Message: %s, Sender: %s', phone_number, message, sender_id)
  );
  
  RETURN true;
END;
$$;

-- Create trigger function to send SMS notifications on application status change
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
  SELECT phone, first_name INTO user_phone, user_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- If no phone number, return
  IF user_phone IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Prepare message based on status
  CASE NEW.status
    WHEN 'approved' THEN
      message := format('Hello %s, your ShelterCrest application has been APPROVED! Please log in to your account to complete the process.', user_name);
    WHEN 'rejected' THEN
      message := format('Hello %s, we regret to inform you that your ShelterCrest application has been declined. Please contact our support team for more information.', user_name);
    WHEN 'in_review' THEN
      message := format('Hello %s, your ShelterCrest application is now under review. We''ll notify you once the review is complete.', user_name);
    ELSE
      RETURN NEW;
  END CASE;
  
  -- Send SMS notification
  PERFORM send_sms_notification(user_phone, message);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for application status changes
DROP TRIGGER IF EXISTS application_status_change_notification ON applications;
CREATE TRIGGER application_status_change_notification
AFTER UPDATE OF status ON applications
FOR EACH ROW
EXECUTE FUNCTION notify_application_status_change();

-- Create trigger function to send SMS notifications on document verification
CREATE OR REPLACE FUNCTION notify_document_verification()
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
  SELECT phone, first_name INTO user_phone, user_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- If no phone number, return
  IF user_phone IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Prepare message based on status
  CASE NEW.status
    WHEN 'verified' THEN
      message := format('Hello %s, your %s document has been verified successfully.', user_name, NEW.document_type);
    WHEN 'rejected' THEN
      message := format('Hello %s, your %s document has been rejected. Please log in to upload a new document.', user_name, NEW.document_type);
    ELSE
      RETURN NEW;
  END CASE;
  
  -- Send SMS notification
  PERFORM send_sms_notification(user_phone, message);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for document verification
DROP TRIGGER IF EXISTS document_verification_notification ON documents;
CREATE TRIGGER document_verification_notification
AFTER UPDATE OF status ON documents
FOR EACH ROW
EXECUTE FUNCTION notify_document_verification();

-- Create trigger function to send SMS notifications on payment completion
CREATE OR REPLACE FUNCTION notify_payment_completion()
RETURNS TRIGGER AS $$
DECLARE
  user_id uuid;
  user_phone text;
  user_name text;
  message text;
BEGIN
  -- Only proceed if status has changed to completed
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  
  -- Get user ID from application
  SELECT user_id INTO user_id
  FROM applications
  WHERE id = NEW.application_id;
  
  -- Get user's phone number and name
  SELECT phone, first_name INTO user_phone, user_name
  FROM profiles
  WHERE id = user_id;
  
  -- If no phone number, return
  IF user_phone IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Prepare message
  message := format('Hello %s, your payment of GH₵%s has been received. Thank you for your payment!', 
                   user_name, NEW.amount);
  
  -- Send SMS notification
  PERFORM send_sms_notification(user_phone, message);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment completion
DROP TRIGGER IF EXISTS payment_completion_notification ON payments;
CREATE TRIGGER payment_completion_notification
AFTER UPDATE OF status ON payments
FOR EACH ROW
EXECUTE FUNCTION notify_payment_completion();
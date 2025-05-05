-- Add description and verification_notes columns to documents table if they don't exist
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS verification_notes text;

-- Create or replace function to process document uploads
CREATE OR REPLACE FUNCTION process_document_upload()
RETURNS TRIGGER AS $$
BEGIN
  -- Set created_at timestamp
  NEW.created_at := NOW();
  
  -- Set initial status to pending
  NEW.status := 'pending';
  
  -- Log the document upload
  INSERT INTO audit_log (
    action, 
    details, 
    performed_by
  ) VALUES (
    'document_upload',
    format('Document type: %s, File: %s', NEW.document_type, NEW.file_name),
    NEW.user_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for document uploads if it doesn't exist
DROP TRIGGER IF EXISTS document_upload_processor ON documents;
CREATE TRIGGER document_upload_processor
BEFORE INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION process_document_upload();

-- Create function to notify when document status changes
CREATE OR REPLACE FUNCTION notify_document_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Log the document verification
  INSERT INTO audit_log (
    action, 
    details, 
    performed_by
  ) VALUES (
    'document_verification',
    format('Document ID: %s, Status changed from %s to %s', NEW.id, OLD.status, NEW.status),
    NEW.verified_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for document verification if it doesn't exist
DROP TRIGGER IF EXISTS document_verification_notification ON documents;
CREATE TRIGGER document_verification_notification
AFTER UPDATE OF status ON documents
FOR EACH ROW
EXECUTE FUNCTION notify_document_verification();

-- Note: Storage bucket and policies are managed through the Supabase dashboard or API
-- This migration only handles database schema changes
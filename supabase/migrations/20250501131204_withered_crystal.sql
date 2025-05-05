/*
  # Configure Document Storage and Add Document Fields
  
  1. Changes
    - Add description and verification_notes columns to documents table
    - Create document upload processing function and trigger
    - Set up proper storage configuration using Supabase's storage API
    
  2. Security
    - Ensure proper access control for document storage
    - Add audit logging for document uploads
*/

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

-- Create enum type for document types if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type_enum') THEN
    CREATE TYPE document_type_enum AS ENUM (
      'ghana_card',
      'employee_id',
      'offer_letter',
      'payslip',
      'bank_statement',
      'supervisor_contact',
      'work_email',
      'employer_details',
      'emergency_contact',
      'live_selfie',
      'business_certificate',
      'business_address',
      'guarantor_contact',
      'identification',
      'income',
      'employment',
      'lease',
      'other'
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Create storage bucket for user documents using Supabase's storage API
-- Note: This is handled by Supabase's storage API, not directly in SQL
-- The bucket will need to be created through the Supabase dashboard or API

-- Add RLS policies for documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload documents" ON documents;
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
DROP POLICY IF EXISTS "Admins can verify documents" ON documents;

-- Create new policies
CREATE POLICY "Users can upload documents"
ON documents FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own documents"
ON documents FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));

CREATE POLICY "Admins can verify documents"
ON documents FOR UPDATE
TO authenticated
USING ((auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));
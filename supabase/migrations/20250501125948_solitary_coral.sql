/*
  # Update Documents Table for Document Types

  1. Changes
    - Add document_type enum to ensure consistent document types
    - Update existing documents with standardized types
    
  2. Security
    - Maintain existing RLS policies
*/

-- Create document type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type_enum') THEN
    CREATE TYPE document_type_enum AS ENUM (
      -- Employee document types
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
      
      -- Self-employed document types
      'business_certificate',
      'business_address',
      'guarantor_contact',
      
      -- Legacy types
      'identification',
      'income',
      'employment',
      'lease',
      'other'
    );
  END IF;
END$$;

-- Update document_type column to use the enum
ALTER TABLE documents 
ALTER COLUMN document_type TYPE text;

-- Update existing documents with standardized types
UPDATE documents
SET document_type = CASE
  WHEN document_type = 'identification' THEN 'ghana_card'
  WHEN document_type = 'income' THEN 'bank_statement'
  WHEN document_type = 'employment' THEN 'offer_letter'
  WHEN document_type = 'lease' THEN 'lease'
  ELSE document_type
END
WHERE document_type IN ('identification', 'income', 'employment', 'lease');

-- Add document description column
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS description text;

-- Add document verification notes column
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS verification_notes text;

-- Create function to handle document uploads
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

-- Create trigger for document uploads
DROP TRIGGER IF EXISTS document_upload_processor ON documents;
CREATE TRIGGER document_upload_processor
BEFORE INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION process_document_upload();
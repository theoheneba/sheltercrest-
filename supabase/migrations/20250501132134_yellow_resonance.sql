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

-- Create function to handle realtime updates
CREATE OR REPLACE FUNCTION handle_realtime_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Broadcast the change to the realtime system
  perform pg_notify(
    'realtime',
    json_build_object(
      'table', TG_TABLE_NAME,
      'type', TG_OP,
      'record', row_to_json(NEW),
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE null END
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add realtime trigger for documents
DROP TRIGGER IF EXISTS realtime_documents ON documents;
CREATE TRIGGER realtime_documents
AFTER INSERT OR UPDATE OR DELETE ON documents
FOR EACH ROW EXECUTE FUNCTION handle_realtime_updates();
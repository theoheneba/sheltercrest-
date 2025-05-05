-- Create a function to create the user-documents bucket
CREATE OR REPLACE FUNCTION create_user_documents_bucket()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create the bucket if it doesn't exist
  -- This uses the storage API directly
  INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
  VALUES (
    'user-documents',
    'user-documents',
    false,
    false,
    10485760, -- 10MB limit
    '{image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document}'
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Log the bucket creation
  INSERT INTO audit_log (
    action,
    details
  ) VALUES (
    'create_storage_bucket',
    'Created user-documents bucket'
  );
END;
$$;

-- Execute the function to create the bucket
SELECT create_user_documents_bucket();

-- Drop existing storage policies for the bucket
BEGIN;
  -- We use a transaction to ensure all operations succeed or fail together
  
  -- Try to drop existing policies (will fail silently if they don't exist)
  DROP POLICY IF EXISTS "User can access own folder" ON storage.objects;
  DROP POLICY IF EXISTS "Admin can access all documents" ON storage.objects;
  DROP POLICY IF EXISTS "User can upload to own folder" ON storage.objects;
  DROP POLICY IF EXISTS "User can update own documents" ON storage.objects;
  DROP POLICY IF EXISTS "User can delete own documents" ON storage.objects;
  
  -- Create policy for users to read their own documents
  CREATE POLICY "User can access own folder"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-documents' AND 
    auth.uid()::text = SPLIT_PART(name, '/', 1)
  );
  
  -- Create policy for users to upload to their own folder
  CREATE POLICY "User can upload to own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-documents' AND 
    auth.uid()::text = SPLIT_PART(name, '/', 1)
  );
  
  -- Create policy for users to update their own documents
  CREATE POLICY "User can update own documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-documents' AND 
    auth.uid()::text = SPLIT_PART(name, '/', 1)
  );
  
  -- Create policy for users to delete their own documents
  CREATE POLICY "User can delete own documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-documents' AND 
    auth.uid()::text = SPLIT_PART(name, '/', 1)
  );
  
  -- Create policy for admins to access all documents
  CREATE POLICY "Admin can access all documents"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'user-documents' AND
    (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text])
  );
COMMIT;

-- Create a function to initialize the storage bucket on application startup
CREATE OR REPLACE FUNCTION initialize_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create the bucket if it doesn't exist
  PERFORM create_user_documents_bucket();
  RETURN NEW;
END;
$$;

-- Create a trigger to initialize storage when the application starts
DROP TRIGGER IF EXISTS initialize_storage_on_startup ON auth.users;
CREATE TRIGGER initialize_storage_on_startup
AFTER INSERT ON auth.users
FOR EACH STATEMENT
EXECUTE FUNCTION initialize_storage();
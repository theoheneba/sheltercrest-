/*
  # Create Storage Policies for User Documents

  1. New Policies
    - Allow users to access only their own documents
    - Allow admins to access all documents
    - Ensure proper file path structure with user ID as folder name
    
  2. Security
    - Enforce row-level security for storage
    - Prevent unauthorized access to documents
*/

-- First, ensure the bucket exists (this is typically created through the UI)
-- This is just a safety check in case the bucket doesn't exist yet
DO $$
BEGIN
  -- This function is a no-op if the bucket already exists
  PERFORM storage.create_bucket('user-documents', 'private');
EXCEPTION
  WHEN OTHERS THEN
    -- Bucket might already exist, which is fine
    NULL;
END $$;

-- Drop existing policies if they exist to avoid conflicts
BEGIN;
  -- We use a transaction to ensure all operations succeed or fail together
  
  -- Try to drop existing policies (will fail silently if they don't exist)
  DROP POLICY IF EXISTS "User can access own folder" ON storage.objects;
  DROP POLICY IF EXISTS "Admin can access all documents" ON storage.objects;
  DROP POLICY IF EXISTS "User can upload to own folder" ON storage.objects;
  
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
  
  -- Create policy for users to update/delete their own documents
  CREATE POLICY "User can update own documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-documents' AND 
    auth.uid()::text = SPLIT_PART(name, '/', 1)
  );
  
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
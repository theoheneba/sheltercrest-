-- Create a function to create storage policies via RPC
CREATE OR REPLACE FUNCTION create_storage_policy(
  bucket text,
  policy_name text,
  definition text,
  operation text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  operations text[];
  sql_statement text;
BEGIN
  -- Parse the operation string into an array
  IF operation = 'ALL' THEN
    operations := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  ELSE
    operations := ARRAY[operation];
  END IF;
  
  -- Create policies for each operation
  FOREACH operation IN ARRAY operations
  LOOP
    -- Check if policy already exists
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE policyname = policy_name 
      AND tablename = 'objects' 
      AND schemaname = 'storage'
    ) THEN
      -- Drop existing policy
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_name);
    END IF;
    
    -- Create the policy
    CASE operation
      WHEN 'SELECT' THEN
        sql_statement := format(
          'CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L AND %s)',
          policy_name, bucket, definition
        );
      WHEN 'INSERT' THEN
        sql_statement := format(
          'CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L AND %s)',
          policy_name, bucket, definition
        );
      WHEN 'UPDATE' THEN
        sql_statement := format(
          'CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L AND %s)',
          policy_name, bucket, definition
        );
      WHEN 'DELETE' THEN
        sql_statement := format(
          'CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L AND %s)',
          policy_name, bucket, definition
        );
      ELSE
        RAISE EXCEPTION 'Unsupported operation: %', operation;
    END CASE;
    
    -- Execute the SQL statement
    EXECUTE sql_statement;
    
    -- Log the policy creation
    INSERT INTO audit_log (action, details)
    VALUES (
      'create_storage_policy',
      format('Created policy %s for %s operation on bucket %s', policy_name, operation, bucket)
    );
  END LOOP;
END;
$$;
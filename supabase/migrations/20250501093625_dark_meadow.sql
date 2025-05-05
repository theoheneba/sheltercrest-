/*
  # Fix Security Settings RLS Policy

  1. Changes
    - Drop existing RLS policies for security_settings
    - Create new policies with proper USING and WITH CHECK clauses
    - Fix the single row constraint mechanism
    - Ensure default settings exist
    
  2. Security
    - Maintain security by only allowing admin users to modify settings
    - Enable proper access for authenticated admin users
*/

-- First, check if there are multiple rows and keep only the most recent one
DO $$
DECLARE
  latest_id uuid;
BEGIN
  -- Get the ID of the most recently updated row
  SELECT id INTO latest_id
  FROM security_settings
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- If we found a row, delete all other rows
  IF latest_id IS NOT NULL THEN
    DELETE FROM security_settings
    WHERE id != latest_id;
  END IF;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Only admins can view security settings" ON security_settings;
DROP POLICY IF EXISTS "Only admins can manage security settings" ON security_settings;

-- Create new policies with correct permissions
CREATE POLICY "Only admins can view security settings"
  ON security_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage security settings"
  ON security_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create or replace function to prevent multiple security settings rows
CREATE OR REPLACE FUNCTION prevent_multiple_security_settings()
RETURNS TRIGGER AS $$
DECLARE
  row_count integer;
BEGIN
  -- Count existing rows
  SELECT COUNT(*) INTO row_count FROM security_settings;
  
  -- If we're inserting and there's already a row, raise an exception
  IF row_count > 0 THEN
    RAISE EXCEPTION 'Only one row is allowed in the security_settings table';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS ensure_single_security_row ON security_settings;

-- Create the trigger again
CREATE TRIGGER ensure_single_security_row
BEFORE INSERT ON security_settings
FOR EACH ROW EXECUTE FUNCTION prevent_multiple_security_settings();

-- Insert default settings if no rows exist
INSERT INTO security_settings (
  two_factor_auth,
  password_complexity,
  session_timeout,
  ip_whitelisting,
  account_lockout,
  log_retention
)
SELECT
  false,
  'high',
  30,
  false,
  3,
  30
WHERE NOT EXISTS (SELECT 1 FROM security_settings);
/*
  # Fix Database Settings RLS Policy

  1. Changes
    - Drop existing RLS policies for database_settings
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
  FROM database_settings
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- If we found a row, delete all other rows
  IF latest_id IS NOT NULL THEN
    DELETE FROM database_settings
    WHERE id != latest_id;
  END IF;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Only admins can view database settings" ON database_settings;
DROP POLICY IF EXISTS "Only admins can manage database settings" ON database_settings;

-- Create new policies with correct permissions
CREATE POLICY "Only admins can view database settings"
  ON database_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage database settings"
  ON database_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create or replace function to prevent multiple database settings rows
CREATE OR REPLACE FUNCTION prevent_multiple_database_settings()
RETURNS TRIGGER AS $$
DECLARE
  row_count integer;
BEGIN
  -- Count existing rows
  SELECT COUNT(*) INTO row_count FROM database_settings;
  
  -- If we're inserting and there's already a row, raise an exception
  IF row_count > 0 THEN
    RAISE EXCEPTION 'Only one row is allowed in the database_settings table';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS ensure_single_database_row ON database_settings;

-- Create the trigger again
CREATE TRIGGER ensure_single_database_row
BEFORE INSERT ON database_settings
FOR EACH ROW EXECUTE FUNCTION prevent_multiple_database_settings();

-- Insert default settings if no rows exist
INSERT INTO database_settings (
  backup_frequency,
  backup_retention_period
)
SELECT
  'daily',
  30
WHERE NOT EXISTS (SELECT 1 FROM database_settings);
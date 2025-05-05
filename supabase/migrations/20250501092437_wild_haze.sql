/*
  # Fix System Settings Table

  1. Changes
    - Fix the issue with multiple rows in system_settings table
    - Ensure only one row exists in the table
    - Update the trigger function to properly handle inserts
    
  2. Security
    - Maintain existing RLS policies
*/

-- First, check if there are multiple rows and keep only the most recent one
DO $$
DECLARE
  latest_id uuid;
BEGIN
  -- Get the ID of the most recently updated row
  SELECT id INTO latest_id
  FROM system_settings
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- If we found a row, delete all other rows
  IF latest_id IS NOT NULL THEN
    DELETE FROM system_settings
    WHERE id != latest_id;
  END IF;
END $$;

-- Fix the trigger function to properly handle inserts
CREATE OR REPLACE FUNCTION prevent_multiple_system_settings()
RETURNS TRIGGER AS $$
DECLARE
  row_count integer;
BEGIN
  -- Count existing rows
  SELECT COUNT(*) INTO row_count FROM system_settings;
  
  -- If we're inserting and there's already a row, raise an exception
  IF TG_OP = 'INSERT' AND row_count > 0 THEN
    RAISE EXCEPTION 'Only one row is allowed in the system_settings table';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS ensure_single_row ON system_settings;

-- Create the trigger again
CREATE TRIGGER ensure_single_row
BEFORE INSERT ON system_settings
FOR EACH ROW EXECUTE FUNCTION prevent_multiple_system_settings();

-- Insert default settings if no rows exist
INSERT INTO system_settings (
  system_name,
  default_currency,
  default_language,
  smtp_server,
  smtp_port,
  sender_email,
  email_notifications,
  system_alerts,
  application_updates
)
SELECT
  'RentAssist Admin',
  'GHS',
  'en',
  'smtp.hostinger.com',
  465,
  'info@sheltercrest.org',
  true,
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM system_settings);
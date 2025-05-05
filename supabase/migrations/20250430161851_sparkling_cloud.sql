/*
  # Remove Landlord Email and Inspection Fee

  1. Changes
    - Remove landlord_email column from applications table
    - Update payment calculation to remove inspection fee
    
  2. Security
    - Maintain existing RLS policies
*/

-- Remove landlord_email column from applications table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'applications' AND column_name = 'landlord_email'
  ) THEN
    ALTER TABLE applications DROP COLUMN landlord_email;
  END IF;
END $$;

-- Update existing applications to set visit_fee to 0
UPDATE applications
SET visit_fee = 0
WHERE visit_fee IS NOT NULL;

-- Create or replace function to calculate initial payment without inspection fee
CREATE OR REPLACE FUNCTION calculate_initial_payment(monthly_rent numeric, payment_term integer DEFAULT 12)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Service fee equals one month's rent
  -- Document processing fee is fixed at 60 GHS
  -- Interest is 28.08% of one month's rent
  -- Two months deposit
  -- No inspection fee (removed)
  
  result := jsonb_build_object(
    'deposit', monthly_rent * 2,
    'interest', monthly_rent * 0.2808,
    'service_fee', monthly_rent,
    'visit_fee', 0, -- Set to 0 (removed)
    'processing_fee', 60,
    'total', (monthly_rent * 2) + (monthly_rent * 0.2808) + monthly_rent + 60
  );
  
  RETURN result;
END;
$$;
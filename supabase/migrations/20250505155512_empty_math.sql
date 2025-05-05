/*
  # Update Application Form Schema

  1. New Columns
    - Add new columns to profiles table for personal information
    - Add new columns to applications table for employment information
    - Create new tables for emergency contacts and employer information
    
  2. Security
    - Enable RLS on all new tables
    - Add appropriate policies for data access
*/

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS marital_status text,
ADD COLUMN IF NOT EXISTS education_level text,
ADD COLUMN IF NOT EXISTS whatsapp_number text,
ADD COLUMN IF NOT EXISTS heard_from text;

-- Add new columns to applications table
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS contract_end_date date,
ADD COLUMN IF NOT EXISTS contract_renewable boolean,
ADD COLUMN IF NOT EXISTS has_outstanding_loans boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS loan_repayment_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS has_savings_account boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS savings_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS employee_id_number text,
ADD COLUMN IF NOT EXISTS mandate_number text,
ADD COLUMN IF NOT EXISTS mandate_pin text;

-- Create emergency_contacts table
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  whatsapp_number text NOT NULL,
  residence_address text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create employer_information table
CREATE TABLE IF NOT EXISTS employer_information (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  company_website text,
  company_location text NOT NULL,
  company_location_gps text,
  company_phone text NOT NULL,
  supervisor_name text NOT NULL,
  supervisor_phone text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employer_information ENABLE ROW LEVEL SECURITY;

-- Create policies for emergency_contacts
CREATE POLICY "Users can create emergency contacts"
  ON emergency_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own emergency contacts"
  ON emergency_contacts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));

CREATE POLICY "Users can update own emergency contacts"
  ON emergency_contacts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));

-- Create policies for employer_information
CREATE POLICY "Users can create employer information"
  ON employer_information
  FOR INSERT
  TO authenticated
  WITH CHECK (application_id IN (
    SELECT id FROM applications WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view own employer information"
  ON employer_information
  FOR SELECT
  TO authenticated
  USING (application_id IN (
    SELECT id FROM applications WHERE user_id = auth.uid()
  ) OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));

CREATE POLICY "Users can update own employer information"
  ON employer_information
  FOR UPDATE
  TO authenticated
  USING (application_id IN (
    SELECT id FROM applications WHERE user_id = auth.uid()
  ) OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));

-- Update document_type_enum to include new document types
DO $$
BEGIN
  ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'selfie_photo';
  ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'id_card';
  ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'bank_statement';
  ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'momo_statement';
  ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'employment_offer_letter';
  ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'employment_payslip';
  ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'company_id_card';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Create payment_fees table for document fees
CREATE TABLE IF NOT EXISTS payment_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  inspection_fee numeric(10,2) NOT NULL DEFAULT 120,
  document_fee numeric(10,2) NOT NULL DEFAULT 60,
  paid boolean DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on payment_fees table
ALTER TABLE payment_fees ENABLE ROW LEVEL SECURITY;

-- Create policies for payment_fees
CREATE POLICY "Users can view own payment fees"
  ON payment_fees
  FOR SELECT
  TO authenticated
  USING (application_id IN (
    SELECT id FROM applications WHERE user_id = auth.uid()
  ) OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));

CREATE POLICY "Users can update own payment fees"
  ON payment_fees
  FOR UPDATE
  TO authenticated
  USING (application_id IN (
    SELECT id FROM applications WHERE user_id = auth.uid()
  ) OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));
/*
  # Add User Application Form Tables and Policies

  1. Changes
    - Add new columns to profiles table
    - Add new columns to applications table
    - Create emergency_contacts table
    - Create employer_information table
    - Update document_type_enum to include new document types
    - Create payment_fees table for document fees

  2. Security
    - Enable RLS on all tables
    - Create policies for data access control, checking for existing policies before creation
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

-- Create policies for emergency_contacts - check if they exist first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'emergency_contacts' AND policyname = 'Users can create emergency contacts'
  ) THEN
    CREATE POLICY "Users can create emergency contacts"
      ON emergency_contacts
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'emergency_contacts' AND policyname = 'Users can view own emergency contacts'
  ) THEN
    CREATE POLICY "Users can view own emergency contacts"
      ON emergency_contacts
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'emergency_contacts' AND policyname = 'Users can update own emergency contacts'
  ) THEN
    CREATE POLICY "Users can update own emergency contacts"
      ON emergency_contacts
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid() OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));
  END IF;
END
$$;

-- Create policies for employer_information - check if they exist first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employer_information' AND policyname = 'Users can create employer information'
  ) THEN
    CREATE POLICY "Users can create employer information"
      ON employer_information
      FOR INSERT
      TO authenticated
      WITH CHECK (application_id IN (
        SELECT id FROM applications WHERE user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employer_information' AND policyname = 'Users can view own employer information'
  ) THEN
    CREATE POLICY "Users can view own employer information"
      ON employer_information
      FOR SELECT
      TO authenticated
      USING (application_id IN (
        SELECT id FROM applications WHERE user_id = auth.uid()
      ) OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employer_information' AND policyname = 'Users can update own employer information'
  ) THEN
    CREATE POLICY "Users can update own employer information"
      ON employer_information
      FOR UPDATE
      TO authenticated
      USING (application_id IN (
        SELECT id FROM applications WHERE user_id = auth.uid()
      ) OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));
  END IF;
END
$$;

-- Update document_type_enum to include new document types
DO $$
BEGIN
  -- Check if the type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type_enum') THEN
    -- Try to add new values if they don't exist
    BEGIN
      ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'selfie_photo';
    EXCEPTION WHEN duplicate_object THEN
      -- Value already exists, ignore
    END;
    
    BEGIN
      ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'id_card';
    EXCEPTION WHEN duplicate_object THEN
      -- Value already exists, ignore
    END;
    
    BEGIN
      ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'bank_statement';
    EXCEPTION WHEN duplicate_object THEN
      -- Value already exists, ignore
    END;
    
    BEGIN
      ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'momo_statement';
    EXCEPTION WHEN duplicate_object THEN
      -- Value already exists, ignore
    END;
    
    BEGIN
      ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'employment_offer_letter';
    EXCEPTION WHEN duplicate_object THEN
      -- Value already exists, ignore
    END;
    
    BEGIN
      ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'employment_payslip';
    EXCEPTION WHEN duplicate_object THEN
      -- Value already exists, ignore
    END;
    
    BEGIN
      ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'company_id_card';
    EXCEPTION WHEN duplicate_object THEN
      -- Value already exists, ignore
    END;
  END IF;
END
$$;

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

-- Create policies for payment_fees - check if they exist first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payment_fees' AND policyname = 'Users can view own payment fees'
  ) THEN
    CREATE POLICY "Users can view own payment fees"
      ON payment_fees
      FOR SELECT
      TO authenticated
      USING (application_id IN (
        SELECT id FROM applications WHERE user_id = auth.uid()
      ) OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payment_fees' AND policyname = 'Users can update own payment fees'
  ) THEN
    CREATE POLICY "Users can update own payment fees"
      ON payment_fees
      FOR UPDATE
      TO authenticated
      USING (application_id IN (
        SELECT id FROM applications WHERE user_id = auth.uid()
      ) OR (auth.jwt() ->> 'role')::text = ANY (ARRAY['admin'::text, 'superadmin'::text]));
  END IF;
END
$$;
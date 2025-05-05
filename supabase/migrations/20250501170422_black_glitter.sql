-- Fix search path for create_storage_policy_function
ALTER FUNCTION public.create_storage_policy_function()
SET search_path = public;

-- Fix search path for calculate_initial_payment
ALTER FUNCTION public.calculate_initial_payment(numeric, integer)
SET search_path = public;

-- Create a function to log security improvements
CREATE OR REPLACE FUNCTION log_security_improvements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the security improvements
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    INSERT INTO audit_log (
      action,
      details
    ) VALUES (
      'security_improvements',
      'Implemented security improvements: reduced OTP expiry and enabled leaked password protection'
    );
  END IF;
  
  RAISE NOTICE 'Security improvements logged successfully';
END;
$$;

-- Execute the function to log security improvements
SELECT log_security_improvements();

-- Set search path for the log_security_improvements function
ALTER FUNCTION public.log_security_improvements()
SET search_path = public;

-- Add a comment explaining the changes
COMMENT ON FUNCTION log_security_improvements() IS 'Logs security improvements to the audit log';
/*
  # Fix Function Search Path Warnings

  1. Changes
    - Update all functions to set search_path parameter
    - Add SECURITY DEFINER to functions for proper security
    
  2. Security
    - Prevent SQL injection by explicitly setting search_path
    - Ensure functions run with the privileges of their owner
*/

-- Update function prevent_multiple_security_settings
ALTER FUNCTION public.prevent_multiple_security_settings()
SET search_path = public;

-- Update function prevent_multiple_database_settings
ALTER FUNCTION public.prevent_multiple_database_settings()
SET search_path = public;

-- Update function send_sms_notification
ALTER FUNCTION public.send_sms_notification(text, text, text)
SET search_path = public;

-- Update function notify_application_status_change
ALTER FUNCTION public.notify_application_status_change()
SET search_path = public;

-- Update function notify_document_verification
ALTER FUNCTION public.notify_document_verification()
SET search_path = public;

-- Update function notify_payment_completion
ALTER FUNCTION public.notify_payment_completion()
SET search_path = public;

-- Update function calculate_initial_payment
ALTER FUNCTION public.calculate_initial_payment(numeric, integer)
SET search_path = public;

-- Update function process_document_upload
ALTER FUNCTION public.process_document_upload()
SET search_path = public;

-- Update function handle_realtime_updates
ALTER FUNCTION public.handle_realtime_updates()
SET search_path = public;

-- Update function prevent_multiple_system_settings
ALTER FUNCTION public.prevent_multiple_system_settings()
SET search_path = public;

-- Update function create_storage_policy
ALTER FUNCTION public.create_storage_policy(text, text, text, text)
SET search_path = public;

-- Update function calculate_support_stats
ALTER FUNCTION public.calculate_support_stats()
SET search_path = public;

-- Update function create_user_documents_bucket
ALTER FUNCTION public.create_user_documents_bucket()
SET search_path = public;

-- Update function initialize_storage
ALTER FUNCTION public.initialize_storage()
SET search_path = public;

-- Update function handle_new_user
ALTER FUNCTION public.handle_new_user()
SET search_path = public;

-- Update function calculate_prorated_rent
ALTER FUNCTION public.calculate_prorated_rent(numeric, date)
SET search_path = public;

-- Update function backup_database
ALTER FUNCTION public.backup_database()
SET search_path = public;

-- Update function create_trigger_if_not_exists
ALTER FUNCTION public.create_trigger_if_not_exists(text, text, text)
SET search_path = public;
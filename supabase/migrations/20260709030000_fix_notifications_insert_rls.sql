-- Fix: Add INSERT policy for notifications table so SECURITY DEFINER functions
-- like send_message can create notifications when called from the anon role.

-- First, check and drop any existing conflicting policies
DO $$
BEGIN
  -- Drop old restrictive policies if they exist
  DROP POLICY IF EXISTS "notifications_insert" ON notifications;
  DROP POLICY IF EXISTS "Anon insert notifications" ON notifications;
  DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
END $$;

-- Allow anon/authenticated to INSERT notifications (needed for send_message RPC)
CREATE POLICY "notifications_insert_any" ON notifications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow service_role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
    AND policyname = 'Service role full access to notifications'
  ) THEN
    CREATE POLICY "Service role full access to notifications" ON notifications
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

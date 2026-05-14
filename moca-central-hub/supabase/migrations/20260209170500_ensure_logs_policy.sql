
-- Enable RLS on logs if not already
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to insert logs
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON logs;

CREATE POLICY "Enable insert for authenticated users only"
ON logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy to allow users to view their own logs (or admins to view all)
-- (Existing policies might cover this, but ensuring it)
DROP POLICY IF EXISTS "Admins can view all logs" ON logs;
CREATE POLICY "Admins can view all logs"
ON logs FOR SELECT
TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'manager')
);

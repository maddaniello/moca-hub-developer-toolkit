/*
  # Fix Logs RLS Policy
  
  ## Overview
  Adds a policy to allow admins to delete logs.
  This is required for the "Clear Logs" functionality to work.
  
  ## Changes
  - Add DELETE policy for admins on `logs` table
*/

-- Allow admins to delete logs (for Clear Logs functionality)
CREATE POLICY "Admins can delete logs"
  ON logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

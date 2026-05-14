-- Fix Manager Insert Policy using Security Definer function to avoid recursion
-- and ensure robust permission checking

-- 1. Create helper function
CREATE OR REPLACE FUNCTION is_manager_for_client(target_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner permissions, bypassing RLS on 'users' lookup
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('manager', 'admin')
    AND client_id = target_client_id
    AND status = 'active'
  );
END;
$$;

-- 2. Drop old policy
DROP POLICY IF EXISTS "Managers can insert users in their client" ON users;

-- 3. Create new policy
CREATE POLICY "Managers can insert users in their client"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    is_manager_for_client(client_id)
  );

-- 4. Also update Update Policy for consistency (Managers updating users)
DROP POLICY IF EXISTS "Admins and managers can update users" ON users;

CREATE POLICY "Admins and managers can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    -- Admin check
    (
       SELECT role FROM users WHERE id = auth.uid()
    ) = 'admin'
    OR
    -- Manager check
    is_manager_for_client(client_id)
  )
  WITH CHECK (
    -- Ensure they don't change client_id to one they don't own?
    -- Simplified: Admins can do anything. Managers can update if they manage the client.
    -- Re-using the same logic.
    
    (
       SELECT role FROM users WHERE id = auth.uid()
    ) = 'admin'
    OR
    is_manager_for_client(client_id)
  );

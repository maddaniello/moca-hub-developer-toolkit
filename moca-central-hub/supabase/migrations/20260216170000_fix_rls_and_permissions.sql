-- Fix RLS Infinite Recursion and Permissions (Final Robust Version)

-- 1. Explicitly Drop ALL existing policies to ensure clean slate
-- Users table
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Managers can view users in their client" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Managers can insert users in their client" ON users;
DROP POLICY IF EXISTS "Admins and managers can update users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Clients table
DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
DROP POLICY IF EXISTS "Users can view their own client" ON clients;

-- User Clients table
DROP POLICY IF EXISTS "Admins can view all user-client relationships" ON user_clients;
DROP POLICY IF EXISTS "Managers can view relationships in their client" ON user_clients;
DROP POLICY IF EXISTS "Users can view their own client relationships" ON user_clients;
DROP POLICY IF EXISTS "Admins can insert user-client relationships" ON user_clients;
DROP POLICY IF EXISTS "Managers can insert relationships in their client" ON user_clients;
DROP POLICY IF EXISTS "Admins and managers can delete user-client relationships" ON user_clients;

-- Logs table
DROP POLICY IF EXISTS "Admins can view all logs" ON logs;
DROP POLICY IF EXISTS "System can insert logs" ON logs;


-- 2. Drop helper functions if they exist with CASCADE
DROP FUNCTION IF EXISTS get_my_role() CASCADE;
DROP FUNCTION IF EXISTS get_my_client_id() CASCADE;

-- 3. Create helper functions
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT role FROM users WHERE id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION get_my_client_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT client_id FROM users WHERE id = auth.uid());
END;
$$;

-- 4. Re-create RLS Policies for 'users' table

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
  );

CREATE POLICY "Managers can view users in their client"
  ON users FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'manager' AND
    client_id = get_my_client_id()
  );

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
  );

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
  );

CREATE POLICY "Managers can insert users in their client"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() = 'manager' AND
    client_id = get_my_client_id()
  );

CREATE POLICY "Admins and managers can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    (get_my_role() = 'admin') OR
    (get_my_role() = 'manager' AND client_id = get_my_client_id()) OR
    (id = auth.uid()) 
  );

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    get_my_role() = 'admin'
  );

-- 5. Re-create RLS Policies for 'clients' table

CREATE POLICY "Admins can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
  );

CREATE POLICY "Users can view their own client"
  ON clients FOR SELECT
  TO authenticated
  USING (
    id = get_my_client_id()
    OR
    EXISTS (
        SELECT 1 FROM user_clients 
        WHERE user_id = auth.uid() 
        AND client_id = clients.id
    )
  );

-- 6. Re-create RLS Policies for 'user_clients' table

CREATE POLICY "Admins can view all user-client relationships"
  ON user_clients FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
  );

CREATE POLICY "Managers can view relationships in their client"
  ON user_clients FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'manager' AND
    client_id = get_my_client_id()
  );

CREATE POLICY "Users can view their own client relationships"
  ON user_clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert user-client relationships"
  ON user_clients FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
  );

CREATE POLICY "Managers can insert relationships in their client"
  ON user_clients FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() = 'manager' AND
    client_id = get_my_client_id()
  );

CREATE POLICY "Admins and managers can delete user-client relationships"
  ON user_clients FOR DELETE
  TO authenticated
  USING (
    get_my_role() = 'admin' OR 
    (get_my_role() = 'manager' AND client_id = get_my_client_id())
  );

-- 7. Re-create RLS Policies for 'logs' table

CREATE POLICY "Admins can view all logs"
  ON logs FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
  );

CREATE POLICY "System can insert logs"
  ON logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 8. Ensure update_last_login is correct
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET last_login = now()
  WHERE id = auth.uid();
END;
$$;

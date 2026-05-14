-- ============================================================
-- STEP 2: Migrate data and update policies
-- (Run AFTER 20260414110000 has been committed)
--
-- Mapping:
--   admin   -> super_admin
--   manager -> manager (unchanged)
--   user    -> specialist
--   viewer  -> external
-- ============================================================

-- Migrate existing users to new roles
UPDATE users SET role = 'super_admin' WHERE role = 'admin';
UPDATE users SET role = 'specialist' WHERE role = 'user';
UPDATE users SET role = 'external' WHERE role = 'viewer';

-- Update role_definitions table
UPDATE role_definitions SET
  role_key = 'super_admin',
  display_name = 'Super Admin',
  description = 'Accesso completo alla piattaforma. Gestione totale di utenti, clienti, configurazioni, applicazioni e impostazioni di sistema.',
  permissions = '["manage_clients", "manage_users", "manage_configurations", "manage_applications", "manage_roles", "view_logs", "view_audit_logs", "manage_system"]'::jsonb
WHERE role_key = 'admin';

UPDATE role_definitions SET
  display_name = 'Manager',
  description = 'Responsabile del team. Puo'' creare e modificare utenti, clienti e configurazioni.',
  permissions = '["manage_users", "manage_clients", "manage_configurations", "view_applications", "use_applications", "view_logs"]'::jsonb
WHERE role_key = 'manager';

UPDATE role_definitions SET
  role_key = 'specialist',
  display_name = 'Specialist',
  description = 'Operativo in agenzia. Puo'' modificare configurazioni, creare clienti e utilizzare le applicazioni.',
  permissions = '["manage_configurations", "manage_clients", "view_applications", "use_applications"]'::jsonb
WHERE role_key = 'user';

UPDATE role_definitions SET
  role_key = 'external',
  display_name = 'Esterno',
  description = 'Utente esterno (es. cliente). Puo'' visualizzare solo le configurazioni dei propri clienti e usare le applicazioni autorizzate.',
  permissions = '["view_own_configurations", "use_authorized_applications"]'::jsonb
WHERE role_key = 'viewer';

-- Add role_access column to application_access (missing from original schema)
ALTER TABLE application_access ADD COLUMN IF NOT EXISTS role_access text;
ALTER TABLE application_access ADD COLUMN IF NOT EXISTS min_level integer;

-- ============================================================
-- Fix RLS policies for configurations
-- ============================================================

DROP POLICY IF EXISTS "Users can view their client configurations" ON configurations;

CREATE POLICY "Users can view configurations of assigned clients"
  ON configurations FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT uc.client_id FROM user_clients uc
      WHERE uc.user_id = auth.uid()
    )
    OR
    client_id = (
      SELECT u.client_id FROM users u
      WHERE u.id = auth.uid()
      AND u.status = 'active'
    )
  );

-- ============================================================
-- Update ALL RLS policies to use new role names
-- ============================================================

-- === CLIENTS TABLE ===
DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
CREATE POLICY "Super admins can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can insert clients" ON clients;
CREATE POLICY "Super admins and managers and specialists can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager', 'specialist')
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can update clients" ON clients;
CREATE POLICY "Super admins and managers can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can delete clients" ON clients;
CREATE POLICY "Super admins can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view their own client" ON clients;
CREATE POLICY "Users can view their assigned clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT uc.client_id FROM user_clients uc
      WHERE uc.user_id = auth.uid()
    )
    OR
    id = (
      SELECT u.client_id FROM users u
      WHERE u.id = auth.uid()
      AND u.status = 'active'
    )
  );

-- === USERS TABLE ===
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Super admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'super_admin'
      AND u.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can insert users" ON users;
CREATE POLICY "Super admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins and managers can update users" ON users;
CREATE POLICY "Super admins and managers can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Super admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Managers can view users in their client" ON users;
CREATE POLICY "Managers can view users in their clients"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users me
      WHERE me.id = auth.uid()
      AND me.role = 'manager'
      AND me.status = 'active'
    )
    AND (
      id IN (
        SELECT uc.user_id FROM user_clients uc
        WHERE uc.client_id IN (
          SELECT uc2.client_id FROM user_clients uc2 WHERE uc2.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- === CONFIGURATIONS TABLE ===
DROP POLICY IF EXISTS "Admins can view all configurations" ON configurations;
CREATE POLICY "Super admins can view all configurations"
  ON configurations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can insert configurations" ON configurations;
DROP POLICY IF EXISTS "Admins and managers can insert configurations" ON configurations;
CREATE POLICY "Super admins managers and specialists can insert configurations"
  ON configurations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager', 'specialist')
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can update configurations" ON configurations;
DROP POLICY IF EXISTS "Admins and managers can update configurations" ON configurations;
CREATE POLICY "Super admins managers and specialists can update configurations"
  ON configurations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager', 'specialist')
      AND users.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager', 'specialist')
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can delete configurations" ON configurations;
DROP POLICY IF EXISTS "Admins and managers can delete configurations" ON configurations;
CREATE POLICY "Super admins and managers can delete configurations"
  ON configurations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  );

-- === APPLICATIONS TABLE ===
DROP POLICY IF EXISTS "Admins can manage applications" ON applications;
DROP POLICY IF EXISTS "Anyone can view active applications" ON applications;
DROP POLICY IF EXISTS "Admins can insert applications" ON applications;
DROP POLICY IF EXISTS "Admins can update applications" ON applications;
DROP POLICY IF EXISTS "Admins can delete applications" ON applications;

CREATE POLICY "Super admins can insert applications"
  ON applications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Super admins can update applications"
  ON applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Super admins can delete applications"
  ON applications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Authenticated users can view active applications"
  ON applications FOR SELECT
  TO authenticated
  USING (status = 'active' OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('super_admin', 'manager')
    AND users.status = 'active'
  ));

-- === APPLICATION_ACCESS TABLE ===
DROP POLICY IF EXISTS "Admins can view all access" ON application_access;
DROP POLICY IF EXISTS "Admins can insert access" ON application_access;
DROP POLICY IF EXISTS "Admins can update access" ON application_access;
DROP POLICY IF EXISTS "Admins can delete access" ON application_access;
DROP POLICY IF EXISTS "Users can view their access" ON application_access;
DROP POLICY IF EXISTS "Admins can manage all access" ON application_access;

CREATE POLICY "Super admins and managers can view all access"
  ON application_access FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  );

CREATE POLICY "Users can view their own access"
  ON application_access FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR client_id IN (
      SELECT uc.client_id FROM user_clients uc WHERE uc.user_id = auth.uid()
    )
    OR role_access = (SELECT u.role::text FROM users u WHERE u.id = auth.uid())
    OR role_access = 'all'
  );

CREATE POLICY "Super admins and managers can insert access"
  ON application_access FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  );

CREATE POLICY "Super admins and managers can update access"
  ON application_access FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  );

CREATE POLICY "Super admins and managers can delete access"
  ON application_access FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  );

-- === AUDIT_LOGS TABLE ===
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins and managers can view audit logs" ON audit_logs;
CREATE POLICY "Super admins and managers can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can insert audit logs" ON audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- === LOGS TABLE ===
DROP POLICY IF EXISTS "Admins can view logs" ON logs;
DROP POLICY IF EXISTS "Admin and manager can view logs" ON logs;
CREATE POLICY "Super admins and managers can view logs"
  ON logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Anyone can insert logs" ON logs;
DROP POLICY IF EXISTS "Admins can delete logs" ON logs;
CREATE POLICY "Anyone can insert logs"
  ON logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Super admins can delete logs"
  ON logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

-- === USER_CLIENTS TABLE ===
DROP POLICY IF EXISTS "Admins can view all user-client relationships" ON user_clients;
CREATE POLICY "Super admins can view all user-client relationships"
  ON user_clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Managers can view relationships in their client" ON user_clients;
CREATE POLICY "Managers can view relationships in their client"
  ON user_clients FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT uc.client_id FROM user_clients uc
      WHERE uc.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'manager'
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can insert user-client relationships" ON user_clients;
CREATE POLICY "Super admins can insert user-client relationships"
  ON user_clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Managers can insert relationships in their client" ON user_clients;
CREATE POLICY "Managers can insert relationships in their clients"
  ON user_clients FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT uc.client_id FROM user_clients uc
      WHERE uc.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'manager'
      AND users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins and managers can delete user-client relationships" ON user_clients;
CREATE POLICY "Super admins and managers can delete user-client relationships"
  ON user_clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'manager')
      AND users.status = 'active'
    )
  );

-- === ROLE_DEFINITIONS TABLE ===
DROP POLICY IF EXISTS "Admins can insert role definitions" ON role_definitions;
DROP POLICY IF EXISTS "Admins can update role definitions" ON role_definitions;
DROP POLICY IF EXISTS "Admins can delete custom role definitions" ON role_definitions;

CREATE POLICY "Super admins can insert role definitions"
  ON role_definitions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active')
  );

CREATE POLICY "Super admins can update role definitions"
  ON role_definitions FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));

CREATE POLICY "Super admins can delete custom role definitions"
  ON role_definitions FOR DELETE
  TO authenticated
  USING (
    is_system_role = false
    AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active')
  );

-- === PERMISSION_LEVELS TABLE ===
DROP POLICY IF EXISTS "Admins can insert permission levels" ON permission_levels;
DROP POLICY IF EXISTS "Admins can update permission levels" ON permission_levels;
DROP POLICY IF EXISTS "Admins can delete permission levels" ON permission_levels;

CREATE POLICY "Super admins can insert permission levels"
  ON permission_levels FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));

CREATE POLICY "Super admins can update permission levels"
  ON permission_levels FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));

CREATE POLICY "Super admins can delete permission levels"
  ON permission_levels FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));

-- === Update functions ===
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM users WHERE id = auth.uid() AND status = 'active';
$$;

DROP FUNCTION IF EXISTS is_manager_for_client(uuid);
CREATE FUNCTION is_manager_for_client(check_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'manager'
    AND status = 'active'
    AND (
      client_id = check_client_id
      OR id IN (
        SELECT user_id FROM user_clients WHERE client_id = check_client_id
      )
    )
  );
$$;

-- === Update policies for other tables ===

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'application_categories') THEN
    DROP POLICY IF EXISTS "Admins can insert categories" ON application_categories;
    DROP POLICY IF EXISTS "Admins can update categories" ON application_categories;
    DROP POLICY IF EXISTS "Admins can delete categories" ON application_categories;

    CREATE POLICY "Super admins can insert categories"
      ON application_categories FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));
    CREATE POLICY "Super admins can update categories"
      ON application_categories FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'))
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));
    CREATE POLICY "Super admins can delete categories"
      ON application_categories FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_knowledge') THEN
    DROP POLICY IF EXISTS "Admins can manage all knowledge" ON client_knowledge;
    DROP POLICY IF EXISTS "Admins and managers can insert knowledge" ON client_knowledge;
    DROP POLICY IF EXISTS "Admins and managers can update knowledge" ON client_knowledge;
    DROP POLICY IF EXISTS "Admins and managers can delete knowledge" ON client_knowledge;

    CREATE POLICY "Super admins and managers can insert knowledge"
      ON client_knowledge FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'manager') AND users.status = 'active'));
    CREATE POLICY "Super admins and managers can update knowledge"
      ON client_knowledge FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'manager') AND users.status = 'active'))
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'manager') AND users.status = 'active'));
    CREATE POLICY "Super admins and managers can delete knowledge"
      ON client_knowledge FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'manager') AND users.status = 'active'));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_files') THEN
    DROP POLICY IF EXISTS "Admins can manage all files" ON client_files;
    DROP POLICY IF EXISTS "Admins and managers can insert files" ON client_files;
    DROP POLICY IF EXISTS "Admins and managers can delete files" ON client_files;

    CREATE POLICY "Super admins and managers can insert files"
      ON client_files FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'manager') AND users.status = 'active'));
    CREATE POLICY "Super admins and managers can delete files"
      ON client_files FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'manager') AND users.status = 'active'));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_contracts') THEN
    DROP POLICY IF EXISTS "Admins and managers can insert contracts" ON client_contracts;
    DROP POLICY IF EXISTS "Admins and managers can delete contracts" ON client_contracts;

    CREATE POLICY "Super admins and managers can insert contracts"
      ON client_contracts FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'manager') AND users.status = 'active'));
    CREATE POLICY "Super admins and managers can delete contracts"
      ON client_contracts FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'manager') AND users.status = 'active'));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_prompts') THEN
    DROP POLICY IF EXISTS "Admins can manage system prompts" ON system_prompts;
    DROP POLICY IF EXISTS "Admins can insert system prompts" ON system_prompts;
    DROP POLICY IF EXISTS "Admins can update system prompts" ON system_prompts;
    DROP POLICY IF EXISTS "Admins can delete system prompts" ON system_prompts;

    CREATE POLICY "Super admins can insert system prompts"
      ON system_prompts FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));
    CREATE POLICY "Super admins can update system prompts"
      ON system_prompts FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'))
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));
    CREATE POLICY "Super admins can delete system prompts"
      ON system_prompts FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin' AND users.status = 'active'));
  END IF;
END $$;

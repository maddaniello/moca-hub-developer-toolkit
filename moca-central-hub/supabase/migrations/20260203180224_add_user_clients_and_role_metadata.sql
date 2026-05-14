/*
  # Add User-Clients Junction Table and Role/Permission Metadata
  
  ## Overview
  This migration adds support for:
  1. Multi-client user assignments via junction table
  2. Dynamic role definitions with customizable names and permissions
  3. Dynamic permission level metadata with configurable properties
  
  ## New Tables
  
  ### 1. user_clients
  Junction table for many-to-many relationship between users and clients.
  Allows a single user to be assigned to multiple clients.
  
  ### 2. role_definitions
  Metadata table storing configurable information about each role.
  Allows admins to customize role names, descriptions, and permissions.
  
  ### 3. permission_levels
  Metadata table storing information about each permission level (1-5).
  Allows admins to customize level names, descriptions, and capabilities.
*/

-- ============================================================
-- Table 1: user_clients (Junction Table)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, client_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_clients_user_id ON user_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_client_id ON user_clients(client_id);

-- Enable Row Level Security
ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_clients
CREATE POLICY "Admins can view all user-client relationships"
  ON user_clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Managers can view relationships in their client"
  ON user_clients FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'admin')
      AND status = 'active'
    )
  );

CREATE POLICY "Users can view their own client relationships"
  ON user_clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert user-client relationships"
  ON user_clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Managers can insert relationships in their client"
  ON user_clients FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'admin')
      AND status = 'active'
    )
  );

CREATE POLICY "Admins and managers can delete user-client relationships"
  ON user_clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
      AND users.status = 'active'
    )
  );

-- ============================================================
-- Table 2: role_definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key user_role NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system_role boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_role_definitions_role_key ON role_definitions(role_key);

-- Enable Row Level Security
ALTER TABLE role_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for role_definitions
CREATE POLICY "Anyone authenticated can view role definitions"
  ON role_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert role definitions"
  ON role_definitions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Admins can update role definitions"
  ON role_definitions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Admins can delete custom role definitions"
  ON role_definitions FOR DELETE
  TO authenticated
  USING (
    is_system_role = false
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

-- ============================================================
-- Table 3: permission_levels
-- ============================================================
CREATE TABLE IF NOT EXISTS permission_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level integer NOT NULL UNIQUE CHECK (level >= 1 AND level <= 10),
  display_name text NOT NULL,
  description text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_permission_levels_level ON permission_levels(level);

-- Enable Row Level Security
ALTER TABLE permission_levels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permission_levels
CREATE POLICY "Anyone authenticated can view permission levels"
  ON permission_levels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert permission levels"
  ON permission_levels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Admins can update permission levels"
  ON permission_levels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Admins can delete permission levels"
  ON permission_levels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_role_definitions_updated_at BEFORE UPDATE ON role_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permission_levels_updated_at BEFORE UPDATE ON permission_levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Populate Initial Data
-- ============================================================

-- Insert default role definitions
INSERT INTO role_definitions (role_key, display_name, description, permissions, is_system_role)
VALUES
  (
    'admin',
    'Amministratore',
    'Accesso completo al sistema. Può gestire tutti i clienti, utenti, configurazioni e applicazioni. Può modificare ruoli e permessi.',
    '["manage_clients", "manage_users", "manage_configurations", "manage_applications", "manage_roles", "view_logs", "view_audit_logs"]'::jsonb,
    true
  ),
  (
    'manager',
    'Manager',
    'Gestisce utenti e configurazioni per i clienti assegnati. Può creare e modificare utenti nel proprio cliente.',
    '["manage_users_own_client", "manage_configurations_own_client", "view_applications", "view_logs_own_client"]'::jsonb,
    true
  ),
  (
    'user',
    'Utente',
    'Accesso standard alle applicazioni. Può visualizzare dati e utilizzare le applicazioni assegnate.',
    '["view_applications", "use_applications", "view_own_profile"]'::jsonb,
    true
  ),
  (
    'viewer',
    'Visualizzatore',
    'Accesso in sola lettura. Può solo visualizzare informazioni senza modificarle.',
    '["view_applications", "view_own_profile"]'::jsonb,
    true
  )
ON CONFLICT (role_key) DO NOTHING;

-- Insert default permission levels
INSERT INTO permission_levels (level, display_name, description, capabilities, is_active)
VALUES
  (
    1,
    'Accesso Base',
    'Livello di accesso minimo. Può visualizzare solo le informazioni base e utilizzare funzionalità limitate.',
    '["read_basic_data", "use_basic_features"]'::jsonb,
    true
  ),
  (
    2,
    'Accesso Standard',
    'Accesso alle funzionalità standard. Può visualizzare più dati e utilizzare feature comuni.',
    '["read_basic_data", "read_standard_data", "use_basic_features", "use_standard_features"]'::jsonb,
    true
  ),
  (
    3,
    'Accesso Avanzato',
    'Accesso a funzionalità avanzate. Può creare e modificare alcuni contenuti.',
    '["read_basic_data", "read_standard_data", "read_advanced_data", "use_basic_features", "use_standard_features", "use_advanced_features", "create_content"]'::jsonb,
    true
  ),
  (
    4,
    'Accesso Completo',
    'Accesso quasi completo. Può gestire la maggior parte delle operazioni senza restrizioni.',
    '["read_all_data", "use_all_features", "create_content", "edit_content", "delete_content"]'::jsonb,
    true
  ),
  (
    5,
    'Accesso Totale',
    'Accesso totale senza limiti. Può eseguire qualsiasi operazione all\'interno delle applicazioni.',
    '["read_all_data", "use_all_features", "create_content", "edit_content", "delete_content", "manage_settings", "export_data"]'::jsonb,
    true
  )
ON CONFLICT (level) DO NOTHING;

-- ============================================================
-- Migrate Existing Data
-- ============================================================

-- Populate user_clients with existing user-client relationships
-- This creates entries based on the existing client_id field in users table
INSERT INTO user_clients (user_id, client_id)
SELECT id, client_id
FROM users
WHERE client_id IS NOT NULL
ON CONFLICT (user_id, client_id) DO NOTHING;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE user_clients IS 'Junction table for many-to-many relationship between users and clients';
COMMENT ON TABLE role_definitions IS 'Metadata for system roles with customizable names, descriptions, and permissions';
COMMENT ON TABLE permission_levels IS 'Metadata for permission levels (1-10) with customizable properties';

COMMENT ON COLUMN user_clients.user_id IS 'Reference to the user';
COMMENT ON COLUMN user_clients.client_id IS 'Reference to the client';

COMMENT ON COLUMN role_definitions.role_key IS 'System role key (admin, manager, user, viewer)';
COMMENT ON COLUMN role_definitions.display_name IS 'Human-readable role name (customizable)';
COMMENT ON COLUMN role_definitions.description IS 'Detailed description of role capabilities';
COMMENT ON COLUMN role_definitions.permissions IS 'Array of permission strings defining what this role can do';
COMMENT ON COLUMN role_definitions.is_system_role IS 'Whether this is a built-in system role (cannot be deleted)';

COMMENT ON COLUMN permission_levels.level IS 'Numeric permission level (1-10)';
COMMENT ON COLUMN permission_levels.display_name IS 'Human-readable level name (customizable)';
COMMENT ON COLUMN permission_levels.description IS 'Detailed description of level capabilities';
COMMENT ON COLUMN permission_levels.capabilities IS 'Array of capability strings defining what this level grants';
COMMENT ON COLUMN permission_levels.is_active IS 'Whether this level is currently active and usable';

/*
  # Moca Hub - Complete Database Schema
  
  ## Overview
  Creates the complete database schema for the Moca Hub centralized management system.
  This migration establishes all necessary tables for managing clients, users, configurations,
  applications, and logging systems.
  
  ## New Tables
  
  ### 1. clients
  Stores all client organizations in the Moca ecosystem.
  - `id` (uuid, primary key) - Unique client identifier
  - `name` (text, required) - Client organization name
  - `email` (text, unique) - Client contact email
  - `logo_url` (text, optional) - URL to client logo
  - `status` (text) - Client status: active, inactive, suspended
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 2. users
  Stores all users with client associations and role-based access control.
  - `id` (uuid, primary key) - Unique user identifier
  - `client_id` (uuid, foreign key) - Associated client
  - `email` (text, unique, required) - User email for authentication
  - `name` (text, required) - User full name
  - `role` (text) - User role: admin, manager, user, viewer
  - `level` (integer) - Permission level 1-5
  - `status` (text) - User status: active, inactive, suspended
  - `last_login` (timestamptz) - Last login timestamp
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 3. configurations
  Stores client-specific configurations including API keys and environment variables.
  - `id` (uuid, primary key) - Unique configuration identifier
  - `client_id` (uuid, foreign key) - Associated client
  - `config_key` (text, required) - Configuration key name
  - `config_value` (text, required) - Configuration value (encrypted if sensitive)
  - `config_type` (text) - Type: api_key, variable, setting
  - `is_encrypted` (boolean) - Whether value is encrypted
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 4. applications
  Registry of all applications in the Moca ecosystem.
  - `id` (uuid, primary key) - Unique application identifier
  - `name` (text, required) - Application name
  - `description` (text) - Application description
  - `url` (text, required) - Application URL
  - `icon_url` (text, optional) - Application icon URL
  - `status` (text) - Application status: active, maintenance, inactive
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 5. application_access
  Manages user and client access permissions to applications.
  - `id` (uuid, primary key) - Unique access record identifier
  - `application_id` (uuid, foreign key) - Associated application
  - `user_id` (uuid, foreign key, nullable) - Specific user access
  - `client_id` (uuid, foreign key, nullable) - Client-wide access
  - `access_level` (text) - Access level: full, read_only, restricted
  - `created_at` (timestamptz) - Creation timestamp
  
  ### 6. logs
  System-wide logging for debugging and monitoring.
  - `id` (uuid, primary key) - Unique log identifier
  - `level` (text) - Log level: info, warning, error
  - `message` (text) - Log message
  - `data` (jsonb) - Additional log data
  - `user_id` (uuid, nullable) - Associated user if applicable
  - `timestamp` (timestamptz) - Log timestamp
  
  ### 7. audit_logs
  Audit trail for all system operations.
  - `id` (uuid, primary key) - Unique audit record identifier
  - `user_id` (uuid, foreign key) - User who performed the action
  - `action` (text) - Action performed (create, update, delete, login, etc.)
  - `entity_type` (text) - Type of entity affected (client, user, config, etc.)
  - `entity_id` (uuid) - ID of affected entity
  - `old_values` (jsonb) - Previous values (for updates)
  - `new_values` (jsonb) - New values (for creates/updates)
  - `ip_address` (text) - IP address of request
  - `timestamp` (timestamptz) - Action timestamp
  
  ## Security
  
  ### Row Level Security (RLS)
  All tables have RLS enabled with appropriate policies for:
  - Authenticated users can only access data for their assigned client
  - Admin users have full access across all clients
  - Manager users can manage users within their client
  - User and viewer roles have read-only access
  
  ### Policies
  Detailed policies are created for each table to ensure:
  - Data isolation between clients (multi-tenancy)
  - Role-based access control
  - Audit trail cannot be modified by users
  
  ## Indexes
  Performance indexes are created for:
  - Foreign key relationships
  - Frequently queried columns (email, status, client_id)
  - Timestamp columns for sorting
*/

-- Create custom types for enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'user', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE entity_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE app_status AS ENUM ('active', 'maintenance', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE config_type AS ENUM ('api_key', 'variable', 'setting');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE access_level AS ENUM ('full', 'read_only', 'restricted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE log_level AS ENUM ('info', 'warning', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Table 1: clients
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  logo_url text,
  status entity_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table 2: users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role user_role DEFAULT 'user',
  level integer DEFAULT 1 CHECK (level >= 1 AND level <= 5),
  status entity_status DEFAULT 'active',
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table 3: configurations
CREATE TABLE IF NOT EXISTS configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  config_key text NOT NULL,
  config_value text NOT NULL,
  config_type config_type DEFAULT 'setting',
  is_encrypted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, config_key)
);

-- Table 4: applications
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  url text NOT NULL,
  icon_url text,
  status app_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table 5: application_access
CREATE TABLE IF NOT EXISTS application_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  access_level access_level DEFAULT 'full',
  created_at timestamptz DEFAULT now(),
  CHECK (user_id IS NOT NULL OR client_id IS NOT NULL)
);

-- Table 6: logs
CREATE TABLE IF NOT EXISTS logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level log_level DEFAULT 'info',
  message text NOT NULL,
  data jsonb,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  timestamp timestamptz DEFAULT now()
);

-- Table 7: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  timestamp timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE INDEX IF NOT EXISTS idx_configurations_client_id ON configurations(client_id);
CREATE INDEX IF NOT EXISTS idx_configurations_config_type ON configurations(config_type);

CREATE INDEX IF NOT EXISTS idx_application_access_app_id ON application_access(application_id);
CREATE INDEX IF NOT EXISTS idx_application_access_user_id ON application_access(user_id);
CREATE INDEX IF NOT EXISTS idx_application_access_client_id ON application_access(client_id);

CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Enable Row Level Security on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients table
CREATE POLICY "Admins can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Users can view their own client"
  ON clients FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT client_id FROM users
      WHERE users.id = auth.uid()
      AND users.status = 'active'
    )
  );

CREATE POLICY "Admins can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Admins can update clients"
  ON clients FOR UPDATE
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

CREATE POLICY "Admins can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

-- RLS Policies for users table
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND u.status = 'active'
    )
  );

CREATE POLICY "Managers can view users in their client"
  ON users FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'admin')
      AND status = 'active'
    )
  );

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND u.status = 'active'
    )
  );

CREATE POLICY "Managers can insert users in their client"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM users
      WHERE id = auth.uid()
      AND role IN ('manager', 'admin')
      AND status = 'active'
    )
  );

CREATE POLICY "Admins and managers can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'manager')
      AND u.status = 'active'
      AND (u.role = 'admin' OR u.client_id = users.client_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'manager')
      AND u.status = 'active'
      AND (u.role = 'admin' OR u.client_id = users.client_id)
    )
  );

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND u.status = 'active'
    )
  );

-- RLS Policies for configurations table
CREATE POLICY "Admins can view all configurations"
  ON configurations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Users can view their client configurations"
  ON configurations FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM users
      WHERE id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Admins and managers can insert configurations"
  ON configurations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
      AND users.status = 'active'
      AND (users.role = 'admin' OR users.client_id = configurations.client_id)
    )
  );

CREATE POLICY "Admins and managers can update configurations"
  ON configurations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
      AND users.status = 'active'
      AND (users.role = 'admin' OR users.client_id = configurations.client_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
      AND users.status = 'active'
      AND (users.role = 'admin' OR users.client_id = configurations.client_id)
    )
  );

CREATE POLICY "Admins and managers can delete configurations"
  ON configurations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
      AND users.status = 'active'
      AND (users.role = 'admin' OR users.client_id = configurations.client_id)
    )
  );

-- RLS Policies for applications table
CREATE POLICY "Anyone authenticated can view applications"
  ON applications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert applications"
  ON applications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Admins can update applications"
  ON applications FOR UPDATE
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

CREATE POLICY "Admins can delete applications"
  ON applications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

-- RLS Policies for application_access table
CREATE POLICY "Admins can view all application access"
  ON application_access FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Users can view their own application access"
  ON application_access FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR client_id IN (
      SELECT client_id FROM users
      WHERE id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Admins can manage application access"
  ON application_access FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Admins can update application access"
  ON application_access FOR UPDATE
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

CREATE POLICY "Admins can delete application access"
  ON application_access FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

-- RLS Policies for logs table
CREATE POLICY "Admins can view all logs"
  ON logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "System can insert logs"
  ON logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for audit_logs table (read-only for users, system writes)
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.status = 'active'
    )
  );

CREATE POLICY "Managers can view audit logs for their client"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('manager', 'admin')
      AND u.status = 'active'
      AND (
        u.role = 'admin'
        OR audit_logs.user_id IN (
          SELECT id FROM users
          WHERE client_id = u.client_id
        )
      )
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configurations_updated_at BEFORE UPDATE ON configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
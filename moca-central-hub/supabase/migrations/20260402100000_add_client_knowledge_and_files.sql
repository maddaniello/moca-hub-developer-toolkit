-- ============================================
-- Migration: Add client knowledge base and file uploads
-- Date: 2026-04-02
-- Description: Adds tables for client knowledge base fields
--              and file uploads for AI-powered knowledge generation
-- ============================================

-- Table: client_knowledge
-- Stores knowledge base fields for each client (tone of voice, services, brand identity, custom fields, etc.)
CREATE TABLE IF NOT EXISTS client_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_value text NOT NULL DEFAULT '',
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'generated', 'custom')),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, field_key)
);

-- Table: client_files
-- Stores metadata about uploaded files for knowledge base generation
CREATE TABLE IF NOT EXISTS client_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size bigint,
  analyzed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE client_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_knowledge

-- Admins can do everything
CREATE POLICY "Admins full access to client_knowledge"
  ON client_knowledge FOR ALL
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

-- Managers can manage knowledge for their clients
CREATE POLICY "Managers can manage client_knowledge for their clients"
  ON client_knowledge FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN user_clients ON user_clients.user_id = users.id
      WHERE users.id = auth.uid()
      AND users.role = 'manager'
      AND users.status = 'active'
      AND user_clients.client_id = client_knowledge.client_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      JOIN user_clients ON user_clients.user_id = users.id
      WHERE users.id = auth.uid()
      AND users.role = 'manager'
      AND users.status = 'active'
      AND user_clients.client_id = client_knowledge.client_id
    )
  );

-- Users/viewers can read knowledge for their clients
CREATE POLICY "Users can view client_knowledge for their clients"
  ON client_knowledge FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_clients
      WHERE user_clients.user_id = auth.uid()
      AND user_clients.client_id = client_knowledge.client_id
    )
  );

-- RLS Policies for client_files

CREATE POLICY "Admins full access to client_files"
  ON client_files FOR ALL
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

CREATE POLICY "Managers can manage client_files for their clients"
  ON client_files FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN user_clients ON user_clients.user_id = users.id
      WHERE users.id = auth.uid()
      AND users.role = 'manager'
      AND users.status = 'active'
      AND user_clients.client_id = client_files.client_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      JOIN user_clients ON user_clients.user_id = users.id
      WHERE users.id = auth.uid()
      AND users.role = 'manager'
      AND users.status = 'active'
      AND user_clients.client_id = client_files.client_id
    )
  );

CREATE POLICY "Users can view client_files for their clients"
  ON client_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_clients
      WHERE user_clients.user_id = auth.uid()
      AND user_clients.client_id = client_files.client_id
    )
  );

-- Trigger for updated_at on client_knowledge
CREATE TRIGGER update_client_knowledge_updated_at BEFORE UPDATE ON client_knowledge
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for client files (run manually in Supabase dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('client-files', 'client-files', false);

-- ============================================
-- Migration: Add client detail fields and contracts table
-- Date: 2026-04-03
-- Description: Adds drive_url and project_url to clients,
--              creates client_contracts table for PDF uploads
--              with AI analysis capability
-- ============================================

-- New fields on clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS drive_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS project_url text;

-- Table: client_contracts
CREATE TABLE IF NOT EXISTS client_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  analysis text,
  analyzed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_contracts ENABLE ROW LEVEL SECURITY;

-- RLS: Admins full access
CREATE POLICY "Admins full access to client_contracts"
  ON client_contracts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin' AND users.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin' AND users.status = 'active'));

-- RLS: Managers can manage contracts for their clients
CREATE POLICY "Managers can manage client_contracts"
  ON client_contracts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active' AND user_clients.client_id = client_contracts.client_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users JOIN user_clients ON user_clients.user_id = users.id WHERE users.id = auth.uid() AND users.role = 'manager' AND users.status = 'active' AND user_clients.client_id = client_contracts.client_id));

-- RLS: Users can view contracts for their clients
CREATE POLICY "Users can view client_contracts"
  ON client_contracts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_clients WHERE user_clients.user_id = auth.uid() AND user_clients.client_id = client_contracts.client_id));

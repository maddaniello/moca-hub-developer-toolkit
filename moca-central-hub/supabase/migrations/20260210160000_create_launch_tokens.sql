/*
  # App Launch Tokens
  
  Creates the `app_launch_tokens` table for secure, single-use launch tokens
  that allow Moca Hub to pass client context + API keys to external apps.

  ## Table: app_launch_tokens
  - `token` (text, unique) - Random 64-char hex token
  - `user_id` (uuid) - User who requested the launch
  - `client_id` (uuid) - Client whose config should be loaded
  - `application_id` (uuid) - Target application
  - `expires_at` (timestamptz) - Token expiration (5 minutes from creation)
  - `consumed_at` (timestamptz) - When the token was validated (NULL = not yet used)
*/

-- Table: app_launch_tokens
CREATE TABLE IF NOT EXISTS app_launch_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_launch_tokens_token ON app_launch_tokens(token);
CREATE INDEX IF NOT EXISTS idx_launch_tokens_expires ON app_launch_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_launch_tokens_user ON app_launch_tokens(user_id);

-- Enable RLS
ALTER TABLE app_launch_tokens ENABLE ROW LEVEL SECURITY;

-- RLS: Only allow service role (admin client) to manage tokens
-- No direct access from browser - all access goes through Netlify Functions
CREATE POLICY "Service role manages launch tokens"
  ON app_launch_tokens FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Cleanup function: delete expired and consumed tokens older than 1 hour
CREATE OR REPLACE FUNCTION cleanup_expired_launch_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM app_launch_tokens
  WHERE expires_at < now() - interval '1 hour'
    OR (consumed_at IS NOT NULL AND consumed_at < now() - interval '1 hour');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

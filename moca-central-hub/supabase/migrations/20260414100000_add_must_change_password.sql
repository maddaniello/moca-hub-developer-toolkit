-- Add must_change_password flag to users table
-- When true, user is forced to change password on next login
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

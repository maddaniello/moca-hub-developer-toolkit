-- ============================================================
-- STEP 1: Add new enum values (must be committed separately)
-- ============================================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'specialist';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'external';

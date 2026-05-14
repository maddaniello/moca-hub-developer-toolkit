-- ============================================================
-- Moca Hub - First Admin User Setup
-- ============================================================
-- This script helps you create the first admin user in the system
--
-- IMPORTANT: Before running this script:
-- 1. Create an authentication user in Supabase Dashboard:
--    - Go to Authentication → Users → Add user
--    - Create user with email and password
--    - Copy the User ID (UUID)
--
-- 2. Replace the placeholders in this script:
--    - Replace YOUR_AUTH_USER_ID with the UUID from Supabase Auth
--    - Replace YOUR_EMAIL with the email used in Supabase Auth
--    - Replace YOUR_NAME with the admin's full name
-- ============================================================

-- Step 1: Create the main client organization
INSERT INTO clients (name, email, status)
VALUES ('Moca Interactive', 'admin@mocainteractive.com', 'active')
RETURNING id;

-- Note the client ID returned above, then use it in the next step
-- Or run this query to get the client ID:
-- SELECT id FROM clients WHERE name = 'Moca Interactive';

-- Step 2: Create the admin user record
-- Replace the placeholders with actual values
INSERT INTO users (
  id,           -- Use the User ID from Supabase Auth
  client_id,    -- Use the Client ID from Step 1
  email,        -- Same email as in Supabase Auth
  name,         -- Admin's full name
  role,
  level,
  status
)
VALUES (
  'YOUR_AUTH_USER_ID',  -- Replace with UUID from Supabase Auth
  'YOUR_CLIENT_ID',     -- Replace with Client ID from Step 1
  'YOUR_EMAIL',         -- Replace with your email
  'YOUR_NAME',          -- Replace with your name
  'admin',
  5,
  'active'
);

-- ============================================================
-- Example with actual values (for reference):
-- ============================================================
-- INSERT INTO users (id, client_id, email, name, role, level, status)
-- VALUES (
--   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--   'b2c3d4e5-f6a7-8901-bcde-f12345678901',
--   'admin@mocainteractive.com',
--   'Admin User',
--   'admin',
--   5,
--   'active'
-- );

-- ============================================================
-- Verification Queries
-- ============================================================
-- After running the above, verify everything is set up correctly:

-- Check if client was created
SELECT * FROM clients WHERE name = 'Moca Interactive';

-- Check if admin user was created
SELECT u.*, c.name as client_name
FROM users u
JOIN clients c ON u.client_id = c.id
WHERE u.role = 'admin';

-- ============================================================
-- Optional: Create Sample Data for Testing
-- ============================================================

-- Create additional clients
INSERT INTO clients (name, email, status)
VALUES
  ('Sample Company 1', 'contact@sample1.com', 'active'),
  ('Sample Company 2', 'contact@sample2.com', 'active'),
  ('Test Organization', 'test@example.com', 'inactive');

-- Create sample applications
INSERT INTO applications (name, description, url, status)
VALUES
  ('Analytics Dashboard', 'Real-time analytics and reporting platform', 'https://analytics.example.com', 'active'),
  ('CRM System', 'Customer relationship management', 'https://crm.example.com', 'active'),
  ('Project Manager', 'Project and task management tool', 'https://projects.example.com', 'maintenance'),
  ('Document Portal', 'Secure document sharing and collaboration', 'https://docs.example.com', 'active');

-- Note: Additional users must be created in Supabase Auth first,
-- then linked in the users table using their auth UUID

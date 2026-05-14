-- Fix specific user role
UPDATE users 
SET role = 'admin', level = 5 
WHERE email = 'daniele.pisciottano@mocainteractive.com';

-- Create a secure function to update last_login
-- This bypasses RLS constraints for this specific field only
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS void AS $$
BEGIN
  UPDATE users
  SET last_login = now()
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

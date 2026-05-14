-- Fix Privilege Escalation Vulnerability
-- Ensure Managers cannot assign 'admin' role or modify 'level' beyond their own (or strict logic)

-- 1. Create a secure function to validate role assignment
CREATE OR REPLACE FUNCTION validate_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  performer_role user_role;
BEGIN
  -- Get the role of the user performing the action
  SELECT role INTO performer_role FROM users WHERE id = auth.uid();
  
  -- If Admin, allow everything
  IF performer_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- If Manager, check constraints
  IF performer_role = 'manager' THEN
    -- Cannot assign 'admin' role
    IF NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Managers cannot assign Admin role';
    END IF;
    
    -- Cannot assign level > 3 (assuming Manager is 3, or just strict limit)
    -- Let's say Managers can assign up to level 3.
    IF NEW.level > 3 THEN
       RAISE EXCEPTION 'Managers cannot assign level higher than 3';
    END IF;
    
    RETURN NEW;
  END IF;

  -- If User/Viewer, they typically can't insert/update users anyway due to RLS,
  -- but if they could, we'd block role changes here too.
  RAISE EXCEPTION 'Unauthorized role assignment';
END;
$$;

-- 2. Create Trigger on users table
DROP TRIGGER IF EXISTS check_role_assignment ON users;

CREATE TRIGGER check_role_assignment
  BEFORE INSERT OR UPDATE OF role, level
  ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_role_assignment();

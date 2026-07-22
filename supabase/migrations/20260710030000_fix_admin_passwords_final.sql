-- Fix admin passwords: regenerate bcrypt hashes and recreate verify function
-- This ensures compatibility regardless of which prior migrations ran

-- 1. Regenerate all password hashes using extensions schema
UPDATE admin_accounts
SET password_hash = extensions.crypt('Admin123', extensions.gen_salt('bf'))
WHERE email = 'admin@shop.uz';

UPDATE admin_accounts
SET password_hash = extensions.crypt('Manager123', extensions.gen_salt('bf'))
WHERE email = 'manager@shop.uz';

UPDATE admin_accounts
SET password_hash = extensions.crypt('Seller123', extensions.gen_salt('bf'))
WHERE email = 'seller@shop.uz';

-- 2. Recreate verify_admin_password with extensions.crypt
CREATE OR REPLACE FUNCTION verify_admin_password(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
  v_valid boolean := false;
BEGIN
  SELECT id, email, first_name, role, password_hash, is_active
  INTO v_admin
  FROM admin_accounts
  WHERE email = lower(trim(p_email))
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Admin not found');
  END IF;

  -- Bcrypt verification only
  IF v_admin.password_hash LIKE '$2%' THEN
    IF extensions.crypt(p_password, v_admin.password_hash) = v_admin.password_hash THEN
      v_valid := true;
    END IF;
  END IF;

  IF NOT v_valid THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid password');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', v_admin.id,
    'email', v_admin.email,
    'first_name', v_admin.first_name,
    'role', v_admin.role
  );
END;
$$;

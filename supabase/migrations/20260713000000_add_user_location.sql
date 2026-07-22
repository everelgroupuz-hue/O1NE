-- Add latitude and longitude columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude double precision;

-- Update upsert_user to accept lat/lng
CREATE OR REPLACE FUNCTION public.upsert_user(
  p_telegram_id bigint,
  p_first_name text,
  p_username text DEFAULT NULL,
  p_language text DEFAULT 'ru',
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL
)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.users (telegram_id, first_name, username, language, phone, address, latitude, longitude, updated_at)
  VALUES (p_telegram_id, p_first_name, p_username, p_language, p_phone, p_address, p_latitude, p_longitude, now())
  ON CONFLICT (telegram_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    username = EXCLUDED.username,
    language = EXCLUDED.language,
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    address = COALESCE(EXCLUDED.address, public.users.address),
    latitude = COALESCE(EXCLUDED.latitude, public.users.latitude),
    longitude = COALESCE(EXCLUDED.longitude, public.users.longitude),
    updated_at = now()
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_user(bigint, text, text, text, text, text, double precision, double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_user(bigint, text, text, text, text, text, double precision, double precision) TO service_role;

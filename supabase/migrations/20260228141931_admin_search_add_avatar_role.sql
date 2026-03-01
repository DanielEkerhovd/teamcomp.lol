-- Add avatar_url and role to admin_search_users return type.

DROP FUNCTION IF EXISTS public.admin_search_users(TEXT);

CREATE OR REPLACE FUNCTION public.admin_search_users(search_query TEXT)
RETURNS TABLE (
  id              UUID,
  display_name    TEXT,
  email           TEXT,
  avatar_url      TEXT,
  tier            TEXT,
  role            TEXT,
  tier_expires_at TIMESTAMPTZ,
  banned_at       TIMESTAMPTZ,
  ban_reason      TEXT,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT p.id, p.display_name, p.email, p.avatar_url, p.tier, p.role,
         p.tier_expires_at, p.banned_at, p.ban_reason, p.created_at
  FROM profiles p
  WHERE p.display_name ILIKE '%' || search_query || '%'
     OR p.id::text = search_query
  ORDER BY p.created_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_search_users(TEXT) TO authenticated;

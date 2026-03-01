-- Force drop ALL overloads of check_team_name_available and recreate
DROP FUNCTION IF EXISTS check_team_name_available(text, uuid);
DROP FUNCTION IF EXISTS check_team_name_available(text, text);
DROP FUNCTION IF EXISTS check_team_name_available(text);

CREATE FUNCTION check_team_name_available(p_team_name text, p_exclude_team_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    name_exists boolean;
    v_exclude_id uuid;
BEGIN
    IF p_exclude_team_id IS NOT NULL AND p_exclude_team_id <> '' THEN
        v_exclude_id := p_exclude_team_id::uuid;
    END IF;

    IF v_exclude_id IS NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(p_team_name)
        ) INTO name_exists;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(p_team_name)
            AND id <> v_exclude_id
        ) INTO name_exists;
    END IF;

    RETURN NOT name_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION check_team_name_available(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_team_name_available(text, text) TO anon;

NOTIFY pgrst, 'reload schema';

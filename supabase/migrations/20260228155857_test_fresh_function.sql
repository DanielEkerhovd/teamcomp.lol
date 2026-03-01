-- Test: fresh function to verify the SQL logic works
CREATE FUNCTION check_team_name_available_v2(team_name text, exclude_team_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    name_exists boolean;
    v_exclude_id uuid;
BEGIN
    IF exclude_team_id IS NOT NULL AND exclude_team_id <> '' THEN
        v_exclude_id := exclude_team_id::uuid;
    END IF;

    IF v_exclude_id IS NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(team_name)
        ) INTO name_exists;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(team_name)
            AND id <> v_exclude_id
        ) INTO name_exists;
    END IF;

    RETURN NOT name_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION check_team_name_available_v2(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_team_name_available_v2(text, text) TO anon;

NOTIFY pgrst, 'reload schema';

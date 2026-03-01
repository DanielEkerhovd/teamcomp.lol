-- Fix: my_teams.id is TEXT (not UUID), so compare text <> text directly.
DROP FUNCTION IF EXISTS check_team_name_available(text, text);
DROP FUNCTION IF EXISTS check_team_name_available_v2(text, text);

CREATE FUNCTION check_team_name_available(team_name text, exclude_team_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    name_exists boolean;
BEGIN
    IF exclude_team_id IS NULL OR exclude_team_id = '' THEN
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(team_name)
        ) INTO name_exists;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(team_name)
            AND id <> exclude_team_id
        ) INTO name_exists;
    END IF;

    RETURN NOT name_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION check_team_name_available(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_team_name_available(text, text) TO anon;

NOTIFY pgrst, 'reload schema';

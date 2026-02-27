-- Create a function to check if a team name is globally available
-- This function uses SECURITY DEFINER to bypass RLS and check all teams
CREATE OR REPLACE FUNCTION check_team_name_available(team_name text, exclude_team_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    name_exists boolean;
BEGIN
    IF exclude_team_id IS NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(team_name)
        ) INTO name_exists;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(team_name)
            AND id != exclude_team_id
        ) INTO name_exists;
    END IF;

    -- Return true if name is available (doesn't exist), false if taken
    RETURN NOT name_exists;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_team_name_available(text, uuid) TO authenticated;

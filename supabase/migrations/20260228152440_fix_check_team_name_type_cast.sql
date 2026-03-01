-- Fix: change exclude_team_id parameter from uuid to text
-- PostgREST sends JSON values as text, so the function signature must accept text
-- to avoid "operator does not exist: text <> uuid" errors.

-- Drop the old function signature first
DROP FUNCTION IF EXISTS check_team_name_available(text, uuid);

CREATE OR REPLACE FUNCTION check_team_name_available(team_name text, exclude_team_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    name_exists boolean;
    _exclude_id uuid;
BEGIN
    -- Cast text to uuid if provided
    IF exclude_team_id IS NOT NULL AND exclude_team_id <> '' THEN
        _exclude_id := exclude_team_id::uuid;
    END IF;

    IF _exclude_id IS NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(team_name)
        ) INTO name_exists;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM my_teams
            WHERE LOWER(name) = LOWER(team_name)
            AND id <> _exclude_id
        ) INTO name_exists;
    END IF;

    RETURN NOT name_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION check_team_name_available(text, text) TO authenticated;

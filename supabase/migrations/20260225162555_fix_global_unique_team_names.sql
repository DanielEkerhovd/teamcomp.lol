-- Fix: Ensure globally unique team names
-- Drop any existing indexes first
DROP INDEX IF EXISTS my_teams_user_id_name_unique;
DROP INDEX IF EXISTS my_teams_name_globally_unique;

-- Rename duplicate team names by appending a unique suffix
UPDATE my_teams t1
SET name = t1.name || ' #' || t1.id::text
WHERE EXISTS (
    SELECT 1 FROM my_teams t2
    WHERE LOWER(t2.name) = LOWER(t1.name)
    AND t2.id < t1.id
);

-- Create the globally unique index
CREATE UNIQUE INDEX my_teams_name_globally_unique
ON my_teams (LOWER(name));

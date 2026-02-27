-- Force globally unique team names using a generated column with constraint

-- Drop existing indexes
DROP INDEX IF EXISTS my_teams_user_id_name_unique;
DROP INDEX IF EXISTS my_teams_name_globally_unique;

-- First, fix any existing duplicates by appending the ID
WITH duplicates AS (
    SELECT id, name,
           ROW_NUMBER() OVER (PARTITION BY LOWER(name) ORDER BY created_at) as rn
    FROM my_teams
)
UPDATE my_teams
SET name = my_teams.name || ' #' || SUBSTRING(my_teams.id::text, 1, 8)
FROM duplicates
WHERE my_teams.id = duplicates.id AND duplicates.rn > 1;

-- Add a generated column for lowercase name
ALTER TABLE my_teams
ADD COLUMN IF NOT EXISTS name_lower text GENERATED ALWAYS AS (LOWER(name)) STORED;

-- Add unique constraint on the generated column
ALTER TABLE my_teams
ADD CONSTRAINT my_teams_name_unique UNIQUE (name_lower);

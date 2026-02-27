-- Add unique constraint on team names per user (case-insensitive)
-- This prevents duplicate team names for the same user

-- First, handle any existing duplicates by appending a number
DO $$
DECLARE
    dup RECORD;
    counter INT;
    new_name TEXT;
BEGIN
    FOR dup IN
        SELECT id, user_id, name,
               ROW_NUMBER() OVER (PARTITION BY user_id, LOWER(name) ORDER BY created_at) as rn
        FROM my_teams
    LOOP
        IF dup.rn > 1 THEN
            counter := dup.rn;
            new_name := dup.name || ' (' || counter || ')';

            -- Make sure the new name doesn't conflict either
            WHILE EXISTS (
                SELECT 1 FROM my_teams
                WHERE user_id = dup.user_id
                AND LOWER(name) = LOWER(new_name)
                AND id != dup.id
            ) LOOP
                counter := counter + 1;
                new_name := dup.name || ' (' || counter || ')';
            END LOOP;

            UPDATE my_teams SET name = new_name WHERE id = dup.id;
        END IF;
    END LOOP;
END $$;

-- Create a unique index on user_id and lowercase name
CREATE UNIQUE INDEX my_teams_user_id_name_unique
ON my_teams (user_id, LOWER(name));

-- Also handle enemy_teams duplicates
DO $$
DECLARE
    dup RECORD;
    counter INT;
    new_name TEXT;
BEGIN
    FOR dup IN
        SELECT id, user_id, name,
               ROW_NUMBER() OVER (PARTITION BY user_id, LOWER(name) ORDER BY created_at) as rn
        FROM enemy_teams
    LOOP
        IF dup.rn > 1 THEN
            counter := dup.rn;
            new_name := dup.name || ' (' || counter || ')';

            -- Make sure the new name doesn't conflict either
            WHILE EXISTS (
                SELECT 1 FROM enemy_teams
                WHERE user_id = dup.user_id
                AND LOWER(name) = LOWER(new_name)
                AND id != dup.id
            ) LOOP
                counter := counter + 1;
                new_name := dup.name || ' (' || counter || ')';
            END LOOP;

            UPDATE enemy_teams SET name = new_name WHERE id = dup.id;
        END IF;
    END LOOP;
END $$;

-- Create a unique index on user_id and lowercase name for enemy teams
CREATE UNIQUE INDEX enemy_teams_user_id_name_unique
ON enemy_teams (user_id, LOWER(name));

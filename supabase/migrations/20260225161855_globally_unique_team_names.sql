-- Make team names globally unique (case-insensitive)
-- This replaces the per-user uniqueness with global uniqueness

-- Drop the per-user unique index if it exists
DROP INDEX IF EXISTS my_teams_user_id_name_unique;

-- Handle any existing global duplicates by appending user identifier
DO $$
DECLARE
    dup RECORD;
    counter INT;
    new_name TEXT;
BEGIN
    FOR dup IN
        SELECT mt.id, mt.user_id, mt.name, p.username,
               ROW_NUMBER() OVER (PARTITION BY LOWER(mt.name) ORDER BY mt.created_at) as rn
        FROM my_teams mt
        LEFT JOIN profiles p ON p.id = mt.user_id
    LOOP
        IF dup.rn > 1 THEN
            -- Try appending username first
            IF dup.username IS NOT NULL THEN
                new_name := dup.name || ' (' || dup.username || ')';
            ELSE
                new_name := dup.name || ' (' || SUBSTRING(dup.user_id::text, 1, 8) || ')';
            END IF;

            counter := 1;
            -- Make sure the new name doesn't conflict either
            WHILE EXISTS (
                SELECT 1 FROM my_teams
                WHERE LOWER(name) = LOWER(new_name)
                AND id != dup.id
            ) LOOP
                counter := counter + 1;
                IF dup.username IS NOT NULL THEN
                    new_name := dup.name || ' (' || dup.username || ' ' || counter || ')';
                ELSE
                    new_name := dup.name || ' (' || SUBSTRING(dup.user_id::text, 1, 8) || ' ' || counter || ')';
                END IF;
            END LOOP;

            UPDATE my_teams SET name = new_name WHERE id = dup.id;
        END IF;
    END LOOP;
END $$;

-- Create a globally unique index on lowercase name
CREATE UNIQUE INDEX my_teams_name_globally_unique
ON my_teams (LOWER(name));

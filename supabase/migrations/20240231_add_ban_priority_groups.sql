-- Migration: Add ban_groups and priority_groups columns to draft_sessions
-- These columns store the grouped format for bans and priorities

-- Add ban_groups column (JSONB array of groups)
ALTER TABLE public.draft_sessions
ADD COLUMN IF NOT EXISTS ban_groups JSONB DEFAULT '[]';

-- Add priority_groups column (JSONB array of groups)
ALTER TABLE public.draft_sessions
ADD COLUMN IF NOT EXISTS priority_groups JSONB DEFAULT '[]';

-- Migrate existing data from legacy columns to new group format
-- This converts potential_bans array into a single "Bans" group
UPDATE public.draft_sessions
SET ban_groups = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid(),
    'name', 'Bans',
    'championIds', COALESCE(
      (SELECT jsonb_agg(elem) FROM unnest(potential_bans) AS elem),
      '[]'::jsonb
    )
  )
)
WHERE potential_bans IS NOT NULL
  AND array_length(potential_bans, 1) > 0
  AND (ban_groups IS NULL OR ban_groups = '[]'::jsonb);

-- Migrate priority_picks to priority_groups
-- Handle both TEXT[] and JSONB formats
UPDATE public.draft_sessions
SET priority_groups = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid(),
    'name', 'Priorities',
    'championIds', CASE
      WHEN jsonb_typeof(to_jsonb(priority_picks)) = 'array' THEN to_jsonb(priority_picks)
      ELSE '[]'::jsonb
    END
  )
)
WHERE priority_picks IS NOT NULL
  AND priority_picks != '{}'
  AND (priority_groups IS NULL OR priority_groups = '[]'::jsonb);

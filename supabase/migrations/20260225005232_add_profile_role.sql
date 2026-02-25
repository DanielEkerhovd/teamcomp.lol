-- Add role fields to profiles table
-- role: The user's role type (team_owner, head_coach, coach, analyst, player, groupie, custom)
-- role_team_id: Reference to which team this role is for (optional)
-- role_custom: Custom role text when role is 'custom' (optional)

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS role_team_id TEXT DEFAULT NULL REFERENCES public.my_teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS role_custom TEXT DEFAULT NULL;

-- Add check constraint for valid role values
ALTER TABLE public.profiles
ADD CONSTRAINT valid_role CHECK (
  role IS NULL OR
  role IN ('team_owner', 'head_coach', 'coach', 'analyst', 'player', 'groupie', 'custom')
);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.role IS 'User role type: team_owner, head_coach, coach, analyst, player, groupie, or custom';
COMMENT ON COLUMN public.profiles.role_team_id IS 'Reference to the team this role is associated with';
COMMENT ON COLUMN public.profiles.role_custom IS 'Custom role text when role is set to custom';

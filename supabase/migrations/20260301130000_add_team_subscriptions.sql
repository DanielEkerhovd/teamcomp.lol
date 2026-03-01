-- Team Subscription Plan: schema changes, triggers, RLS, and invite logic updates
-- Adds team-level subscriptions (€15/month) for unlimited team drafts, 300 shared enemy teams,
-- configurable content permissions, and archive mode on expiry.

-- ============================================
-- 1. ADD COLUMNS TO my_teams
-- ============================================

ALTER TABLE public.my_teams
  ADD COLUMN IF NOT EXISTS has_team_plan BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS team_plan_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS team_max_enemy_teams INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS team_content_permission TEXT NOT NULL DEFAULT 'admins';

COMMENT ON COLUMN public.my_teams.has_team_plan IS 'Whether this team has an active team subscription';
COMMENT ON COLUMN public.my_teams.team_plan_status IS 'active, past_due, canceling, canceled';
COMMENT ON COLUMN public.my_teams.team_max_enemy_teams IS '0 for free teams, 300 for paid teams';
COMMENT ON COLUMN public.my_teams.team_content_permission IS 'admins = owner+admins, players = owner+admins+players, all = everyone';

-- ============================================
-- 2. ADD team_id TO subscriptions TABLE
-- ============================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS team_id TEXT DEFAULT NULL REFERENCES public.my_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_team_id ON public.subscriptions(team_id) WHERE team_id IS NOT NULL;

-- ============================================
-- 3. ADD team_id TO enemy_teams TABLE
-- ============================================

ALTER TABLE public.enemy_teams
  ADD COLUMN IF NOT EXISTS team_id TEXT DEFAULT NULL REFERENCES public.my_teams(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_enemy_teams_team_id ON public.enemy_teams(team_id) WHERE team_id IS NOT NULL;

-- ============================================
-- 4. UPDATE Pro tier max_teams: 3 → 5
-- ============================================

UPDATE public.profiles SET max_teams = 5 WHERE tier IN ('paid', 'supporter', 'beta') AND max_teams < 5;

CREATE OR REPLACE FUNCTION public.apply_tier_limits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    CASE NEW.tier
      WHEN 'free' THEN
        NEW.max_teams := 1;
        NEW.max_enemy_teams := 10;
        NEW.max_drafts := 20;
      WHEN 'beta' THEN
        NEW.max_teams := 5;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
      WHEN 'paid' THEN
        NEW.max_teams := 5;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
      WHEN 'supporter' THEN
        NEW.max_teams := 5;
        NEW.max_enemy_teams := 30;
        NEW.max_drafts := 300;
      WHEN 'admin', 'developer' THEN
        NEW.max_teams := 2147483647;
        NEW.max_enemy_teams := 2147483647;
        NEW.max_drafts := 2147483647;
      ELSE
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. UPDATE check_draft_limit() — exclude paid team drafts
-- ============================================

CREATE OR REPLACE FUNCTION public.check_draft_limit()
RETURNS TRIGGER AS $$
DECLARE
  draft_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Allow updates to existing drafts (upsert case)
  IF EXISTS (SELECT 1 FROM public.draft_sessions WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- If this draft is for a team with an active team plan, no personal limit applies
  IF NEW.my_team_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE id = NEW.my_team_id AND has_team_plan = TRUE
    ) THEN
      RETURN NEW;  -- Team plan = unlimited team drafts
    END IF;
  END IF;

  -- Count personal drafts (exclude drafts linked to paid teams)
  SELECT COUNT(*) INTO draft_count
  FROM public.draft_sessions ds
  WHERE ds.user_id = NEW.user_id
    AND (ds.my_team_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM public.my_teams mt
           WHERE mt.id = ds.my_team_id AND mt.has_team_plan = TRUE
         ));

  -- Get user's max allowed drafts
  SELECT max_drafts INTO max_allowed
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF draft_count >= COALESCE(max_allowed, 20) THEN
    RAISE EXCEPTION 'Draft limit reached. Upgrade to create more drafts.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. UPDATE check_enemy_team_limit() — handle team enemy teams
-- ============================================

CREATE OR REPLACE FUNCTION public.check_enemy_team_limit()
RETURNS TRIGGER AS $$
DECLARE
  team_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Allow updates to existing teams (upsert case)
  IF EXISTS (SELECT 1 FROM public.enemy_teams WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- If this is a team enemy team, check against the team's limit
  IF NEW.team_id IS NOT NULL THEN
    SELECT COUNT(*) INTO team_count
    FROM public.enemy_teams
    WHERE team_id = NEW.team_id;

    SELECT team_max_enemy_teams INTO max_allowed
    FROM public.my_teams
    WHERE id = NEW.team_id;

    IF team_count >= COALESCE(max_allowed, 0) THEN
      RAISE EXCEPTION 'Team enemy team limit reached (% / %).', team_count, COALESCE(max_allowed, 0);
    END IF;

    RETURN NEW;
  END IF;

  -- Personal enemy team: count only personal ones (team_id IS NULL)
  SELECT COUNT(*) INTO team_count
  FROM public.enemy_teams
  WHERE user_id = NEW.user_id AND team_id IS NULL;

  -- Get user's max allowed enemy teams
  SELECT max_enemy_teams INTO max_allowed
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF team_count >= COALESCE(max_allowed, 10) THEN
    RAISE EXCEPTION 'Enemy team limit reached. Upgrade to create more enemy teams.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. ARCHIVE MODE: block edits to archived team drafts
-- ============================================

CREATE OR REPLACE FUNCTION public.check_team_draft_archive()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check for UPDATE/DELETE on drafts linked to a team
  IF OLD.my_team_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE id = OLD.my_team_id
        AND has_team_plan = FALSE
        AND team_plan_status = 'canceled'
    ) THEN
      RAISE EXCEPTION 'This team draft is archived. The team plan has expired.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_team_draft_archive
  BEFORE UPDATE OR DELETE ON public.draft_sessions
  FOR EACH ROW EXECUTE FUNCTION public.check_team_draft_archive();

-- Archive mode for team enemy teams
CREATE OR REPLACE FUNCTION public.check_team_enemy_archive()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.team_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.my_teams
      WHERE id = OLD.team_id
        AND has_team_plan = FALSE
        AND team_plan_status = 'canceled'
    ) THEN
      RAISE EXCEPTION 'This team enemy team is archived. The team plan has expired.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_team_enemy_archive
  BEFORE UPDATE OR DELETE ON public.enemy_teams
  FOR EACH ROW EXECUTE FUNCTION public.check_team_enemy_archive();

-- ============================================
-- 8. UPDATE check_team_limit() — exclude paid teams from member count
-- ============================================

CREATE OR REPLACE FUNCTION public.check_team_limit()
RETURNS TRIGGER AS $$
DECLARE
  owned_count INTEGER;
  membership_count INTEGER;
  total_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Check if this team already exists (upsert case)
  IF EXISTS (SELECT 1 FROM public.my_teams WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Count owned teams for this user
  SELECT COUNT(*) INTO owned_count
  FROM public.my_teams
  WHERE user_id = NEW.user_id;

  -- Count teams user is a member of (exclude paid teams)
  SELECT COUNT(*) INTO membership_count
  FROM public.team_members tm
  JOIN public.my_teams mt ON mt.id = tm.team_id
  WHERE tm.user_id = NEW.user_id
    AND mt.has_team_plan = FALSE;

  total_count := owned_count + membership_count;

  -- Get user's max allowed teams
  SELECT max_teams INTO max_allowed
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF total_count >= COALESCE(max_allowed, 1) THEN
    RAISE EXCEPTION 'Team limit reached. Upgrade to create more teams.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. UPDATE respond_to_team_invite() — exclude paid teams from limit check
-- ============================================

CREATE OR REPLACE FUNCTION public.respond_to_team_invite(
  p_invite_id UUID,
  p_accept BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  invite_record RECORD;
  team_record RECORD;
  user_profile RECORD;
  new_member_id UUID;
  owned_count INTEGER;
  membership_count INTEGER;
  total_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Find pending invite for this user
  SELECT * INTO invite_record FROM public.team_invites
  WHERE id = p_invite_id
    AND invited_user_id = auth.uid()
    AND status = 'pending';

  IF invite_record IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Invite not found or already responded');
  END IF;

  -- Check expiration
  IF invite_record.expires_at IS NOT NULL AND invite_record.expires_at < NOW() THEN
    UPDATE public.team_invites SET status = 'declined' WHERE id = p_invite_id;
    RETURN json_build_object('success', FALSE, 'error', 'Invite has expired');
  END IF;

  -- Get team and user info
  SELECT * INTO team_record FROM public.my_teams WHERE id = invite_record.team_id;
  SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();

  IF team_record IS NULL THEN
    UPDATE public.team_invites SET status = 'declined' WHERE id = p_invite_id;
    RETURN json_build_object('success', FALSE, 'error', 'Team no longer exists');
  END IF;

  IF p_accept THEN
    -- If the team has a team plan, skip the limit check entirely
    IF team_record.has_team_plan = FALSE THEN
      -- Count total teams (owned + non-paid memberships) against max_teams limit
      SELECT COUNT(*) INTO owned_count
      FROM public.my_teams
      WHERE user_id = auth.uid();

      SELECT COUNT(*) INTO membership_count
      FROM public.team_members tm
      JOIN public.my_teams mt ON mt.id = tm.team_id
      WHERE tm.user_id = auth.uid()
        AND mt.has_team_plan = FALSE;

      total_count := owned_count + membership_count;

      IF total_count >= COALESCE(user_profile.max_teams, 1) THEN
        RETURN json_build_object(
          'success', FALSE,
          'conflict', 'free_tier_team_limit',
          'inviteTeamId', team_record.id,
          'inviteTeamName', team_record.name,
          'inviteRole', invite_record.role
        );
      END IF;
    END IF;

    -- Check if already a member (edge case)
    IF EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = invite_record.team_id AND user_id = auth.uid()
    ) THEN
      UPDATE public.team_invites SET status = 'accepted', accepted_at = NOW(), accepted_by = auth.uid() WHERE id = p_invite_id;
      RETURN json_build_object('success', FALSE, 'error', 'Already a member of this team');
    END IF;

    -- Create membership
    INSERT INTO public.team_members (team_id, user_id, role, player_slot_id, invited_by, can_edit_groups)
    VALUES (
      invite_record.team_id,
      auth.uid(),
      invite_record.role,
      invite_record.player_slot_id,
      invite_record.created_by,
      COALESCE(invite_record.can_edit_groups, FALSE)
    )
    RETURNING id INTO new_member_id;

    -- Update invite status
    UPDATE public.team_invites
    SET status = 'accepted', accepted_at = NOW(), accepted_by = auth.uid()
    WHERE id = p_invite_id;

    -- Notify team owner
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      team_record.user_id,
      'team_member_joined',
      'New team member',
      user_profile.display_name || ' accepted your invite to ' || team_record.name,
      json_build_object(
        'teamId', invite_record.team_id,
        'memberId', new_member_id,
        'memberName', user_profile.display_name,
        'role', invite_record.role
      )
    );

    RETURN json_build_object(
      'success', TRUE,
      'status', 'accepted',
      'membershipId', new_member_id,
      'teamId', invite_record.team_id,
      'teamName', team_record.name,
      'role', invite_record.role
    );
  ELSE
    -- Decline the invite
    UPDATE public.team_invites SET status = 'declined' WHERE id = p_invite_id;

    RETURN json_build_object('success', TRUE, 'status', 'declined');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. UPDATE accept_team_invite() (token-based) — exclude paid teams from limit check
-- ============================================

CREATE OR REPLACE FUNCTION public.accept_team_invite(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  invite_record RECORD;
  new_member_id UUID;
  user_profile RECORD;
  team_record RECORD;
  owned_count INTEGER;
  membership_count INTEGER;
  total_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to accept invite';
  END IF;

  -- Get user profile
  SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();

  -- Find and validate invite
  SELECT * INTO invite_record
  FROM public.team_invites
  WHERE token = invite_token
  AND accepted_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW());

  IF invite_record IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Invalid or expired invite');
  END IF;

  -- Get team info
  SELECT * INTO team_record
  FROM public.my_teams
  WHERE id = invite_record.team_id;

  IF team_record IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Team no longer exists');
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = invite_record.team_id
    AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Already a member of this team');
  END IF;

  -- If the team has a team plan, skip limit check
  IF team_record.has_team_plan = FALSE THEN
    -- Count total teams (owned + non-paid memberships) against max_teams limit
    SELECT COUNT(*) INTO owned_count
    FROM public.my_teams
    WHERE user_id = auth.uid();

    SELECT COUNT(*) INTO membership_count
    FROM public.team_members tm
    JOIN public.my_teams mt ON mt.id = tm.team_id
    WHERE tm.user_id = auth.uid()
      AND mt.has_team_plan = FALSE;

    total_count := owned_count + membership_count;

    IF total_count >= COALESCE(user_profile.max_teams, 1) THEN
      RETURN json_build_object(
        'success', FALSE,
        'conflict', 'free_tier_team_limit',
        'existingTeamId', (SELECT id FROM public.my_teams WHERE user_id = auth.uid() LIMIT 1),
        'existingTeamName', (SELECT name FROM public.my_teams WHERE user_id = auth.uid() LIMIT 1),
        'inviteTeamId', team_record.id,
        'inviteTeamName', team_record.name,
        'inviteRole', invite_record.role
      );
    END IF;
  END IF;

  -- Create membership
  INSERT INTO public.team_members (team_id, user_id, role, player_slot_id, invited_by, can_edit_groups)
  VALUES (
    invite_record.team_id,
    auth.uid(),
    invite_record.role,
    invite_record.player_slot_id,
    invite_record.created_by,
    COALESCE(invite_record.can_edit_groups, FALSE)
  )
  RETURNING id INTO new_member_id;

  -- Mark invite as accepted
  UPDATE public.team_invites
  SET accepted_at = NOW(), accepted_by = auth.uid()
  WHERE id = invite_record.id;

  -- Notify team owner
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    team_record.user_id,
    'team_member_joined',
    'New team member',
    COALESCE(user_profile.display_name, 'Someone') || ' joined ' || team_record.name,
    json_build_object(
      'teamId', invite_record.team_id,
      'memberId', new_member_id,
      'memberName', COALESCE(user_profile.display_name, 'Unknown'),
      'role', invite_record.role
    )
  );

  RETURN json_build_object(
    'success', TRUE,
    'teamId', invite_record.team_id,
    'teamName', team_record.name,
    'role', invite_record.role,
    'membershipId', new_member_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. RLS POLICIES FOR TEAM ENEMY TEAMS
-- ============================================

-- Team members can view enemy teams that belong to their team
CREATE POLICY "Team members can view team enemy teams"
  ON public.enemy_teams
  FOR SELECT
  USING (
    team_id IS NOT NULL
    AND (
      -- Team owner
      EXISTS (
        SELECT 1 FROM public.my_teams
        WHERE id = enemy_teams.team_id AND user_id = auth.uid()
      )
      OR
      -- Team member
      EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_id = enemy_teams.team_id AND user_id = auth.uid()
      )
    )
  );

-- Team content creators can insert team enemy teams (based on team_content_permission)
CREATE POLICY "Team content creators can insert team enemy teams"
  ON public.enemy_teams
  FOR INSERT
  WITH CHECK (
    team_id IS NULL  -- personal enemy teams use existing policies
    OR (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.my_teams mt
        WHERE mt.id = enemy_teams.team_id
          AND mt.has_team_plan = TRUE
          AND (
            -- Owner always can
            mt.user_id = auth.uid()
            OR (
              -- Check permission level
              mt.team_content_permission = 'all'
              AND EXISTS (SELECT 1 FROM public.team_members WHERE team_id = mt.id AND user_id = auth.uid())
            )
            OR (
              mt.team_content_permission = 'players'
              AND EXISTS (
                SELECT 1 FROM public.team_members
                WHERE team_id = mt.id AND user_id = auth.uid() AND role IN ('admin', 'player')
              )
            )
            OR (
              mt.team_content_permission = 'admins'
              AND EXISTS (
                SELECT 1 FROM public.team_members
                WHERE team_id = mt.id AND user_id = auth.uid() AND role = 'admin'
              )
            )
          )
      )
    )
  );

-- Same permission check for updates
CREATE POLICY "Team content creators can update team enemy teams"
  ON public.enemy_teams
  FOR UPDATE
  USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.my_teams mt
      WHERE mt.id = enemy_teams.team_id
        AND mt.has_team_plan = TRUE
        AND (
          mt.user_id = auth.uid()
          OR (
            mt.team_content_permission = 'all'
            AND EXISTS (SELECT 1 FROM public.team_members WHERE team_id = mt.id AND user_id = auth.uid())
          )
          OR (
            mt.team_content_permission = 'players'
            AND EXISTS (
              SELECT 1 FROM public.team_members
              WHERE team_id = mt.id AND user_id = auth.uid() AND role IN ('admin', 'player')
            )
          )
          OR (
            mt.team_content_permission = 'admins'
            AND EXISTS (
              SELECT 1 FROM public.team_members
              WHERE team_id = mt.id AND user_id = auth.uid() AND role = 'admin'
            )
          )
        )
    )
  );

-- Same for delete
CREATE POLICY "Team content creators can delete team enemy teams"
  ON public.enemy_teams
  FOR DELETE
  USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.my_teams mt
      WHERE mt.id = enemy_teams.team_id
        AND mt.has_team_plan = TRUE
        AND (
          mt.user_id = auth.uid()
          OR (
            mt.team_content_permission = 'all'
            AND EXISTS (SELECT 1 FROM public.team_members WHERE team_id = mt.id AND user_id = auth.uid())
          )
          OR (
            mt.team_content_permission = 'players'
            AND EXISTS (
              SELECT 1 FROM public.team_members
              WHERE team_id = mt.id AND user_id = auth.uid() AND role IN ('admin', 'player')
            )
          )
          OR (
            mt.team_content_permission = 'admins'
            AND EXISTS (
              SELECT 1 FROM public.team_members
              WHERE team_id = mt.id AND user_id = auth.uid() AND role = 'admin'
            )
          )
        )
    )
  );

-- ============================================
-- 12. RLS: Team members can view team draft sessions
--     (Update existing policy to also check content permission for INSERT)
-- ============================================

-- Allow team members to create drafts for teams with active plans (permission-gated)
CREATE POLICY "Team content creators can insert team drafts"
  ON public.draft_sessions
  FOR INSERT
  WITH CHECK (
    my_team_id IS NULL  -- personal drafts use existing policies
    OR (
      my_team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.my_teams mt
        WHERE mt.id = draft_sessions.my_team_id
          AND mt.has_team_plan = TRUE
          AND (
            mt.user_id = auth.uid()
            OR (
              mt.team_content_permission = 'all'
              AND EXISTS (SELECT 1 FROM public.team_members WHERE team_id = mt.id AND user_id = auth.uid())
            )
            OR (
              mt.team_content_permission = 'players'
              AND EXISTS (
                SELECT 1 FROM public.team_members
                WHERE team_id = mt.id AND user_id = auth.uid() AND role IN ('admin', 'player')
              )
            )
            OR (
              mt.team_content_permission = 'admins'
              AND EXISTS (
                SELECT 1 FROM public.team_members
                WHERE team_id = mt.id AND user_id = auth.uid() AND role = 'admin'
              )
            )
          )
      )
    )
  );

-- ============================================
-- 13. TRANSFER ARCHIVED CONTENT FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.transfer_team_draft_to_personal(p_draft_id TEXT)
RETURNS JSON AS $$
DECLARE
  draft_record RECORD;
  team_record RECORD;
  personal_count INTEGER;
  max_allowed INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Get the draft
  SELECT * INTO draft_record FROM public.draft_sessions WHERE id = p_draft_id;
  IF draft_record IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Draft not found');
  END IF;

  IF draft_record.my_team_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Draft is not a team draft');
  END IF;

  -- Verify user is the team owner
  SELECT * INTO team_record FROM public.my_teams WHERE id = draft_record.my_team_id;
  IF team_record IS NULL OR team_record.user_id != auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Only the team owner can transfer drafts');
  END IF;

  -- Verify team is in archived state
  IF team_record.has_team_plan = TRUE THEN
    RETURN json_build_object('success', FALSE, 'error', 'Team plan is still active. No transfer needed.');
  END IF;

  -- Check personal draft limit
  SELECT COUNT(*) INTO personal_count
  FROM public.draft_sessions
  WHERE user_id = auth.uid()
    AND (my_team_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM public.my_teams mt
           WHERE mt.id = draft_sessions.my_team_id AND mt.has_team_plan = TRUE
         ));

  SELECT max_drafts INTO max_allowed FROM public.profiles WHERE id = auth.uid();

  IF personal_count >= COALESCE(max_allowed, 20) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Personal draft limit reached. Cannot transfer.');
  END IF;

  -- Transfer: set user_id to owner, clear my_team_id
  UPDATE public.draft_sessions
  SET user_id = auth.uid(), my_team_id = NULL, updated_at = NOW()
  WHERE id = p_draft_id;

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transfer team enemy team to personal
CREATE OR REPLACE FUNCTION public.transfer_team_enemy_to_personal(p_enemy_team_id TEXT)
RETURNS JSON AS $$
DECLARE
  enemy_record RECORD;
  team_record RECORD;
  personal_count INTEGER;
  max_allowed INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  SELECT * INTO enemy_record FROM public.enemy_teams WHERE id = p_enemy_team_id;
  IF enemy_record IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Enemy team not found');
  END IF;

  IF enemy_record.team_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Not a team enemy team');
  END IF;

  -- Verify user is the team owner
  SELECT * INTO team_record FROM public.my_teams WHERE id = enemy_record.team_id;
  IF team_record IS NULL OR team_record.user_id != auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Only the team owner can transfer enemy teams');
  END IF;

  IF team_record.has_team_plan = TRUE THEN
    RETURN json_build_object('success', FALSE, 'error', 'Team plan is still active. No transfer needed.');
  END IF;

  -- Check personal enemy team limit
  SELECT COUNT(*) INTO personal_count
  FROM public.enemy_teams
  WHERE user_id = auth.uid() AND team_id IS NULL;

  SELECT max_enemy_teams INTO max_allowed FROM public.profiles WHERE id = auth.uid();

  IF personal_count >= COALESCE(max_allowed, 10) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Personal enemy team limit reached. Cannot transfer.');
  END IF;

  -- Transfer: set user_id to owner, clear team_id
  UPDATE public.enemy_teams
  SET user_id = auth.uid(), team_id = NULL, updated_at = NOW()
  WHERE id = p_enemy_team_id;

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.transfer_team_draft_to_personal(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_team_enemy_to_personal(TEXT) TO authenticated;

-- ============================================
-- 14. UPDATE get_team_memberships() to include team plan info
-- ============================================

CREATE OR REPLACE FUNCTION public.get_team_memberships()
RETURNS JSON AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'membershipId', tm.id,
      'teamId', tm.team_id,
      'teamName', mt.name,
      'role', tm.role,
      'canEditGroups', tm.can_edit_groups,
      'playerSlotId', tm.player_slot_id,
      'joinedAt', tm.joined_at,
      'ownerName', p.display_name,
      'ownerAvatar', p.avatar_url,
      'hasTeamPlan', mt.has_team_plan,
      'teamPlanStatus', mt.team_plan_status,
      'teamContentPermission', mt.team_content_permission
    ) ORDER BY mt.name)
    FROM public.team_members tm
    JOIN public.my_teams mt ON mt.id = tm.team_id
    JOIN public.profiles p ON p.id = mt.user_id
    WHERE tm.user_id = auth.uid()
    AND tm.role != 'owner'
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

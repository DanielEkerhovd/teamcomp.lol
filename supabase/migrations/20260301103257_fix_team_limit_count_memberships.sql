-- Fix team limit trigger to count both owned teams AND memberships
-- A user's total teams (owned + member of) should not exceed max_teams

CREATE OR REPLACE FUNCTION public.check_team_limit()
RETURNS TRIGGER AS $$
DECLARE
  owned_count INTEGER;
  membership_count INTEGER;
  total_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Check if this team already exists (upsert case)
  -- If it exists, this is an update, not a new team - allow it
  IF EXISTS (SELECT 1 FROM public.my_teams WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Count owned teams for this user
  SELECT COUNT(*) INTO owned_count
  FROM public.my_teams
  WHERE user_id = NEW.user_id;

  -- Count teams user is a member of (not owner)
  SELECT COUNT(*) INTO membership_count
  FROM public.team_members
  WHERE user_id = NEW.user_id;

  total_count := owned_count + membership_count;

  -- Get user's max allowed teams
  SELECT max_teams INTO max_allowed
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Only block if this would exceed the limit
  IF total_count >= COALESCE(max_allowed, 1) THEN
    RAISE EXCEPTION 'Team limit reached. Upgrade to create more teams.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix respond_to_team_invite to check total teams (owned + memberships) against max_teams for ALL tiers
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
    -- Count total teams (owned + memberships) against max_teams limit
    SELECT COUNT(*) INTO owned_count
    FROM public.my_teams
    WHERE user_id = auth.uid();

    SELECT COUNT(*) INTO membership_count
    FROM public.team_members
    WHERE user_id = auth.uid();

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

-- Fix respond_to_ownership_transfer: remove incorrect free-tier-only check
-- Ownership transfers are net-zero on the user's total team count because
-- the user is already a member of the team (membership is deleted, ownership is gained).
-- No team limit check is needed here.
CREATE OR REPLACE FUNCTION public.respond_to_ownership_transfer(
  p_request_id UUID,
  p_accept BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  req RECORD;
  team_record RECORD;
  user_profile RECORD;
  old_owner_slot TEXT;
  new_owner_slot TEXT;
  new_owner_membership RECORD;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- 2. Fetch the pending request for this user
  SELECT * INTO req
  FROM public.ownership_transfer_requests
  WHERE id = p_request_id
    AND to_user_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Transfer request not found or already responded');
  END IF;

  -- 3. Check expiration
  IF req.expires_at < NOW() THEN
    UPDATE public.ownership_transfer_requests SET status = 'declined', responded_at = NOW() WHERE id = p_request_id;
    RETURN json_build_object('success', FALSE, 'error', 'Transfer request has expired');
  END IF;

  -- 4. Fetch team and user info
  SELECT * INTO team_record FROM public.my_teams WHERE id = req.team_id;
  SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();

  IF team_record IS NULL THEN
    UPDATE public.ownership_transfer_requests SET status = 'declined', responded_at = NOW() WHERE id = p_request_id;
    RETURN json_build_object('success', FALSE, 'error', 'Team no longer exists');
  END IF;

  -- 5. Verify the sender is still the owner
  IF team_record.user_id != req.from_user_id THEN
    UPDATE public.ownership_transfer_requests SET status = 'cancelled', responded_at = NOW() WHERE id = p_request_id;
    RETURN json_build_object('success', FALSE, 'error', 'The original owner is no longer the team owner');
  END IF;

  IF p_accept THEN
    -- 6. No team limit check needed: the user is already a member of this team,
    --    so accepting ownership is net-zero (loses membership, gains ownership).

    -- 7. Verify the accepting user is still a team member
    SELECT * INTO new_owner_membership
    FROM public.team_members
    WHERE team_id = req.team_id
      AND user_id = auth.uid();

    IF NOT FOUND THEN
      UPDATE public.ownership_transfer_requests SET status = 'declined', responded_at = NOW() WHERE id = p_request_id;
      RETURN json_build_object('success', FALSE, 'error', 'You are no longer a member of this team');
    END IF;

    -- 8. Perform the transfer
    old_owner_slot := team_record.owner_player_slot_id;
    new_owner_slot := new_owner_membership.player_slot_id;

    -- Remove new owner from team_members (they become implicit owner via my_teams.user_id)
    DELETE FROM public.team_members WHERE id = new_owner_membership.id;

    -- Insert old owner into team_members as admin
    INSERT INTO public.team_members (team_id, user_id, role, player_slot_id, can_edit_groups, joined_at)
    VALUES (req.team_id, req.from_user_id, 'admin', old_owner_slot, TRUE, NOW());

    -- Update my_teams ownership
    UPDATE public.my_teams
    SET user_id = auth.uid(),
        owner_player_slot_id = new_owner_slot,
        updated_at = NOW()
    WHERE id = req.team_id;

    -- 9. Mark request as accepted
    UPDATE public.ownership_transfer_requests
    SET status = 'accepted', responded_at = NOW()
    WHERE id = p_request_id;

    -- 10. Cancel any other pending requests for this team
    UPDATE public.ownership_transfer_requests
    SET status = 'cancelled', responded_at = NOW()
    WHERE team_id = req.team_id
      AND id != p_request_id
      AND status = 'pending';

    -- 11. Notify the old owner
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      req.from_user_id,
      'ownership_transfer_accepted',
      'Transfer Accepted',
      COALESCE(user_profile.display_name, 'Someone') || ' accepted ownership of "' || team_record.name || '". You are now an admin.',
      jsonb_build_object('teamId', req.team_id, 'teamName', team_record.name)
    );

    RETURN json_build_object(
      'success', TRUE,
      'status', 'accepted',
      'teamId', req.team_id,
      'teamName', team_record.name
    );
  ELSE
    -- 12. Decline
    UPDATE public.ownership_transfer_requests
    SET status = 'declined', responded_at = NOW()
    WHERE id = p_request_id;

    -- 13. Notify the owner
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      req.from_user_id,
      'ownership_transfer_declined',
      'Transfer Declined',
      COALESCE(user_profile.display_name, 'Someone') || ' declined the ownership transfer for "' || team_record.name || '".',
      jsonb_build_object('teamId', req.team_id, 'teamName', team_record.name)
    );

    RETURN json_build_object('success', TRUE, 'status', 'declined');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

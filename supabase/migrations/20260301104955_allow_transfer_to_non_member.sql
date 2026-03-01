-- Allow ownership transfer to users who are NOT current team members.
-- Updates both request_ownership_transfer (remove member requirement)
-- and respond_to_ownership_transfer (handle non-member acceptance).

-- ============================================
-- 1. UPDATE request_ownership_transfer
--    Remove the "target must be a team member" check.
--    Replace with a check that the target user exists.
-- ============================================

CREATE OR REPLACE FUNCTION public.request_ownership_transfer(
  p_team_id TEXT,
  p_to_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  team_record RECORD;
  sender_name TEXT;
  target_name TEXT;
  request_id UUID;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- 2. Fetch the team
  SELECT * INTO team_record
  FROM public.my_teams
  WHERE id = p_team_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Team not found');
  END IF;

  -- 3. Caller must be the current owner
  IF team_record.user_id != auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Only the team owner can transfer ownership');
  END IF;

  -- 4. Cannot transfer to yourself
  IF p_to_user_id = auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'You are already the owner');
  END IF;

  -- 5. Target must be a real user
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_to_user_id) THEN
    RETURN json_build_object('success', FALSE, 'error', 'User not found');
  END IF;

  -- 6. No pending request for this team already
  IF EXISTS (
    SELECT 1 FROM public.ownership_transfer_requests
    WHERE team_id = p_team_id
      AND status = 'pending'
      AND expires_at > NOW()
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'There is already a pending transfer request for this team');
  END IF;

  -- 7. Get display names
  SELECT display_name INTO sender_name FROM public.profiles WHERE id = auth.uid();
  SELECT display_name INTO target_name FROM public.profiles WHERE id = p_to_user_id;

  -- 8. Create the request
  INSERT INTO public.ownership_transfer_requests (team_id, from_user_id, to_user_id)
  VALUES (p_team_id, auth.uid(), p_to_user_id)
  RETURNING id INTO request_id;

  -- 9. Notify the target user
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_to_user_id,
    'ownership_transfer_request',
    'Ownership Transfer Request',
    COALESCE(sender_name, 'Someone') || ' wants to transfer ownership of "' || team_record.name || '" to you.',
    jsonb_build_object(
      'requestId', request_id,
      'teamId', p_team_id,
      'teamName', team_record.name,
      'fromUserId', auth.uid(),
      'fromDisplayName', sender_name
    )
  );

  RETURN json_build_object('success', TRUE, 'requestId', request_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. UPDATE respond_to_ownership_transfer
--    Handle the case where accepting user is NOT a team member.
--    Add team limit check for non-members.
-- ============================================

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
  owned_count INTEGER;
  membership_count INTEGER;
  total_count INTEGER;
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
    -- 6. Look up whether the accepting user is a team member
    SELECT * INTO new_owner_membership
    FROM public.team_members
    WHERE team_id = req.team_id
      AND user_id = auth.uid();

    -- 7. Team limit check: only needed if accepting user is NOT a member.
    --    Members are net-zero (lose membership row, gain ownership).
    --    Non-members gain a net-new team association.
    IF NOT FOUND THEN
      SELECT COUNT(*) INTO owned_count FROM public.my_teams WHERE user_id = auth.uid();
      SELECT COUNT(*) INTO membership_count FROM public.team_members WHERE user_id = auth.uid();
      total_count := owned_count + membership_count;

      IF total_count >= COALESCE(user_profile.max_teams, 1) THEN
        RETURN json_build_object(
          'success', FALSE,
          'conflict', 'free_tier_team_limit',
          'transferTeamId', team_record.id,
          'transferTeamName', team_record.name
        );
      END IF;
    END IF;

    -- 8. Perform the transfer
    old_owner_slot := team_record.owner_player_slot_id;

    IF new_owner_membership.id IS NOT NULL THEN
      -- Accepting user is a current member: swap slots and remove membership
      new_owner_slot := new_owner_membership.player_slot_id;
      DELETE FROM public.team_members WHERE id = new_owner_membership.id;
    ELSE
      -- Accepting user is NOT a member: no slot to inherit
      new_owner_slot := NULL;
    END IF;

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

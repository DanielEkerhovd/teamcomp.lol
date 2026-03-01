-- Fix ownership transfer to allow transferring to any user, not just existing members.
-- The target user becomes the owner on accept; they don't need to be a member first.

-- 1. request_ownership_transfer: remove team-member requirement, just verify user exists
CREATE OR REPLACE FUNCTION public.request_ownership_transfer(
  p_team_id TEXT,
  p_to_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  team_record RECORD;
  target_profile RECORD;
  sender_name TEXT;
  request_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  SELECT * INTO team_record
  FROM public.my_teams
  WHERE id = p_team_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Team not found');
  END IF;

  IF team_record.user_id != auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Only the team owner can transfer ownership');
  END IF;

  IF p_to_user_id = auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'You are already the owner');
  END IF;

  -- Verify target user exists
  SELECT * INTO target_profile
  FROM public.profiles
  WHERE id = p_to_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'User not found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ownership_transfer_requests
    WHERE team_id = p_team_id
      AND status = 'pending'
      AND expires_at > NOW()
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'There is already a pending transfer request for this team');
  END IF;

  SELECT display_name INTO sender_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.ownership_transfer_requests (team_id, from_user_id, to_user_id)
  VALUES (p_team_id, auth.uid(), p_to_user_id)
  RETURNING id INTO request_id;

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

-- 2. respond_to_ownership_transfer: handle case where acceptor is not a current member
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
  has_membership BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  SELECT * INTO req
  FROM public.ownership_transfer_requests
  WHERE id = p_request_id
    AND to_user_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Transfer request not found or already responded');
  END IF;

  IF req.expires_at < NOW() THEN
    UPDATE public.ownership_transfer_requests SET status = 'declined', responded_at = NOW() WHERE id = p_request_id;
    RETURN json_build_object('success', FALSE, 'error', 'Transfer request has expired');
  END IF;

  SELECT * INTO team_record FROM public.my_teams WHERE id = req.team_id;
  SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();

  IF team_record IS NULL THEN
    UPDATE public.ownership_transfer_requests SET status = 'declined', responded_at = NOW() WHERE id = p_request_id;
    RETURN json_build_object('success', FALSE, 'error', 'Team no longer exists');
  END IF;

  IF team_record.user_id != req.from_user_id THEN
    UPDATE public.ownership_transfer_requests SET status = 'cancelled', responded_at = NOW() WHERE id = p_request_id;
    RETURN json_build_object('success', FALSE, 'error', 'The original owner is no longer the team owner');
  END IF;

  IF p_accept THEN
    -- Check if the accepting user is currently a team member (optional)
    SELECT * INTO new_owner_membership
    FROM public.team_members
    WHERE team_id = req.team_id
      AND user_id = auth.uid();

    has_membership := FOUND;

    -- Perform the transfer
    old_owner_slot := team_record.owner_player_slot_id;
    new_owner_slot := CASE WHEN has_membership THEN new_owner_membership.player_slot_id ELSE NULL END;

    -- If new owner was a member, remove their membership (ownership is implicit via my_teams.user_id)
    IF has_membership THEN
      DELETE FROM public.team_members WHERE id = new_owner_membership.id;
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

    -- Mark request as accepted
    UPDATE public.ownership_transfer_requests
    SET status = 'accepted', responded_at = NOW()
    WHERE id = p_request_id;

    -- Cancel any other pending requests for this team
    UPDATE public.ownership_transfer_requests
    SET status = 'cancelled', responded_at = NOW()
    WHERE team_id = req.team_id
      AND id != p_request_id
      AND status = 'pending';

    -- Notify the old owner
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
    -- Decline
    UPDATE public.ownership_transfer_requests
    SET status = 'declined', responded_at = NOW()
    WHERE id = p_request_id;

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

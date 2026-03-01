-- ============================================
-- Ownership Transfer Requests
-- Converts instant ownership transfer into a request+accept/decline flow.
-- ============================================

-- ============================================
-- 1. CREATE TABLE
-- ============================================

CREATE TABLE public.ownership_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES public.my_teams(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_otr_to_user_pending
  ON public.ownership_transfer_requests(to_user_id)
  WHERE status = 'pending';

CREATE INDEX idx_otr_team_pending
  ON public.ownership_transfer_requests(team_id, status)
  WHERE status = 'pending';

-- ============================================
-- 2. RLS
-- ============================================

ALTER TABLE public.ownership_transfer_requests ENABLE ROW LEVEL SECURITY;

-- Both sender and receiver can view
CREATE POLICY "Users can view own transfer requests" ON public.ownership_transfer_requests
  FOR SELECT USING (auth.uid() IN (from_user_id, to_user_id));

-- Receiver can update (accept/decline)
CREATE POLICY "Receiver can respond to transfer requests" ON public.ownership_transfer_requests
  FOR UPDATE USING (auth.uid() = to_user_id AND status = 'pending');

-- Sender can update (cancel)
CREATE POLICY "Sender can cancel transfer requests" ON public.ownership_transfer_requests
  FOR UPDATE USING (auth.uid() = from_user_id AND status = 'pending');

-- ============================================
-- 3. UPDATE NOTIFICATION TYPE CONSTRAINT
-- ============================================

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'team_invite',
  'team_member_joined',
  'team_member_left',
  'team_role_changed',
  'player_assignment',
  'friend_request',
  'friend_accepted',
  'message',
  'draft_invite',
  'ownership_transfer_request',
  'ownership_transfer_accepted',
  'ownership_transfer_declined',
  'ownership_transfer_cancelled'
));

-- ============================================
-- 4. DROP OLD INSTANT TRANSFER FUNCTION
-- ============================================

DROP FUNCTION IF EXISTS public.transfer_team_ownership(TEXT, UUID);

-- ============================================
-- 5. REQUEST OWNERSHIP TRANSFER (owner sends request)
-- ============================================

CREATE OR REPLACE FUNCTION public.request_ownership_transfer(
  p_team_id TEXT,
  p_to_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  team_record RECORD;
  target_membership RECORD;
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

  -- 5. Target must be a team member
  SELECT * INTO target_membership
  FROM public.team_members
  WHERE team_id = p_team_id
    AND user_id = p_to_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Target user is not a member of this team');
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
-- 6. RESPOND TO OWNERSHIP TRANSFER (target accepts/declines)
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
  existing_owned_team RECORD;
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
    -- 6. Free tier check: does accepting user already own a team?
    SELECT mt.* INTO existing_owned_team
    FROM public.my_teams mt
    WHERE mt.user_id = auth.uid()
    LIMIT 1;

    IF existing_owned_team IS NOT NULL AND user_profile.tier = 'free' THEN
      RETURN json_build_object(
        'success', FALSE,
        'conflict', 'free_tier_team_limit',
        'existingTeamId', existing_owned_team.id,
        'existingTeamName', existing_owned_team.name,
        'transferTeamId', team_record.id,
        'transferTeamName', team_record.name
      );
    END IF;

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

-- ============================================
-- 7. CANCEL OWNERSHIP TRANSFER (owner cancels)
-- ============================================

CREATE OR REPLACE FUNCTION public.cancel_ownership_transfer(
  p_request_id UUID
)
RETURNS JSON AS $$
DECLARE
  req RECORD;
  team_name TEXT;
  sender_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Fetch the pending request sent by this user
  SELECT * INTO req
  FROM public.ownership_transfer_requests
  WHERE id = p_request_id
    AND from_user_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Transfer request not found or already responded');
  END IF;

  SELECT name INTO team_name FROM public.my_teams WHERE id = req.team_id;
  SELECT display_name INTO sender_name FROM public.profiles WHERE id = auth.uid();

  -- Cancel the request
  UPDATE public.ownership_transfer_requests
  SET status = 'cancelled', responded_at = NOW()
  WHERE id = p_request_id;

  -- Notify the target user
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    req.to_user_id,
    'ownership_transfer_cancelled',
    'Transfer Cancelled',
    COALESCE(sender_name, 'Someone') || ' cancelled the ownership transfer request for "' || COALESCE(team_name, 'a team') || '".',
    jsonb_build_object('teamId', req.team_id, 'teamName', COALESCE(team_name, ''))
  );

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. GET PENDING OWNERSHIP TRANSFERS (for current user as receiver)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_pending_ownership_transfers()
RETURNS JSON AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'requestId', otr.id,
      'teamId', otr.team_id,
      'teamName', mt.name,
      'createdAt', otr.created_at,
      'expiresAt', otr.expires_at,
      'fromUser', json_build_object(
        'id', p.id,
        'displayName', p.display_name,
        'avatarUrl', p.avatar_url
      )
    ) ORDER BY otr.created_at DESC)
    FROM public.ownership_transfer_requests otr
    JOIN public.my_teams mt ON mt.id = otr.team_id
    JOIN public.profiles p ON p.id = otr.from_user_id
    WHERE otr.to_user_id = auth.uid()
      AND otr.status = 'pending'
      AND otr.expires_at > NOW()
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. REALTIME
-- ============================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ownership_transfer_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

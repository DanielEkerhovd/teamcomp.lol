-- ============================================
-- Transfer team ownership RPC
-- Allows the current owner to transfer ownership to an existing team member.
-- The old owner becomes an admin, the new owner is removed from team_members
-- (since ownership is implicit via my_teams.user_id).
-- ============================================

CREATE OR REPLACE FUNCTION public.transfer_team_ownership(
  p_team_id TEXT,
  p_new_owner_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  team_record RECORD;
  new_owner_membership RECORD;
  old_owner_slot TEXT;
  new_owner_slot TEXT;
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

  -- 3. Verify the caller is the current owner
  IF team_record.user_id != auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Only the team owner can transfer ownership');
  END IF;

  -- 4. Cannot transfer to yourself
  IF p_new_owner_user_id = auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'You are already the owner');
  END IF;

  -- 5. Verify the target user is a team member
  SELECT * INTO new_owner_membership
  FROM public.team_members
  WHERE team_id = p_team_id
    AND user_id = p_new_owner_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Target user is not a member of this team');
  END IF;

  -- 6. Save slot info before making changes
  old_owner_slot := team_record.owner_player_slot_id;
  new_owner_slot := new_owner_membership.player_slot_id;

  -- 7. Remove new owner from team_members (they become the implicit owner via my_teams.user_id)
  DELETE FROM public.team_members
  WHERE id = new_owner_membership.id;

  -- 8. Insert old owner into team_members as admin
  INSERT INTO public.team_members (team_id, user_id, role, player_slot_id, can_edit_groups, joined_at)
  VALUES (p_team_id, auth.uid(), 'admin', old_owner_slot, TRUE, NOW());

  -- 9. Transfer ownership: update my_teams.user_id and swap the owner_player_slot_id
  UPDATE public.my_teams
  SET user_id = p_new_owner_user_id,
      owner_player_slot_id = new_owner_slot,
      updated_at = NOW()
  WHERE id = p_team_id;

  -- 10. Send notification to the new owner
  INSERT INTO public.notifications (user_id, type, title, body, metadata)
  VALUES (
    p_new_owner_user_id,
    'team_ownership_received',
    'Ownership Transferred',
    'You are now the owner of "' || team_record.name || '".',
    json_build_object('teamId', p_team_id, 'teamName', team_record.name)::jsonb
  );

  -- 11. Send notification to the old owner (caller)
  INSERT INTO public.notifications (user_id, type, title, body, metadata)
  VALUES (
    auth.uid(),
    'team_ownership_given',
    'Ownership Transferred',
    'You transferred ownership of "' || team_record.name || '" and are now an admin.',
    json_build_object('teamId', p_team_id, 'teamName', team_record.name)::jsonb
  );

  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions for all functions in 20260225010316_social_functions.sql
-- These were missing, causing 404 errors from the PostgREST API

GRANT EXECUTE ON FUNCTION public.send_friend_request(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_friend_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_team(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_memberships() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_player_slot(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_permissions(UUID, BOOLEAN) TO authenticated;

-- Grants for ownership transfer functions (20260301095051_ownership_transfer_requests.sql)
GRANT EXECUTE ON FUNCTION public.request_ownership_transfer(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_ownership_transfer(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ownership_transfer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_ownership_transfers() TO authenticated;

-- Grant for respond_to_team_invite (20260301103257_fix_team_limit_count_memberships.sql)
GRANT EXECUTE ON FUNCTION public.respond_to_team_invite(UUID, BOOLEAN) TO authenticated;

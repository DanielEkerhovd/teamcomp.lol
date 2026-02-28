-- RPC to delete a live draft session and all related data.
-- Only the session creator can delete their session.
create or replace function delete_live_draft_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_created_by uuid;
  v_caller_id uuid;
begin
  v_caller_id := auth.uid();

  -- Look up who created this session
  select created_by into v_created_by
  from live_draft_sessions
  where id = p_session_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Session not found');
  end if;

  -- Only the creator can delete
  if v_created_by is null or v_created_by <> v_caller_id then
    return jsonb_build_object('success', false, 'message', 'Only the session creator can delete this draft');
  end if;

  -- Delete all related data (order doesn't matter if FKs cascade, but be explicit)
  delete from live_draft_unavailable_champions where session_id = p_session_id;
  delete from live_draft_messages              where session_id = p_session_id;
  delete from live_draft_actions               where game_id in (select id from live_draft_games where session_id = p_session_id);
  delete from live_draft_games                 where session_id = p_session_id;
  delete from live_draft_participants          where session_id = p_session_id;
  delete from live_draft_user_sessions         where session_id = p_session_id;
  delete from live_draft_sessions              where id = p_session_id;

  return jsonb_build_object('success', true);
end;
$$;

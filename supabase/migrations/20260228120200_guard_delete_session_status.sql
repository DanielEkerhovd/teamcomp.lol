-- Block deletion of completed sessions. Creator can still delete
-- lobby, in_progress, and cancelled sessions.

CREATE OR REPLACE FUNCTION delete_live_draft_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_created_by UUID;
  v_status TEXT;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  SELECT created_by, status INTO v_created_by, v_status
  FROM live_draft_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Session not found');
  END IF;

  IF v_created_by IS NULL OR v_created_by <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the session creator can delete this draft');
  END IF;

  -- Block deletion of completed sessions — data must be preserved
  IF v_status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Completed sessions cannot be deleted');
  END IF;

  -- Cascade delete all related data
  DELETE FROM live_draft_unavailable_champions WHERE session_id = p_session_id;
  DELETE FROM live_draft_messages              WHERE session_id = p_session_id;
  DELETE FROM live_draft_actions               WHERE game_id IN (SELECT id FROM live_draft_games WHERE session_id = p_session_id);
  DELETE FROM live_draft_games                 WHERE session_id = p_session_id;
  DELETE FROM live_draft_participants          WHERE session_id = p_session_id;
  DELETE FROM live_draft_user_sessions         WHERE session_id = p_session_id;
  DELETE FROM live_draft_sessions              WHERE id = p_session_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

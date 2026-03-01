-- ============================================
-- REVERT MESSAGE (Soft Delete)
-- ============================================

-- 1. Add reverted_at column
ALTER TABLE public.messages
  ADD COLUMN reverted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. RLS policy: senders can set reverted_at on their own messages
CREATE POLICY "Senders can revert own messages" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id)
  WITH CHECK (reverted_at IS NOT NULL);

-- 3. RPC: revert_message
CREATE OR REPLACE FUNCTION public.revert_message(p_message_id UUID)
RETURNS JSON AS $$
DECLARE
  msg RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  SELECT * INTO msg
  FROM public.messages
  WHERE id = p_message_id
    AND sender_id = auth.uid()
    AND reverted_at IS NULL;

  IF msg IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Message not found or already deleted');
  END IF;

  UPDATE public.messages
  SET reverted_at = NOW()
  WHERE id = p_message_id;

  RETURN json_build_object('success', TRUE, 'messageId', p_message_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate get_conversation with reverted_at masking
CREATE OR REPLACE FUNCTION public.get_conversation(
  p_other_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_before_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  RETURN COALESCE((
    SELECT json_agg(msg ORDER BY msg.created_at DESC)
    FROM (
      SELECT
        m.id,
        m.sender_id,
        m.recipient_id,
        CASE WHEN m.reverted_at IS NOT NULL
             THEN 'This message was deleted'
             ELSE m.content
        END AS content,
        m.read_at,
        m.created_at,
        m.reverted_at,
        p.display_name as sender_name,
        p.avatar_url as sender_avatar
      FROM public.messages m
      JOIN public.profiles p ON p.id = m.sender_id
      WHERE (
        (m.sender_id = auth.uid() AND m.recipient_id = p_other_user_id)
        OR (m.sender_id = p_other_user_id AND m.recipient_id = auth.uid())
      )
      AND (p_before_id IS NULL OR m.created_at < (SELECT created_at FROM public.messages WHERE id = p_before_id))
      ORDER BY m.created_at DESC
      LIMIT p_limit
    ) msg
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate get_conversation_previews with reverted_at masking
CREATE OR REPLACE FUNCTION public.get_conversation_previews()
RETURNS TABLE (
  friend_id UUID,
  friend_name TEXT,
  friend_avatar TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_by UUID,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH conversations AS (
    SELECT
      CASE WHEN m.sender_id = auth.uid() THEN m.recipient_id ELSE m.sender_id END as other_user_id,
      CASE WHEN m.reverted_at IS NOT NULL
           THEN 'This message was deleted'
           ELSE m.content
      END AS content,
      m.created_at,
      m.sender_id,
      m.read_at,
      m.recipient_id
    FROM public.messages m
    WHERE m.sender_id = auth.uid() OR m.recipient_id = auth.uid()
  ),
  latest_per_user AS (
    SELECT DISTINCT ON (other_user_id)
      other_user_id,
      content as last_message,
      created_at as last_message_at,
      sender_id as last_message_by
    FROM conversations
    ORDER BY other_user_id, created_at DESC
  ),
  unread_counts AS (
    SELECT
      sender_id as from_user,
      COUNT(*) as unread
    FROM public.messages
    WHERE recipient_id = auth.uid()
    AND read_at IS NULL
    GROUP BY sender_id
  )
  SELECT
    lpu.other_user_id as friend_id,
    p.display_name as friend_name,
    p.avatar_url as friend_avatar,
    lpu.last_message,
    lpu.last_message_at,
    lpu.last_message_by,
    COALESCE(uc.unread, 0) as unread_count
  FROM latest_per_user lpu
  JOIN public.profiles p ON p.id = lpu.other_user_id
  LEFT JOIN unread_counts uc ON uc.from_user = lpu.other_user_id
  ORDER BY lpu.last_message_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: Messaging System
-- Direct messaging between friends

-- ============================================
-- MESSAGES TABLE
-- ============================================

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent self-messaging
  CHECK (sender_id != recipient_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX idx_messages_conversation ON public.messages(
  LEAST(sender_id, recipient_id),
  GREATEST(sender_id, recipient_id),
  created_at DESC
);
CREATE INDEX idx_messages_unread ON public.messages(recipient_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Users can view messages they sent or received
CREATE POLICY "Users can view own messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can send messages only to accepted friends
CREATE POLICY "Users can send messages to friends" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND (
        (user_id = auth.uid() AND friend_id = recipient_id)
        OR (friend_id = auth.uid() AND user_id = recipient_id)
      )
    )
  );

-- Recipients can mark messages as read
CREATE POLICY "Recipients can mark messages read" ON public.messages
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (
    -- Can only update read_at, nothing else
    read_at IS NOT NULL
  );

-- Users can delete their own sent messages
CREATE POLICY "Senders can delete own messages" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Mark message as read
CREATE OR REPLACE FUNCTION public.mark_message_read(message_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.messages
  SET read_at = NOW()
  WHERE id = message_id
  AND recipient_id = auth.uid()
  AND read_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark all messages from a user as read
CREATE OR REPLACE FUNCTION public.mark_conversation_read(other_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.messages
  SET read_at = NOW()
  WHERE recipient_id = auth.uid()
  AND sender_id = other_user_id
  AND read_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread message count
CREATE OR REPLACE FUNCTION public.get_unread_message_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.messages
    WHERE recipient_id = auth.uid()
    AND read_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get conversation previews (most recent message per friend)
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
      CASE WHEN sender_id = auth.uid() THEN recipient_id ELSE sender_id END as other_user_id,
      content,
      created_at,
      sender_id,
      read_at,
      recipient_id
    FROM public.messages
    WHERE sender_id = auth.uid() OR recipient_id = auth.uid()
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

-- ============================================
-- REALTIME SETUP
-- ============================================

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

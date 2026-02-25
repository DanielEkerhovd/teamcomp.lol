-- Migration: Friendships System
-- Allows users to add friends by username or email

-- ============================================
-- FRIENDSHIPS TABLE
-- ============================================

CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(user_id, friend_id),
  -- Prevent self-friending
  CHECK (user_id != friend_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_friendships_user ON public.friendships(user_id);
CREATE INDEX idx_friendships_friend ON public.friendships(friend_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);
CREATE INDEX idx_friendships_pending ON public.friendships(friend_id, status) WHERE status = 'pending';

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Users can view friendships they're part of (as sender or receiver)
CREATE POLICY "Users can view own friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can create friend requests (as sender)
CREATE POLICY "Users can send friend requests" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Users can update friendships they received (accept/block)
CREATE POLICY "Users can respond to friend requests" ON public.friendships
  FOR UPDATE USING (auth.uid() = friend_id);

-- Users can delete friendships they're part of
CREATE POLICY "Users can remove friendships" ON public.friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ============================================
-- REALTIME SETUP
-- ============================================

-- Enable realtime for friendships table
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;

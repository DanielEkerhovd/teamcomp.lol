-- Migration: Add 30-day default expiration for draft shares
-- This helps keep the database clean and ensures share links don't live forever

-- Set default expiration to 30 days from creation for new shares
ALTER TABLE public.draft_shares
ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 days');

-- Optional: Create a function to clean up expired shares (can be called by a cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_draft_shares()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.draft_shares
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (for manual cleanup if needed)
GRANT EXECUTE ON FUNCTION public.cleanup_expired_draft_shares() TO authenticated;

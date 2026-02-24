-- Migration: Schedule daily cleanup of expired draft shares
-- Runs at 3:00 AM UTC every day

-- Enable pg_cron extension (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup job
SELECT cron.schedule(
  'cleanup-expired-draft-shares',  -- job name
  '0 3 * * *',                     -- cron schedule: 3:00 AM UTC daily
  $$SELECT public.cleanup_expired_draft_shares()$$
);

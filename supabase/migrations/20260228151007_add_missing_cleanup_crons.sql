-- ============================================
-- 1. rank_cache cleanup (entries older than 48h)
-- ============================================

-- Add DELETE policy so cron (service role) can delete rows
CREATE POLICY "Allow service delete rank" ON rank_cache
  FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.cleanup_stale_rank_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rank_cache
  WHERE fetched_at < NOW() - INTERVAL '48 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'cleanup-stale-rank-cache',
  '0 4 * * *',  -- daily at 04:00 UTC
  $$SELECT public.cleanup_stale_rank_cache()$$
);

-- ============================================
-- 2. mastery_cache cleanup (entries older than 48h)
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_stale_mastery_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.mastery_cache
  WHERE fetched_at < NOW() - INTERVAL '48 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'cleanup-stale-mastery-cache',
  '0 4 * * *',  -- daily at 04:00 UTC
  $$SELECT public.cleanup_stale_mastery_cache()$$
);

-- ============================================
-- 3. Schedule existing cleanup_old_notifications
-- ============================================

SELECT cron.schedule(
  'cleanup-old-notifications',
  '30 4 * * *',  -- daily at 04:30 UTC
  $$SELECT public.cleanup_old_notifications(30)$$
);

-- ============================================
-- 4. messages cleanup (read messages older than 90 days)
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_old_messages(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.messages
  WHERE read_at IS NOT NULL
    AND created_at < NOW() - (days_old || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'cleanup-old-messages',
  '0 5 * * *',  -- daily at 05:00 UTC
  $$SELECT public.cleanup_old_messages(90)$$
);

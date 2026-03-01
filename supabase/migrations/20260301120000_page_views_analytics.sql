-- Analytics: page_views table, indexes, RLS, and admin RPC function.

-- 1) Create page_views table
CREATE TABLE public.page_views (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  page_url    TEXT        NOT NULL,
  referrer    TEXT,
  screen_width INT,
  user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id  TEXT        NOT NULL,
  user_agent  TEXT,
  device_type TEXT        CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Indexes for common query patterns
CREATE INDEX idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX idx_page_views_page_url   ON public.page_views (page_url);
CREATE INDEX idx_page_views_session_id ON public.page_views (session_id);
CREATE INDEX idx_page_views_user_id    ON public.page_views (user_id)
  WHERE user_id IS NOT NULL;

-- 3) RLS: no direct access for regular users.
--    Inserts happen via Edge Function using service_role key (bypasses RLS).
--    Reads happen via RPC function below (SECURITY DEFINER, developer-only).
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- 4) RPC: get_analytics_summary
--    Returns aggregated analytics for the admin dashboard.
CREATE OR REPLACE FUNCTION public.get_analytics_summary(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
  v_result    JSONB;
  v_today     DATE := CURRENT_DATE;
  v_week_start DATE := CURRENT_DATE - INTERVAL '7 days';
  v_month_start DATE := CURRENT_DATE - INTERVAL '30 days';
BEGIN
  -- Only developers may call this
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'views_today', (
      SELECT COUNT(*) FROM page_views
      WHERE created_at >= v_today
    ),
    'views_week', (
      SELECT COUNT(*) FROM page_views
      WHERE created_at >= v_week_start
    ),
    'views_month', (
      SELECT COUNT(*) FROM page_views
      WHERE created_at >= v_month_start
    ),
    'unique_today', (
      SELECT COUNT(DISTINCT session_id) FROM page_views
      WHERE created_at >= v_today
    ),
    'unique_week', (
      SELECT COUNT(DISTINCT session_id) FROM page_views
      WHERE created_at >= v_week_start
    ),
    'unique_month', (
      SELECT COUNT(DISTINCT session_id) FROM page_views
      WHERE created_at >= v_month_start
    ),
    'top_pages', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT page_url, COUNT(*) AS views,
               COUNT(DISTINCT session_id) AS unique_visitors
        FROM page_views
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY page_url
        ORDER BY views DESC
        LIMIT 15
      ) t
    ),
    'daily_views', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.day), '[]'::jsonb)
      FROM (
        SELECT DATE(created_at) AS day,
               COUNT(*) AS views,
               COUNT(DISTINCT session_id) AS unique_visitors
        FROM page_views
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY DATE(created_at)
        ORDER BY day
      ) t
    ),
    'devices', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT COALESCE(device_type, 'unknown') AS device,
               COUNT(*) AS count
        FROM page_views
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY device_type
        ORDER BY count DESC
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- 5) Cleanup function to purge old data (older than 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_page_views()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM page_views
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Schedule daily cleanup at 3 AM UTC (requires pg_cron extension)
SELECT cron.schedule(
  'cleanup-old-page-views',
  '0 3 * * *',
  $$SELECT public.cleanup_old_page_views()$$
);

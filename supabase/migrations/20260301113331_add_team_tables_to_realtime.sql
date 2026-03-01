-- Add team tables to realtime publication so the TeamMembersPanel
-- auto-refreshes for all viewers when ownership or membership changes.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.my_teams;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

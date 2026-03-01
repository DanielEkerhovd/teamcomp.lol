-- Force PostgREST to reload its schema cache so it picks up
-- the updated check_team_name_available(text, text) signature.
NOTIFY pgrst, 'reload schema';

-- Add owner_player_slot_id to my_teams so the owner can assign themselves to a player slot
ALTER TABLE public.my_teams
  ADD COLUMN owner_player_slot_id TEXT;

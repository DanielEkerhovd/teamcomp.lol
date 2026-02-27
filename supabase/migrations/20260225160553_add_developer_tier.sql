-- Add 'developer' to the allowed tier values
ALTER TABLE public.profiles DROP CONSTRAINT profiles_tier_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_tier_check
  CHECK (tier IN ('free', 'paid', 'supporter', 'admin', 'developer'));

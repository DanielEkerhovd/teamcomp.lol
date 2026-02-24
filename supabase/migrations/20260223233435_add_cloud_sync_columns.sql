-- Add missing columns for cloud sync support

-- Add allow_duplicates to custom_templates
ALTER TABLE public.custom_templates
ADD COLUMN IF NOT EXISTS allow_duplicates BOOLEAN DEFAULT FALSE;

-- Add sort_order to custom_templates for array sync ordering
ALTER TABLE public.custom_templates
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add allow_duplicate_champions and sort_order to custom_pools
ALTER TABLE public.custom_pools
ADD COLUMN IF NOT EXISTS allow_duplicate_champions BOOLEAN DEFAULT FALSE;

ALTER TABLE public.custom_pools
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add allow_duplicate_champions to player_pools
ALTER TABLE public.player_pools
ADD COLUMN IF NOT EXISTS allow_duplicate_champions BOOLEAN DEFAULT FALSE;

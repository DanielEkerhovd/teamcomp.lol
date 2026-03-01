-- Champion facing direction data (used to flip splash art in live drafts)
CREATE TABLE public.champion_facing (
  champion_id TEXT PRIMARY KEY,
  facing TEXT NOT NULL DEFAULT 'right' CHECK (facing IN ('left', 'right')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.champion_facing IS 'Stores the facing direction of each champion splash art for flip logic in live draft';

-- RLS: everyone can read (including anon spectators), writes go through RPC only
ALTER TABLE public.champion_facing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "champion_facing_select_authenticated"
  ON public.champion_facing FOR SELECT TO authenticated USING (true);

CREATE POLICY "champion_facing_select_anon"
  ON public.champion_facing FOR SELECT TO anon USING (true);

-- RPC function: developer-only upsert
CREATE OR REPLACE FUNCTION public.upsert_champion_facing(
  p_champion_id TEXT,
  p_facing TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_tier TEXT;
BEGIN
  SELECT p.tier INTO caller_tier FROM profiles p WHERE p.id = auth.uid();
  IF caller_tier IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  IF p_facing NOT IN ('left', 'right') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid facing value');
  END IF;

  INSERT INTO champion_facing (champion_id, facing, updated_at)
  VALUES (p_champion_id, p_facing, NOW())
  ON CONFLICT (champion_id) DO UPDATE
  SET facing = EXCLUDED.facing, updated_at = NOW();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_champion_facing(TEXT, TEXT) TO authenticated;

-- Seed all champions with default 'right' facing
INSERT INTO public.champion_facing (champion_id, facing) VALUES
  ('Aatrox', 'right'),
  ('Ahri', 'right'),
  ('Akali', 'right'),
  ('Akshan', 'right'),
  ('Alistar', 'right'),
  ('Ambessa', 'right'),
  ('Amumu', 'right'),
  ('Anivia', 'right'),
  ('Annie', 'right'),
  ('Aphelios', 'right'),
  ('Ashe', 'right'),
  ('AurelionSol', 'right'),
  ('Aurora', 'right'),
  ('Azir', 'right'),
  ('Bard', 'right'),
  ('Belveth', 'right'),
  ('Blitzcrank', 'right'),
  ('Brand', 'right'),
  ('Braum', 'right'),
  ('Briar', 'right'),
  ('Caitlyn', 'right'),
  ('Camille', 'right'),
  ('Cassiopeia', 'right'),
  ('Chogath', 'right'),
  ('Corki', 'right'),
  ('Darius', 'right'),
  ('Diana', 'right'),
  ('Draven', 'right'),
  ('DrMundo', 'right'),
  ('Ekko', 'right'),
  ('Elise', 'right'),
  ('Evelynn', 'right'),
  ('Ezreal', 'right'),
  ('Fiddlesticks', 'right'),
  ('Fiora', 'right'),
  ('Fizz', 'right'),
  ('Galio', 'right'),
  ('Gangplank', 'right'),
  ('Garen', 'right'),
  ('Gnar', 'right'),
  ('Gragas', 'right'),
  ('Graves', 'right'),
  ('Gwen', 'right'),
  ('Hecarim', 'right'),
  ('Heimerdinger', 'right'),
  ('Hwei', 'right'),
  ('Illaoi', 'right'),
  ('Irelia', 'right'),
  ('Ivern', 'right'),
  ('Janna', 'right'),
  ('JarvanIV', 'right'),
  ('Jax', 'right'),
  ('Jayce', 'right'),
  ('Jhin', 'right'),
  ('Jinx', 'right'),
  ('Kaisa', 'right'),
  ('Kalista', 'right'),
  ('Karma', 'right'),
  ('Karthus', 'right'),
  ('Kassadin', 'right'),
  ('Katarina', 'right'),
  ('Kayle', 'right'),
  ('Kayn', 'right'),
  ('Kennen', 'right'),
  ('Khazix', 'right'),
  ('Kindred', 'right'),
  ('Kled', 'right'),
  ('KogMaw', 'right'),
  ('KSante', 'right'),
  ('Leblanc', 'right'),
  ('LeeSin', 'right'),
  ('Leona', 'right'),
  ('Lillia', 'right'),
  ('Lissandra', 'right'),
  ('Lucian', 'right'),
  ('Lulu', 'right'),
  ('Lux', 'right'),
  ('Malphite', 'right'),
  ('Malzahar', 'right'),
  ('Maokai', 'right'),
  ('MasterYi', 'right'),
  ('Mel', 'right'),
  ('Milio', 'right'),
  ('MissFortune', 'right'),
  ('MonkeyKing', 'right'),
  ('Mordekaiser', 'right'),
  ('Morgana', 'right'),
  ('Naafiri', 'right'),
  ('Nami', 'right'),
  ('Nasus', 'right'),
  ('Nautilus', 'right'),
  ('Neeko', 'right'),
  ('Nidalee', 'right'),
  ('Nilah', 'right'),
  ('Nocturne', 'right'),
  ('Nunu', 'right'),
  ('Olaf', 'right'),
  ('Orianna', 'right'),
  ('Ornn', 'right'),
  ('Pantheon', 'right'),
  ('Poppy', 'right'),
  ('Pyke', 'right'),
  ('Qiyana', 'right'),
  ('Quinn', 'right'),
  ('Rakan', 'right'),
  ('Rammus', 'right'),
  ('RekSai', 'right'),
  ('Rell', 'right'),
  ('Renata', 'right'),
  ('Renekton', 'right'),
  ('Rengar', 'right'),
  ('Riven', 'right'),
  ('Rumble', 'right'),
  ('Ryze', 'right'),
  ('Samira', 'right'),
  ('Sejuani', 'right'),
  ('Senna', 'right'),
  ('Seraphine', 'right'),
  ('Sett', 'right'),
  ('Shaco', 'right'),
  ('Shen', 'right'),
  ('Shyvana', 'right'),
  ('Singed', 'right'),
  ('Sion', 'right'),
  ('Sivir', 'right'),
  ('Skarner', 'right'),
  ('Smolder', 'right'),
  ('Sona', 'right'),
  ('Soraka', 'right'),
  ('Swain', 'right'),
  ('Sylas', 'right'),
  ('Syndra', 'right'),
  ('TahmKench', 'right'),
  ('Taliyah', 'right'),
  ('Talon', 'right'),
  ('Taric', 'right'),
  ('Teemo', 'right'),
  ('Thresh', 'right'),
  ('Tristana', 'right'),
  ('Trundle', 'right'),
  ('Tryndamere', 'right'),
  ('TwistedFate', 'right'),
  ('Twitch', 'right'),
  ('Udyr', 'right'),
  ('Urgot', 'right'),
  ('Varus', 'right'),
  ('Vayne', 'right'),
  ('Veigar', 'right'),
  ('Velkoz', 'right'),
  ('Vex', 'right'),
  ('Vi', 'right'),
  ('Viego', 'right'),
  ('Viktor', 'right'),
  ('Vladimir', 'right'),
  ('Volibear', 'right'),
  ('Warwick', 'right'),
  ('Xayah', 'right'),
  ('Xerath', 'right'),
  ('XinZhao', 'right'),
  ('Yasuo', 'right'),
  ('Yone', 'right'),
  ('Yorick', 'right'),
  ('Yunara', 'right'),
  ('Yuumi', 'right'),
  ('Zaahen', 'right'),
  ('Zac', 'right'),
  ('Zed', 'right'),
  ('Zeri', 'right'),
  ('Ziggs', 'right'),
  ('Zilean', 'right'),
  ('Zoe', 'right'),
  ('Zyra', 'right')
ON CONFLICT (champion_id) DO NOTHING;

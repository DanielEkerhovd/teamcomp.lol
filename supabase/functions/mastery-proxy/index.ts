import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache duration: 1 week for mastery (doesn't change often)
const CACHE_DURATION_HOURS = 168; // 7 days

// Platform routing for League-specific endpoints
const PLATFORM_ROUTING: Record<string, string> = {
  euw: 'euw1',
  eune: 'eun1',
  na: 'na1',
  kr: 'kr',
  br: 'br1',
  lan: 'la1',
  las: 'la2',
  oce: 'oc1',
  tr: 'tr1',
  ru: 'ru',
  jp: 'jp1',
  ph: 'ph2',
  sg: 'sg2',
  th: 'th2',
  tw: 'tw2',
  vn: 'vn2',
};

// Region routing for Account API
const ACCOUNT_ROUTING: Record<string, string> = {
  euw: 'europe',
  eune: 'europe',
  tr: 'europe',
  ru: 'europe',
  na: 'americas',
  br: 'americas',
  lan: 'americas',
  las: 'americas',
  kr: 'asia',
  jp: 'asia',
  oce: 'sea',
  ph: 'sea',
  sg: 'sea',
  th: 'sea',
  tw: 'sea',
  vn: 'sea',
};

interface MasteryEntry {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RIOT_API_KEY_RAW = Deno.env.get('RIOT_API_KEY');
    if (!RIOT_API_KEY_RAW) {
      return new Response(
        JSON.stringify({ error: 'Riot API key not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const RIOT_API_KEY = RIOT_API_KEY_RAW.trim().replace(/^["']|["']$/g, '');

    const url = new URL(req.url);
    const gameName = url.searchParams.get('gameName');
    const tagLine = url.searchParams.get('tagLine');
    const region = url.searchParams.get('region');
    const puuid = url.searchParams.get('puuid'); // Optional: skip account lookup if provided

    if (!gameName || !tagLine || !region) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: gameName, tagLine, region' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const platformRouting = PLATFORM_ROUTING[region];
    const accountRouting = ACCOUNT_ROUTING[region];

    if (!platformRouting || !accountRouting) {
      return new Response(
        JSON.stringify({ error: 'Invalid region' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a cache-only request
    const cacheOnly = url.searchParams.get('cacheOnly') === 'true';

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize to lowercase
    const gameNameLower = gameName.toLowerCase();
    const tagLineLower = tagLine.toLowerCase();
    const regionLower = region.toLowerCase();

    // Check database cache first
    const { data: cachedData } = await supabase
      .from('mastery_cache')
      .select('*')
      .eq('game_name', gameNameLower)
      .eq('tag_line', tagLineLower)
      .eq('region', regionLower)
      .single();

    if (cachedData) {
      const fetchedAt = new Date(cachedData.fetched_at);
      const hoursSinceFetch = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceFetch < CACHE_DURATION_HOURS || cacheOnly) {
        console.log(`Mastery cache hit for ${gameName}#${tagLine} (${hoursSinceFetch.toFixed(1)} hours old)`);

        return new Response(
          JSON.stringify({
            masteries: cachedData.top_masteries,
            puuid: cachedData.puuid,
            fromCache: true,
            cachedAt: cachedData.fetched_at,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`Mastery cache stale for ${gameName}#${tagLine}, refreshing...`);
    } else if (cacheOnly) {
      return new Response(
        JSON.stringify({ masteries: [], fromCache: true, notCached: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Common headers for Riot API requests
    const riotHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Charset': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': 'https://developer.riotgames.com',
    };

    // Get PUUID if not provided
    let playerPuuid = puuid;
    if (!playerPuuid) {
      const accountUrl = `https://${accountRouting}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`;
      const accountRes = await fetch(accountUrl, { headers: riotHeaders });

      if (!accountRes.ok) {
        if (accountRes.status === 404) {
          return new Response(
            JSON.stringify({ error: 'Player not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ error: `Account API error: ${accountRes.status}` }),
          { status: accountRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const account = await accountRes.json();
      playerPuuid = account.puuid;
    }

    // Fetch top champion masteries
    const masteryUrl = `https://${platformRouting}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${playerPuuid}/top?count=5&api_key=${RIOT_API_KEY}`;
    console.log('Fetching mastery:', masteryUrl.replace(RIOT_API_KEY, 'REDACTED'));

    const masteryRes = await fetch(masteryUrl, { headers: riotHeaders });

    let masteries: MasteryEntry[] = [];
    if (masteryRes.ok) {
      const rawMasteries = await masteryRes.json();
      masteries = rawMasteries.map((m: any) => ({
        championId: m.championId,
        championLevel: m.championLevel,
        championPoints: m.championPoints,
        lastPlayTime: m.lastPlayTime,
      }));
    } else {
      console.log('Mastery fetch failed:', masteryRes.status);
      // Don't fail, just return empty masteries
    }

    // Save to database cache
    const cacheData = {
      game_name: gameNameLower,
      tag_line: tagLineLower,
      region: regionLower,
      puuid: playerPuuid,
      top_masteries: masteries,
      fetched_at: new Date().toISOString(),
    };

    // Delete existing entry first, then insert
    await supabase
      .from('mastery_cache')
      .delete()
      .eq('game_name', gameNameLower)
      .eq('tag_line', tagLineLower)
      .eq('region', regionLower);

    const { error: insertError } = await supabase
      .from('mastery_cache')
      .insert(cacheData);

    if (insertError) {
      console.log('Mastery cache insert error:', insertError);
    } else {
      console.log(`Cached mastery for ${gameName}#${tagLine}`);
    }

    return new Response(
      JSON.stringify({
        masteries,
        puuid: playerPuuid,
        fromCache: false,
        cachedAt: cacheData.fetched_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

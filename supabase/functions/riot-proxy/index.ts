import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache duration: 24 hours
const CACHE_DURATION_HOURS = 24;

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

    // Trim any whitespace and remove any quotes that might have been accidentally added
    const RIOT_API_KEY = RIOT_API_KEY_RAW.trim().replace(/^["']|["']$/g, '');

    // Debug: Check key format (only log prefix, not the full key)
    console.log('API Key prefix:', RIOT_API_KEY.substring(0, 10), 'Length:', RIOT_API_KEY.length, 'Raw length:', RIOT_API_KEY_RAW.length);

    const url = new URL(req.url);
    const gameName = url.searchParams.get('gameName');
    const tagLine = url.searchParams.get('tagLine');
    const region = url.searchParams.get('region');

    if (!gameName || !tagLine || !region) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: gameName, tagLine, region' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountRouting = ACCOUNT_ROUTING[region];
    const platformRouting = PLATFORM_ROUTING[region];

    if (!accountRouting || !platformRouting) {
      return new Response(
        JSON.stringify({ error: 'Invalid region' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a cache-only request (for auto-fetch on page load)
    const cacheOnly = url.searchParams.get('cacheOnly') === 'true';

    // Initialize Supabase client for database access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize to lowercase for consistent storage/lookup
    const gameNameLower = gameName.toLowerCase();
    const tagLineLower = tagLine.toLowerCase();
    const regionLower = region.toLowerCase();

    // Step 0: Check database cache first
    const { data: cachedData } = await supabase
      .from('rank_cache')
      .select('*')
      .eq('game_name', gameNameLower)
      .eq('tag_line', tagLineLower)
      .eq('region', regionLower)
      .single();

    if (cachedData) {
      const fetchedAt = new Date(cachedData.fetched_at);
      const hoursSinceFetch = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);

      // If cache is fresh (< 24 hours) OR this is a cache-only request, return cached data
      if (hoursSinceFetch < CACHE_DURATION_HOURS || cacheOnly) {
        console.log(`Cache hit for ${gameName}#${tagLine} (${hoursSinceFetch.toFixed(1)} hours old)`);

        const rank = cachedData.tier ? {
          tier: cachedData.tier,
          division: cachedData.division,
          lp: cachedData.lp,
          wins: cachedData.wins,
          losses: cachedData.losses,
          winRate: cachedData.win_rate,
        } : null;

        return new Response(
          JSON.stringify({
            rank,
            puuid: cachedData.puuid,
            summonerLevel: cachedData.summoner_level,
            fromCache: true,
            cachedAt: cachedData.fetched_at,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`Cache stale for ${gameName}#${tagLine} (${hoursSinceFetch.toFixed(1)} hours old), refreshing...`);
    } else if (cacheOnly) {
      // No cache and cache-only request - return empty
      return new Response(
        JSON.stringify({ rank: null, fromCache: true, notCached: true }),
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

    // Step 1: Get account by Riot ID (using api_key query param instead of header)
    const accountUrl = `https://${accountRouting}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`;
    console.log('Step 1 - Account URL:', accountUrl.replace(RIOT_API_KEY, 'REDACTED'));
    const accountRes = await fetch(accountUrl, { headers: riotHeaders });
    console.log('Step 1 - Account response status:', accountRes.status);

    if (!accountRes.ok) {
      const errorBody = await accountRes.text().catch(() => '');
      console.log('Account API error:', accountRes.status, errorBody);

      if (accountRes.status === 404) {
        return new Response(
          JSON.stringify({ error: 'Player not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (accountRes.status === 401) {
        return new Response(
          JSON.stringify({ error: 'API key unauthorized (401) - key may be invalid or malformed' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (accountRes.status === 403) {
        return new Response(
          JSON.stringify({ error: 'API key forbidden (403) - key may be expired' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Riot API error: ${accountRes.status}` }),
        { status: accountRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const account = await accountRes.json();

    // Step 2: Get summoner by PUUID (using api_key query param)
    const summonerUrl = `https://${platformRouting}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}?api_key=${RIOT_API_KEY}`;
    console.log('Step 2 - Summoner URL:', summonerUrl.replace(RIOT_API_KEY, 'REDACTED'));
    const summonerRes = await fetch(summonerUrl, { headers: riotHeaders });
    console.log('Step 2 - Summoner response status:', summonerRes.status);

    if (!summonerRes.ok) {
      const summonerError = await summonerRes.text().catch(() => '');
      console.log('Step 2 - Summoner error body:', summonerError);
      return new Response(
        JSON.stringify({ error: `Failed to get summoner: ${summonerRes.status}`, details: summonerError }),
        { status: summonerRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const summoner = await summonerRes.json();

    // Step 3: Get ranked entries using PUUID (not summoner ID)
    // Using entries/by-puuid endpoint which has broader API access
    const leagueUrl = `https://${platformRouting}.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}?api_key=${RIOT_API_KEY}`;
    console.log('Step 3 - League URL:', leagueUrl.replace(RIOT_API_KEY, 'REDACTED'));
    const leagueRes = await fetch(leagueUrl, { headers: riotHeaders });
    console.log('Step 3 - League response status:', leagueRes.status);

    let entries: any[] = [];
    if (!leagueRes.ok) {
      const leagueError = await leagueRes.text().catch(() => '');
      console.log('Step 3 - League error (continuing without rank):', leagueRes.status, leagueError);
      // Don't fail - just return null rank (unranked)
    } else {
      entries = await leagueRes.json();
    }

    // Ensure entries is an array (API might return empty object for unranked players)
    const entriesArray = Array.isArray(entries) ? entries : [];

    // Find Solo/Duo queue rank
    const soloQueue = entriesArray.find((e: any) => e.queueType === 'RANKED_SOLO_5x5');

    let rank = null;
    if (soloQueue) {
      const totalGames = soloQueue.wins + soloQueue.losses;
      rank = {
        tier: soloQueue.tier,
        division: soloQueue.rank,
        lp: soloQueue.leaguePoints,
        wins: soloQueue.wins,
        losses: soloQueue.losses,
        winRate: totalGames > 0 ? Math.round((soloQueue.wins / totalGames) * 100) : 0,
      };
    }

    // Save to database cache (delete + insert for upsert with lowercase values)
    const cacheData = {
      game_name: gameNameLower,
      tag_line: tagLineLower,
      region: regionLower,
      puuid: account.puuid,
      tier: rank?.tier || null,
      division: rank?.division || null,
      lp: rank?.lp || null,
      wins: rank?.wins || null,
      losses: rank?.losses || null,
      win_rate: rank?.winRate || null,
      summoner_level: summoner.summonerLevel,
      fetched_at: new Date().toISOString(),
    };

    // Delete existing entry first (if any), then insert new one
    await supabase
      .from('rank_cache')
      .delete()
      .eq('game_name', gameNameLower)
      .eq('tag_line', tagLineLower)
      .eq('region', regionLower);

    const { error: insertError } = await supabase
      .from('rank_cache')
      .insert(cacheData);

    if (insertError) {
      console.log('Cache insert error:', insertError);
    } else {
      console.log(`Cached rank for ${gameName}#${tagLine}`);
    }

    return new Response(
      JSON.stringify({
        rank,
        puuid: account.puuid,
        summonerLevel: summoner.summonerLevel,
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

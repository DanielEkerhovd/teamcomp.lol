import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { input } = await req.json();

    if (!input) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize to array and filter empties
    const texts: string[] = (Array.isArray(input) ? input : [input])
      .filter((t: unknown) => typeof t === 'string' && t.trim().length > 0);

    if (texts.length === 0) {
      return new Response(
        JSON.stringify({ flagged: false, categories: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call OpenAI Moderation API
    const moderationRes = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
      }),
    });

    if (!moderationRes.ok) {
      const errorBody = await moderationRes.text().catch(() => '');
      console.error('OpenAI Moderation API error:', moderationRes.status, errorBody);
      return new Response(
        JSON.stringify({ error: 'Moderation service unavailable' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const moderationData = await moderationRes.json();

    // Check if any result is flagged
    // deno-lint-ignore no-explicit-any
    const flagged = moderationData.results.some((r: any) => r.flagged);
    const flaggedCategories: string[] = [];

    if (flagged) {
      // deno-lint-ignore no-explicit-any
      for (const result of moderationData.results as any[]) {
        if (result.flagged) {
          for (const [category, isFlagged] of Object.entries(result.categories)) {
            if (isFlagged && !flaggedCategories.includes(category)) {
              flaggedCategories.push(category);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ flagged, categories: flaggedCategories }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

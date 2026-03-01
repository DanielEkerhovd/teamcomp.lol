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

    const { image_base64 } = await req.json();

    if (!image_base64 || typeof image_base64 !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: image_base64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Safety limit: a 256x256 JPEG base64 is typically 30-80KB.
    // Reject anything over 500KB to prevent abuse.
    if (image_base64.length > 500_000) {
      return new Response(
        JSON.stringify({ error: 'Image too large. Max 500KB base64.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure proper data URI format for OpenAI
    const imageUrl = image_base64.startsWith('data:')
      ? image_base64
      : `data:image/jpeg;base64,${image_base64}`;

    // Call OpenAI Moderation API with omni-moderation-latest (supports images)
    const moderationRes = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
        ],
      }),
    });

    if (!moderationRes.ok) {
      const errorBody = await moderationRes.text().catch(() => '');
      console.error('OpenAI Moderation API error:', moderationRes.status, errorBody);
      return new Response(
        JSON.stringify({ error: 'Image moderation service unavailable' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const moderationData = await moderationRes.json();

    const flagged = moderationData.results?.[0]?.flagged ?? false;
    const flaggedCategories: string[] = [];

    if (flagged && moderationData.results?.[0]?.categories) {
      for (const [category, isFlagged] of Object.entries(moderationData.results[0].categories)) {
        if (isFlagged) {
          flaggedCategories.push(category);
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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=denonext';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { mode, priceId, amount, teamId } = await req.json();

    if (mode !== 'subscription' && mode !== 'donation') {
      return new Response(
        JSON.stringify({ error: 'Invalid mode. Must be "subscription" or "donation".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

    // Look up or create Stripe customer
    const { data: profile } = await adminClient
      .from('profiles')
      .select('stripe_customer_id, email, display_name, tier')
      .eq('id', user.id)
      .single();

    let stripeCustomerId = profile?.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email,
        name: profile?.display_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      stripeCustomerId = customer.id;

      // Save customer ID to profile
      await adminClient
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id);
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://teamcomp.lol';
    const cancelUrl = `${siteUrl}/profile?checkout=cancelled#plan`;

    if (mode === 'subscription') {
      // Validate price ID
      const proPriceId = Deno.env.get('STRIPE_PRO_PRICE_ID');
      const supporterPriceId = Deno.env.get('STRIPE_SUPPORTER_PRICE_ID');
      const teamPriceId = Deno.env.get('STRIPE_TEAM_PRICE_ID');

      const isTeamSubscription = priceId === teamPriceId && !!teamId;
      const isPersonalSubscription = priceId === proPriceId || priceId === supporterPriceId;

      if (!isTeamSubscription && !isPersonalSubscription) {
        return new Response(
          JSON.stringify({ error: 'Invalid price ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (isTeamSubscription) {
        // --- TEAM SUBSCRIPTION ---

        // Verify user has a paid tier (Pro required to buy team plans)
        if (!profile?.tier || !['paid', 'supporter', 'beta', 'admin', 'developer'].includes(profile.tier)) {
          return new Response(
            JSON.stringify({ error: 'You need a Pro subscription before purchasing a Team Plan.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify user owns the team
        const { data: team } = await adminClient
          .from('my_teams')
          .select('id, user_id, name, has_team_plan, team_plan_status')
          .eq('id', teamId)
          .single();

        if (!team || team.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Team not found or you are not the owner.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check team doesn't already have an active plan
        if (team.has_team_plan && team.team_plan_status === 'active') {
          return new Response(
            JSON.stringify({ error: 'This team already has an active Team Plan.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const successUrl = `${siteUrl}/my-team?checkout=team-success&teamId=${teamId}`;

        const session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: successUrl,
          cancel_url: `${siteUrl}/my-team?checkout=cancelled`,
          metadata: {
            supabase_user_id: user.id,
            team_id: teamId,
            type: 'team',
          },
          subscription_data: {
            metadata: {
              supabase_user_id: user.id,
              team_id: teamId,
              type: 'team',
            },
          },
        });

        return new Response(
          JSON.stringify({ url: session.url }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // --- PERSONAL SUBSCRIPTION ---

      // Check for existing active personal subscription
      const { data: existingSub } = await adminClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .is('team_id', null)
        .in('status', ['active', 'trialing', 'past_due'])
        .limit(1)
        .maybeSingle();

      if (existingSub) {
        return new Response(
          JSON.stringify({ error: 'You already have an active subscription. Use "Manage Subscription" to change your plan.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const successUrl = `${siteUrl}/profile?checkout=success#plan`;

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { supabase_user_id: user.id },
        subscription_data: {
          metadata: { supabase_user_id: user.id },
        },
      });

      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Donation mode
    if (!amount || amount < 100) {
      return new Response(
        JSON.stringify({ error: 'Minimum donation is €1.00' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'Donation to TeamComp.lol' },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      success_url: `${siteUrl}/profile?donation=success#plan`,
      cancel_url: cancelUrl,
      metadata: { supabase_user_id: user.id, type: 'donation' },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Stripe checkout error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

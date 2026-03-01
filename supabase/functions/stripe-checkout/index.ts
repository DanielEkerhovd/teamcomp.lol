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
    const { mode, priceId, amount } = await req.json();

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
      .select('stripe_customer_id, email, display_name')
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
    const successUrl = `${siteUrl}/profile?checkout=success#plan`;
    const cancelUrl = `${siteUrl}/profile?checkout=cancelled#plan`;

    if (mode === 'subscription') {
      // Validate price ID
      const proPriceId = Deno.env.get('STRIPE_PRO_PRICE_ID');
      const supporterPriceId = Deno.env.get('STRIPE_SUPPORTER_PRICE_ID');

      if (priceId !== proPriceId && priceId !== supporterPriceId) {
        return new Response(
          JSON.stringify({ error: 'Invalid price ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for existing active subscription
      const { data: existingSub } = await adminClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing', 'past_due'])
        .limit(1)
        .maybeSingle();

      if (existingSub) {
        return new Response(
          JSON.stringify({ error: 'You already have an active subscription. Use "Manage Subscription" to change your plan.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

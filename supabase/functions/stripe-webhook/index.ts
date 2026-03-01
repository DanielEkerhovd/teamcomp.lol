import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=denonext';

serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

    // Verify webhook signature
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');
    if (!sig) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        sig,
        Deno.env.get('STRIPE_WEBHOOK_SECRET')!
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response('Webhook signature verification failed', { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const proPriceId = Deno.env.get('STRIPE_PRO_PRICE_ID')!;
    const supporterPriceId = Deno.env.get('STRIPE_SUPPORTER_PRICE_ID')!;
    const teamPriceId = Deno.env.get('STRIPE_TEAM_PRICE_ID') || '';

    function tierFromPriceId(priceId: string): 'paid' | 'supporter' | 'team' | null {
      if (priceId === proPriceId) return 'paid';
      if (priceId === supporterPriceId) return 'supporter';
      if (teamPriceId && priceId === teamPriceId) return 'team';
      return null;
    }

    // Find user by stripe customer ID
    async function findUserByCustomerId(customerId: string): Promise<string | null> {
      const { data } = await adminClient
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();
      return data?.id ?? null;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id
          || await findUserByCustomerId(session.customer as string);

        if (!userId) {
          console.error('No user found for checkout session:', session.id);
          break;
        }

        if (session.mode === 'subscription') {
          // Retrieve the full subscription to get price details
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          const priceId = subscription.items.data[0]?.price.id;
          const tier = tierFromPriceId(priceId);

          if (!tier) {
            console.error('Unknown price ID in subscription:', priceId);
            break;
          }

          const teamId = session.metadata?.team_id
            || subscription.metadata?.team_id
            || null;

          if (tier === 'team' && teamId) {
            // --- TEAM SUBSCRIPTION ---
            // Upsert subscription record with team_id
            await adminClient.from('subscriptions').upsert({
              user_id: userId,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: subscription.customer as string,
              status: subscription.status,
              price_id: priceId,
              tier: 'paid', // stored as 'paid' in subscriptions table since 'team' isn't a user tier
              team_id: teamId,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'stripe_subscription_id' });

            // Activate team plan
            await adminClient.from('my_teams').update({
              has_team_plan: true,
              team_plan_status: 'active',
              team_max_enemy_teams: 300,
            }).eq('id', teamId);

          } else {
            // --- PERSONAL SUBSCRIPTION ---
            await adminClient.from('subscriptions').upsert({
              user_id: userId,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: subscription.customer as string,
              status: subscription.status,
              price_id: priceId,
              tier,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'stripe_subscription_id' });

            // Update user tier (trigger handles limit columns + clears downgraded_at)
            await adminClient.from('profiles').update({
              tier,
              stripe_customer_id: subscription.customer as string,
              tier_expires_at: null,
            }).eq('id', userId);

            // Restore any archived content from a previous downgrade
            await adminClient.rpc('unarchive_user_content', { p_user_id: userId });
          }

        } else if (session.mode === 'payment') {
          // One-time donation
          await adminClient.from('donations').insert({
            user_id: userId,
            stripe_payment_intent_id: session.payment_intent as string,
            stripe_checkout_session_id: session.id,
            amount: session.amount_total ?? 0,
            currency: session.currency ?? 'eur',
            status: 'succeeded',
            donor_email: session.customer_details?.email ?? null,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id
          || await findUserByCustomerId(subscription.customer as string);

        if (!userId) {
          console.error('No user found for subscription:', subscription.id);
          break;
        }

        const priceId = subscription.items.data[0]?.price.id;
        const tier = tierFromPriceId(priceId);

        if (!tier) {
          console.error('Unknown price ID in subscription update:', priceId);
          break;
        }

        const teamId = subscription.metadata?.team_id || null;

        // Update subscription record
        await adminClient.from('subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
          status: subscription.status,
          price_id: priceId,
          tier: tier === 'team' ? 'paid' : tier,
          team_id: teamId,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' });

        if (tier === 'team' && teamId) {
          // --- TEAM SUBSCRIPTION ---
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            await adminClient.from('my_teams').update({
              has_team_plan: true,
              team_plan_status: 'active',
              team_max_enemy_teams: 300,
            }).eq('id', teamId);
          } else if (subscription.cancel_at_period_end) {
            await adminClient.from('my_teams').update({
              team_plan_status: 'canceling',
            }).eq('id', teamId);
          } else if (subscription.status === 'past_due') {
            await adminClient.from('my_teams').update({
              team_plan_status: 'past_due',
            }).eq('id', teamId);
          } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            await adminClient.from('my_teams').update({
              has_team_plan: false,
              team_plan_status: 'canceled',
              team_max_enemy_teams: 0,
            }).eq('id', teamId);
          }
        } else {
          // --- PERSONAL SUBSCRIPTION ---
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            await adminClient.from('profiles').update({
              tier,
              tier_expires_at: null,
            }).eq('id', userId);

            // Restore any archived content from a previous downgrade
            await adminClient.rpc('unarchive_user_content', { p_user_id: userId });
          } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            await adminClient.from('profiles').update({
              tier: 'free',
              tier_expires_at: null,
            }).eq('id', userId);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id
          || await findUserByCustomerId(subscription.customer as string);

        if (!userId) {
          console.error('No user found for deleted subscription:', subscription.id);
          break;
        }

        const teamId = subscription.metadata?.team_id || null;

        // Mark subscription as canceled
        await adminClient.from('subscriptions').update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', subscription.id);

        if (teamId) {
          // --- TEAM SUBSCRIPTION: enter archive mode ---
          await adminClient.from('my_teams').update({
            has_team_plan: false,
            team_plan_status: 'canceled',
            team_max_enemy_teams: 0,
          }).eq('id', teamId);
        } else {
          // --- PERSONAL SUBSCRIPTION ---
          // Revert to free tier (trigger handles limit columns)
          await adminClient.from('profiles').update({
            tier: 'free',
            tier_expires_at: null,
          }).eq('id', userId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          await adminClient.from('subscriptions').update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          }).eq('stripe_subscription_id', subscriptionId);

          // Check if this is a team subscription and update team status
          const { data: sub } = await adminClient
            .from('subscriptions')
            .select('team_id')
            .eq('stripe_subscription_id', subscriptionId)
            .single();

          if (sub?.team_id) {
            await adminClient.from('my_teams').update({
              team_plan_status: 'past_due',
            }).eq('id', sub.team_id);
          }
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

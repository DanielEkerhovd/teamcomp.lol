import { supabase } from './supabase';

export const isStripeConfigured = Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export type CheckoutMode = 'subscription' | 'donation';

interface CreateCheckoutParams {
  mode: CheckoutMode;
  priceId?: string;
  amount?: number; // in cents, for donations
}

export const STRIPE_PRICES = {
  pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID as string,
  supporter: import.meta.env.VITE_STRIPE_SUPPORTER_PRICE_ID as string,
} as const;

export async function createCheckoutSession(params: CreateCheckoutParams): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Not configured' };

  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: params,
  });

  if (error) {
    // supabase.functions.invoke wraps non-2xx into a generic error;
    // try to extract the real message from the response context
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) return { error: body.error };
    } catch { /* ignore */ }
    return { error: error.message };
  }
  if (data?.error) return { error: data.error };

  if (data?.url) {
    window.location.href = data.url;
    return { error: null };
  }

  return { error: 'No checkout URL returned' };
}

export async function createPortalSession(): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Not configured' };

  const { data, error } = await supabase.functions.invoke('stripe-portal', {
    body: {},
  });

  if (error) {
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) return { error: body.error };
    } catch { /* ignore */ }
    return { error: error.message };
  }
  if (data?.error) return { error: data.error };

  if (data?.url) {
    window.location.href = data.url;
    return { error: null };
  }

  return { error: 'No portal URL returned' };
}

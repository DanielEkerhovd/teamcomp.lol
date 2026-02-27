import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function deletes unconfirmed email accounts older than 1 hour
// It should be called via a scheduled cron job (e.g., every 10 minutes)
//
// To set up scheduling:
// 1. Use Supabase Dashboard > Edge Functions > Schedules
// 2. Or use an external cron service to call this endpoint
// 3. Or use pg_cron to call via pg_net extension

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({
      perPage: 1000, // Adjust if you have more users
    });

    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to list users: ' + listError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let deletedCount = 0;
    const errors: string[] = [];

    for (const user of usersData.users) {
      // Skip if email is confirmed
      if (user.email_confirmed_at) {
        continue;
      }

      // Skip if account is newer than 1 hour
      const createdAt = new Date(user.created_at);
      if (createdAt > oneHourAgo) {
        continue;
      }

      // Skip OAuth users (they don't need email confirmation)
      const provider = user.app_metadata?.provider;
      if (provider && provider !== 'email') {
        continue;
      }

      // Delete the unconfirmed user
      console.log(`Deleting unconfirmed user: ${user.email} (created: ${user.created_at})`);

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

      if (deleteError) {
        console.error(`Error deleting user ${user.id}:`, deleteError);
        errors.push(`${user.email}: ${deleteError.message}`);
      } else {
        deletedCount++;

        // Also clean up profile if it exists (best effort)
        try {
          await adminClient.from('profiles').delete().eq('id', user.id);
        } catch (e) {
          // Profile might not exist yet for unconfirmed users
        }
      }
    }

    console.log(`Cleanup complete: deleted ${deletedCount} unconfirmed accounts`);

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
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

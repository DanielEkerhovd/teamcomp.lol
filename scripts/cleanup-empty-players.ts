import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env file manually
const envContent = readFileSync('.env', 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('Checking for empty players...');

  // First, let's see what's in the tables (this will fail if RLS blocks it)
  const { data: allEnemy, error: allEnemyErr } = await supabase
    .from('enemy_players')
    .select('id, summoner_name, team_id')
    .or('summoner_name.eq.,summoner_name.is.null');

  console.log('Empty enemy_players found:', allEnemy?.length || 0);
  if (allEnemyErr) console.error('Error querying:', allEnemyErr);
  if (allEnemy && allEnemy.length > 0) {
    console.log('Sample:', allEnemy.slice(0, 3));
  }

  const { data: allPlayers, error: allPlayersErr } = await supabase
    .from('players')
    .select('id, summoner_name, team_id')
    .or('summoner_name.eq.,summoner_name.is.null');

  console.log('Empty players found:', allPlayers?.length || 0);
  if (allPlayersErr) console.error('Error querying:', allPlayersErr);
  if (allPlayers && allPlayers.length > 0) {
    console.log('Sample:', allPlayers.slice(0, 3));
  }
}

cleanup();

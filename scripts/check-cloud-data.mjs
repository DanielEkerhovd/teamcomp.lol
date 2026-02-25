/**
 * Quick script to check cloud data in Supabase
 * Run with: node scripts/check-cloud-data.mjs
 *
 * Set these environment variables first:
 *   SUPABASE_URL=your_supabase_url
 *   SUPABASE_SERVICE_KEY=your_service_role_key
 *   USER_ID=the_user_id_to_check
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const USER_ID = process.env.USER_ID;

if (!SUPABASE_URL || !SUPABASE_KEY || !USER_ID) {
  console.error('Missing environment variables. Set SUPABASE_URL, SUPABASE_SERVICE_KEY, and USER_ID');
  process.exit(1);
}

async function query(table, select = '*') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&user_id=eq.${USER_ID}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res.json();
}

async function main() {
  console.log('Checking cloud data for user:', USER_ID);
  console.log('='.repeat(50));

  // Check player_pools
  console.log('\n📦 PLAYER POOLS:');
  const playerPools = await query('player_pools', 'id,summoner_name,role,champion_groups');
  if (playerPools.length === 0) {
    console.log('  No player pools found');
  } else {
    for (const pool of playerPools) {
      const groups = pool.champion_groups || [];
      const totalChampions = groups.reduce((sum, g) => sum + (g.championIds?.length || 0), 0);
      console.log(`  ${pool.summoner_name} (${pool.role}): ${groups.length} groups, ${totalChampions} champions`);
      for (const group of groups) {
        console.log(`    - ${group.name}: ${group.championIds?.join(', ') || 'empty'}`);
      }
    }
  }

  // Check players table too (in case champions are there)
  console.log('\n👥 PLAYERS (from my_teams):');
  const teams = await query('my_teams', 'id,name');
  for (const team of teams) {
    console.log(`  Team: ${team.name}`);
    const playersUrl = `${SUPABASE_URL}/rest/v1/players?select=summoner_name,role,champion_groups,champion_pool&team_id=eq.${team.id}`;
    const playersRes = await fetch(playersUrl, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const players = await playersRes.json();
    for (const p of players) {
      const groups = p.champion_groups || [];
      const pool = p.champion_pool || [];
      console.log(`    ${p.summoner_name || '(empty)'} (${p.role}): groups=${groups.length}, pool=${pool.length}`);
    }
  }
}

main().catch(console.error);

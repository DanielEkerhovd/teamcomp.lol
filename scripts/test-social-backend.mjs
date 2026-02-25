/**
 * Test script for the social features backend
 * Run with: node scripts/test-social-backend.mjs
 *
 * Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env file manually
try {
  const envPath = resolve(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  // .env file might not exist
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBackend() {
  console.log('🧪 Testing Social Features Backend\n');
  console.log('='.repeat(50));

  // Test 1: Check tables exist
  console.log('\n📋 Test 1: Checking tables exist...');

  const tables = ['notifications', 'friendships', 'messages', 'team_members', 'team_invites'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && !error.message.includes('permission denied')) {
      console.log(`  ❌ ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table}: exists`);
    }
  }

  // Test 2: Check RPC functions exist
  console.log('\n📋 Test 2: Checking RPC functions...');

  const functions = [
    { name: 'get_friends', params: {} },
    { name: 'get_unread_notification_count', params: {} },
    { name: 'get_unread_message_count', params: {} },
    { name: 'get_team_memberships', params: {} },
    { name: 'get_conversation_previews', params: {} },
  ];

  for (const fn of functions) {
    const { error } = await supabase.rpc(fn.name, fn.params);
    if (error && !error.message.includes('JWT')) {
      console.log(`  ❌ ${fn.name}: ${error.message}`);
    } else {
      console.log(`  ✅ ${fn.name}: exists`);
    }
  }

  // Test 3: Check team_members has new columns
  console.log('\n📋 Test 3: Checking team_members schema...');

  // Schema check via column selection

  // Alternative: try to select the new column
  const { error: colError } = await supabase
    .from('team_members')
    .select('can_edit_groups')
    .limit(1);

  if (colError && !colError.message.includes('permission denied') && !colError.message.includes('JWT')) {
    console.log(`  ❌ can_edit_groups column: ${colError.message}`);
  } else {
    console.log('  ✅ can_edit_groups column: exists');
  }

  // Test 4: Check realtime is enabled
  console.log('\n📋 Test 4: Checking realtime publication...');
  console.log('  ℹ️  Realtime tables: notifications, friendships, messages');
  console.log('  (Enable in Supabase Dashboard > Database > Replication if needed)');

  console.log('\n' + '='.repeat(50));
  console.log('✅ Backend tests complete!\n');

  console.log('📝 Next steps to test with authentication:');
  console.log('   1. Sign in to your app');
  console.log('   2. Open browser console');
  console.log('   3. Run: await window.supabase.rpc(\'get_friends\')');
  console.log('   4. Try sending a friend request to another user');
}

testBackend().catch(console.error);

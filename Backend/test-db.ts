import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log(`Testing connection to: ${supabaseUrl}`);
  
  const tables = ['users', 'chat_sessions', 'chat_messages', 'transactions', 'minted_badges', 'ai_actions', 'analytics'];
  let allGood = true;

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`❌ Error accessing table '${table}':`, error.message);
      allGood = false;
    } else {
      console.log(`✅ Table '${table}' is accessible!`);
    }
  }

  if (allGood) {
    console.log("\n🎉 ALL TABLES ARE PROPERLY CONNECTED AND ACCESSIBLE!");
  } else {
    console.log("\n⚠️ SOME TABLES FAILED. Please ensure you ran the schema.sql in Supabase.");
  }
}

testConnection();

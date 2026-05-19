import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

// Create Supabase client
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

// Create service role client for admin operations
export const supabaseAdmin = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);

export default supabase;

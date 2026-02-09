import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

let client = null;

export function getSupabase() {
  if (!client) {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
      throw new Error('Supabase credentials not configured. Please update config.js with your project URL and anon key.');
    }
    client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

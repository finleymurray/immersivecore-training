import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { setSharedRefreshToken, getSharedRefreshToken, clearSharedRefreshToken } from './shared-auth-cookie.js';

let client = null;
let bootstrapDone = false;

export function getSupabase() {
  if (!client) {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
      throw new Error('Supabase credentials not configured. Please update config.js with your project URL and anon key.');
    }
    client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Keep shared cookie in sync with auth state
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearSharedRefreshToken();
      } else if (session?.refresh_token) {
        setSharedRefreshToken(session.refresh_token);
      }
    });
  }
  return client;
}

/**
 * Bootstrap SSO: if no local session exists but a shared cookie
 * refresh_token is available, use it to establish a session.
 * Call once before the app's first getSession() call.
 */
export async function bootstrapSSOSession() {
  if (bootstrapDone) return null;
  bootstrapDone = true;

  const sb = getSupabase();

  // Check if we already have a local session
  const { data: { session: existing } } = await sb.auth.getSession();
  if (existing) {
    setSharedRefreshToken(existing.refresh_token);
    return existing;
  }

  // No local session — try the shared cookie
  const sharedRT = getSharedRefreshToken();
  if (!sharedRT) return null;

  try {
    const timeout = new Promise(resolve =>
      setTimeout(() => resolve({ data: {}, error: { message: 'SSO timeout' } }), 4000)
    );
    const { data, error } = await Promise.race([
      sb.auth.refreshSession({ refresh_token: sharedRT }),
      timeout,
    ]);
    if (error) {
      clearSharedRefreshToken();
      return null;
    }
    return data.session;
  } catch (err) {
    console.error('SSO bootstrap failed:', err);
    clearSharedRefreshToken();
    return null;
  }
}

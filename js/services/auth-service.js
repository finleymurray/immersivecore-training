import { getSupabase } from '../supabase-client.js';
import { clearSharedRefreshToken } from '../shared-auth-cookie.js';

let cachedProfile = null;

export async function signIn(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  cachedProfile = null;
  await logAuditEvent('login');
  return data;
}

export async function signOut() {
  const sb = getSupabase();
  await logAuditEvent('logout');
  cachedProfile = null;
  clearSharedRefreshToken();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

export async function getUser() {
  const session = await getSession();
  return session?.user || null;
}

export async function getUserProfile() {
  if (cachedProfile) return cachedProfile;
  const user = await getUser();
  if (!user) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  cachedProfile = data;
  return data;
}

export function clearProfileCache() {
  cachedProfile = null;
}

export async function isManager() {
  const profile = await getUserProfile();
  return profile?.role === 'manager';
}

export async function isStaffOrManager() {
  const profile = await getUserProfile();
  return profile?.role === 'manager' || profile?.role === 'staff';
}

export function onAuthStateChange(callback) {
  const sb = getSupabase();
  const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      cachedProfile = null;
    }
    callback(event, session);
  });
  return subscription;
}

export async function logAuditEvent(action, extra = {}) {
  try {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from('audit_log').insert({
      user_id: user.id,
      user_email: user.email,
      action,
      ...extra,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

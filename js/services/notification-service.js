import { getSupabase } from '../supabase-client.js';

/**
 * Create a notification visible on the immersivecore.network landing page.
 */
export async function createNotification({ title, message, severity, actionUrl, recordId, sourceApp }) {
  const { error } = await getSupabase()
    .from('notifications')
    .insert([{
      title,
      message,
      severity: severity || 'info',
      action_url: actionUrl || null,
      record_id: recordId || null,
      source_app: sourceApp || 'training',
    }]);
  if (error) {
    console.error('Failed to create notification:', error);
  }
}

export async function fetchActiveNotifications() {
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('*')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Failed to fetch notifications: ' + error.message);
  return data || [];
}

export async function dismissNotification(notificationId) {
  const { error } = await getSupabase()
    .from('notifications')
    .update({
      dismissed_at: new Date().toISOString(),
    })
    .eq('id', notificationId);
  if (error) throw new Error('Failed to dismiss notification: ' + error.message);
}

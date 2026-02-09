import { getSupabase } from '../supabase-client.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config.js';

async function callEdgeFunction(payload) {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/gdrive-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Google Drive operation failed');
  return body;
}

export async function uploadToGoogleDrive({ employeeName, fileName, fileBase64, mimeType, subfolder, sourceApp }) {
  return callEdgeFunction({
    action: 'upload',
    employee_name: employeeName,
    file_name: fileName,
    file_base64: fileBase64,
    mime_type: mimeType || 'application/pdf',
    subfolder: subfolder || 'Training Records',
    source_app: sourceApp || 'training',
  });
}

export async function replaceFileInGoogleDrive({ oldFileId, employeeName, fileName, fileBase64, mimeType, subfolder, sourceApp }) {
  return callEdgeFunction({
    action: 'replace',
    old_file_id: oldFileId,
    employee_name: employeeName,
    file_name: fileName,
    file_base64: fileBase64,
    mime_type: mimeType || 'application/pdf',
    subfolder: subfolder || 'Training Records',
    source_app: sourceApp || 'training',
  });
}

export async function deleteFileFromGoogleDrive(fileId) {
  return callEdgeFunction({ action: 'delete_file', file_id: fileId });
}

export async function deleteFolderFromGoogleDrive(folderId) {
  return callEdgeFunction({ action: 'delete_folder', folder_id: folderId });
}

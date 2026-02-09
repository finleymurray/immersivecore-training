import { getSupabase } from '../supabase-client.js';

/**
 * Upload a source PDF for a training module.
 */
export async function uploadModulePDF(moduleId, file) {
  const ext = file.name.split('.').pop();
  const path = `${moduleId}/source.${ext}`;
  const { error } = await getSupabase().storage
    .from('training-materials')
    .upload(path, file, { upsert: true });
  if (error) throw new Error('Failed to upload module PDF: ' + error.message);
  return { path, filename: file.name };
}

/**
 * Get a signed URL for a module's source PDF.
 */
export async function getModulePDFUrl(path) {
  const { data, error } = await getSupabase().storage
    .from('training-materials')
    .createSignedUrl(path, 3600);
  if (error) throw new Error('Failed to get PDF URL: ' + error.message);
  return data.signedUrl;
}

/**
 * Upload a proof scan for an assessment.
 */
export async function uploadProofScan(assessmentId, file) {
  const ext = file.name.split('.').pop();
  const path = `${assessmentId}/proof.${ext}`;
  const { error } = await getSupabase().storage
    .from('training-scans')
    .upload(path, file, { upsert: true });
  if (error) throw new Error('Failed to upload proof scan: ' + error.message);
  return { path, filename: file.name };
}

/**
 * Get a signed URL for an assessment proof scan.
 */
export async function getProofScanUrl(path) {
  const { data, error } = await getSupabase().storage
    .from('training-scans')
    .createSignedUrl(path, 3600);
  if (error) throw new Error('Failed to get scan URL: ' + error.message);
  return data.signedUrl;
}

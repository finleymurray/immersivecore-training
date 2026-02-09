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
 * Upload a module file (quiz, answer sheet, training doc, etc.).
 */
export async function uploadModuleFile(moduleId, file) {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${moduleId}/files/${timestamp}_${safeName}`;
  const { error } = await getSupabase().storage
    .from('training-materials')
    .upload(path, file, { upsert: false });
  if (error) throw new Error('Failed to upload module file: ' + error.message);
  return { path, filename: file.name, size: file.size };
}

/**
 * Delete a module file from storage.
 */
export async function deleteModuleFile(path) {
  const { error } = await getSupabase().storage
    .from('training-materials')
    .remove([path]);
  if (error) throw new Error('Failed to delete module file: ' + error.message);
}

/**
 * Get a signed URL for a module file.
 */
export async function getModuleFileUrl(path) {
  const { data, error } = await getSupabase().storage
    .from('training-materials')
    .createSignedUrl(path, 3600);
  if (error) throw new Error('Failed to get file URL: ' + error.message);
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

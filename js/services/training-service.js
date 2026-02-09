import { getSupabase } from '../supabase-client.js';

// ---- Modules ----

export async function fetchAllModules(activeOnly = false) {
  let query = getSupabase()
    .from('training_modules')
    .select('*')
    .order('module_name', { ascending: true });
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchModule(id) {
  const { data, error } = await getSupabase()
    .from('training_modules')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createModule(record) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  const payload = { ...record, created_by: user.id };
  const { data, error } = await sb
    .from('training_modules')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateModule(id, updates) {
  updates.updated_at = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('training_modules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Sessions ----

export async function fetchAllSessions() {
  const { data, error } = await getSupabase()
    .from('training_sessions')
    .select('*, training_modules(module_name)')
    .order('session_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchSession(id) {
  const { data, error } = await getSupabase()
    .from('training_sessions')
    .select('*, training_modules(module_name, syllabus)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createSession(record) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  const payload = { ...record, created_by: user.id };
  const { data, error } = await sb
    .from('training_sessions')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSession(id, updates) {
  updates.updated_at = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('training_sessions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Assessments ----

export async function fetchAllAssessments() {
  const { data, error } = await getSupabase()
    .from('training_assessments')
    .select('*, training_modules(module_name)')
    .order('assessment_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAssessment(id) {
  const { data, error } = await getSupabase()
    .from('training_assessments')
    .select('*, training_modules(module_name, refresher_period_months)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createAssessment(record) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  const payload = { ...record, created_by: user.id };
  const { data, error } = await sb
    .from('training_assessments')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAssessment(id, updates) {
  updates.updated_at = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('training_assessments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Employees (from onboarding_records) ----

export async function fetchAllEmployees() {
  const { data, error } = await getSupabase()
    .from('onboarding_records')
    .select('id, full_name, date_of_birth, status')
    .order('full_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchEmployee(id) {
  const { data, error } = await getSupabase()
    .from('onboarding_records')
    .select('id, full_name, date_of_birth, status')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// ---- Compliance Data ----

export async function fetchComplianceData() {
  const [employees, modules, assessments, sessions] = await Promise.all([
    fetchAllEmployees(),
    fetchAllModules(true),
    fetchAllAssessments(),
    fetchAllSessions(),
  ]);
  return { employees, modules, assessments, sessions };
}

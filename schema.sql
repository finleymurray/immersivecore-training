-- ============================================================
-- ImmersiveCore Training & Compliance Portal — Database Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. training_modules
CREATE TABLE public.training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name TEXT NOT NULL,
  version_number TEXT NOT NULL DEFAULT '1.0',
  refresher_period_months INTEGER NOT NULL DEFAULT 12,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('scored_quiz', 'attendance_only')),
  max_score INTEGER,
  pass_mark INTEGER,
  syllabus JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_pdf_path TEXT,
  source_pdf_filename TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scored_quiz_requires_scores CHECK (
    assessment_type != 'scored_quiz'
    OR (max_score IS NOT NULL AND pass_mark IS NOT NULL AND pass_mark <= max_score)
  )
);

-- 2. training_sessions
CREATE TABLE public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.training_modules(id),
  trainee_id UUID NOT NULL REFERENCES public.onboarding_records(id),
  trainee_name TEXT NOT NULL,
  trainer_id UUID NOT NULL REFERENCES auth.users(id),
  trainer_name TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  topics_completed JSONB,
  all_topics_covered BOOLEAN NOT NULL DEFAULT false,
  trainer_declaration BOOLEAN NOT NULL DEFAULT false,
  trainee_signature_data TEXT,
  gdrive_file_id TEXT,
  gdrive_pdf_link TEXT,
  gdrive_folder_id TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. training_assessments
CREATE TABLE public.training_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.training_modules(id),
  trainee_id UUID NOT NULL REFERENCES public.onboarding_records(id),
  trainee_name TEXT NOT NULL,
  assessor_id UUID NOT NULL REFERENCES auth.users(id),
  assessor_name TEXT NOT NULL,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  score_achieved INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  pass_mark INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  expiry_date DATE,
  proof_scan_path TEXT,
  proof_scan_filename TEXT,
  gdrive_file_id TEXT,
  gdrive_pdf_link TEXT,
  gdrive_folder_id TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS Policies (manager-only, using existing is_manager())
-- ============================================================

ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assessments ENABLE ROW LEVEL SECURITY;

-- training_modules
CREATE POLICY "Managers can view training_modules"
  ON public.training_modules FOR SELECT
  USING (public.is_manager());

CREATE POLICY "Managers can insert training_modules"
  ON public.training_modules FOR INSERT
  WITH CHECK (public.is_manager());

CREATE POLICY "Managers can update training_modules"
  ON public.training_modules FOR UPDATE
  USING (public.is_manager());

CREATE POLICY "Managers can delete training_modules"
  ON public.training_modules FOR DELETE
  USING (public.is_manager());

-- training_sessions
CREATE POLICY "Managers can view training_sessions"
  ON public.training_sessions FOR SELECT
  USING (public.is_manager());

CREATE POLICY "Managers can insert training_sessions"
  ON public.training_sessions FOR INSERT
  WITH CHECK (public.is_manager());

CREATE POLICY "Managers can update training_sessions"
  ON public.training_sessions FOR UPDATE
  USING (public.is_manager());

CREATE POLICY "Managers can delete training_sessions"
  ON public.training_sessions FOR DELETE
  USING (public.is_manager());

-- training_assessments
CREATE POLICY "Managers can view training_assessments"
  ON public.training_assessments FOR SELECT
  USING (public.is_manager());

CREATE POLICY "Managers can insert training_assessments"
  ON public.training_assessments FOR INSERT
  WITH CHECK (public.is_manager());

CREATE POLICY "Managers can update training_assessments"
  ON public.training_assessments FOR UPDATE
  USING (public.is_manager());

CREATE POLICY "Managers can delete training_assessments"
  ON public.training_assessments FOR DELETE
  USING (public.is_manager());

-- ============================================================
-- Storage Buckets
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('training-materials', 'training-materials', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('training-scans', 'training-scans', false);

-- training-materials bucket policies
CREATE POLICY "Managers can upload training materials"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'training-materials' AND public.is_manager());

CREATE POLICY "Managers can view training materials"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'training-materials' AND public.is_manager());

CREATE POLICY "Managers can update training materials"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'training-materials' AND public.is_manager());

CREATE POLICY "Managers can delete training materials"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'training-materials' AND public.is_manager());

-- training-scans bucket policies
CREATE POLICY "Managers can upload training scans"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'training-scans' AND public.is_manager());

CREATE POLICY "Managers can view training scans"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'training-scans' AND public.is_manager());

CREATE POLICY "Managers can update training scans"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'training-scans' AND public.is_manager());

CREATE POLICY "Managers can delete training scans"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'training-scans' AND public.is_manager());

-- ============================================================
-- Audit Functions & Triggers
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_training_modules_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, new_values)
    VALUES (auth.uid(), (SELECT email FROM profiles WHERE id = auth.uid()), 'create', 'training_modules', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), (SELECT email FROM profiles WHERE id = auth.uid()), 'update', 'training_modules', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, old_values)
    VALUES (auth.uid(), (SELECT email FROM profiles WHERE id = auth.uid()), 'delete', 'training_modules', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_training_sessions_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, new_values)
    VALUES (auth.uid(), (SELECT email FROM profiles WHERE id = auth.uid()), 'create', 'training_sessions', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), (SELECT email FROM profiles WHERE id = auth.uid()), 'update', 'training_sessions', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, old_values)
    VALUES (auth.uid(), (SELECT email FROM profiles WHERE id = auth.uid()), 'delete', 'training_sessions', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_training_assessments_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, new_values)
    VALUES (auth.uid(), (SELECT email FROM profiles WHERE id = auth.uid()), 'create', 'training_assessments', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), (SELECT email FROM profiles WHERE id = auth.uid()), 'update', 'training_assessments', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, old_values)
    VALUES (auth.uid(), (SELECT email FROM profiles WHERE id = auth.uid()), 'delete', 'training_assessments', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER training_modules_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.training_modules
  FOR EACH ROW EXECUTE FUNCTION public.audit_training_modules_changes();

CREATE TRIGGER training_sessions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_training_sessions_changes();

CREATE TRIGGER training_assessments_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.training_assessments
  FOR EACH ROW EXECUTE FUNCTION public.audit_training_assessments_changes();

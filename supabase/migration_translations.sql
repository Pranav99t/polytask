-- =============================================
-- PolyTask Additional Translation Tables Migration
-- For full Lingo.dev localization support
-- =============================================

-- =============================================
-- ORGANISATION TRANSLATIONS TABLE
-- Cache translated organization names and descriptions
-- =============================================
CREATE TABLE IF NOT EXISTS public.organisation_translations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  locale text NOT NULL,
  translated_name text,
  translated_description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(organisation_id, locale)
);

ALTER TABLE public.organisation_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view organisation translations" ON public.organisation_translations FOR SELECT USING (true);
CREATE POLICY "Service can insert organisation translations" ON public.organisation_translations FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update organisation translations" ON public.organisation_translations FOR UPDATE USING (true);

-- =============================================
-- PROJECT TRANSLATIONS TABLE
-- Cache translated project names and descriptions
-- =============================================
CREATE TABLE IF NOT EXISTS public.project_translations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  locale text NOT NULL,
  translated_name text,
  translated_description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(project_id, locale)
);

ALTER TABLE public.project_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view project translations" ON public.project_translations FOR SELECT USING (true);
CREATE POLICY "Service can insert project translations" ON public.project_translations FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update project translations" ON public.project_translations FOR UPDATE USING (true);

-- =============================================
-- Add updated_at to existing translation tables
-- =============================================
ALTER TABLE public.task_translations 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.comment_translations 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

-- =============================================
-- Add translated_status to task_translations
-- =============================================
ALTER TABLE public.task_translations 
ADD COLUMN IF NOT EXISTS translated_status text;

-- =============================================
-- ENABLE REALTIME FOR NEW TRANSLATION TABLES
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.organisation_translations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_translations;

-- =============================================
-- HELPER FUNCTIONS FOR TRANSLATIONS
-- =============================================

-- Function to get translated organisation
CREATE OR REPLACE FUNCTION public.get_translated_organisation(org_id uuid, target_locale text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  leader_id uuid,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    COALESCE(t.translated_name, o.name) as name,
    o.slug,
    COALESCE(t.translated_description, o.description) as description,
    o.leader_id,
    o.created_at
  FROM public.organisations o
  LEFT JOIN public.organisation_translations t 
    ON t.organisation_id = o.id AND t.locale = target_locale
  WHERE o.id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get translated project
CREATE OR REPLACE FUNCTION public.get_translated_project(proj_id uuid, target_locale text)
RETURNS TABLE (
  id uuid,
  organisation_id uuid,
  name text,
  description text,
  created_by uuid,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.organisation_id,
    COALESCE(t.translated_name, p.name) as name,
    COALESCE(t.translated_description, p.description) as description,
    p.created_by,
    p.created_at
  FROM public.projects p
  LEFT JOIN public.project_translations t 
    ON t.project_id = p.id AND t.locale = target_locale
  WHERE p.id = proj_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get translated task
CREATE OR REPLACE FUNCTION public.get_translated_task(task_id_param uuid, target_locale text)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  title text,
  description text,
  status text,
  assigned_to uuid,
  created_by uuid,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.project_id,
    COALESCE(tr.translated_title, t.title) as title,
    COALESCE(tr.translated_description, t.description) as description,
    COALESCE(tr.translated_status, t.status) as status,
    t.assigned_to,
    t.created_by,
    t.created_at
  FROM public.tasks t
  LEFT JOIN public.task_translations tr 
    ON tr.task_id = t.id AND tr.locale = target_locale
  WHERE t.id = task_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

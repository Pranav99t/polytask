-- =============================================
-- MIGRATION SCRIPT: User-based to Organisation-based Model
-- =============================================
-- Run this SQL in your Supabase SQL Editor
-- =============================================

-- First, drop existing policies (if they exist) to avoid conflicts
DROP POLICY IF EXISTS "Users can view projects they own." ON public.projects;
DROP POLICY IF EXISTS "Users can create projects." ON public.projects;
DROP POLICY IF EXISTS "Users can update projects they own." ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects they own." ON public.projects;

DROP POLICY IF EXISTS "Users can view tasks in their projects." ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks in their projects." ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks in their projects." ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their projects." ON public.tasks;

DROP POLICY IF EXISTS "View comments" ON public.comments;
DROP POLICY IF EXISTS "Create comments" ON public.comments;
DROP POLICY IF EXISTS "Delete own comments" ON public.comments;

-- =============================================
-- 1. UPDATE USERS TABLE
-- =============================================
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS username text UNIQUE,
ADD COLUMN IF NOT EXISTS full_name text;

UPDATE public.users 
SET username = split_part(email, '@', 1)
WHERE username IS NULL;

-- =============================================
-- 2. CREATE ORGANISATIONS TABLE (without member-dependent policies)
-- =============================================
CREATE TABLE IF NOT EXISTS public.organisations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  leader_id uuid REFERENCES public.users(id) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- Simple policies that don't depend on organisation_members
DROP POLICY IF EXISTS "Leaders can update their organisations" ON public.organisations;
CREATE POLICY "Leaders can update their organisations" ON public.organisations FOR UPDATE USING (leader_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create organisations" ON public.organisations;
CREATE POLICY "Authenticated users can create organisations" ON public.organisations FOR INSERT WITH CHECK (auth.uid() = leader_id);

DROP POLICY IF EXISTS "Leaders can delete their organisations" ON public.organisations;
CREATE POLICY "Leaders can delete their organisations" ON public.organisations FOR DELETE USING (leader_id = auth.uid());

-- =============================================
-- 3. CREATE ORGANISATION MEMBERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.organisation_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('leader', 'admin', 'member')),
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(organisation_id, user_id)
);

ALTER TABLE public.organisation_members ENABLE ROW LEVEL SECURITY;

-- Policies for organisation_members
DROP POLICY IF EXISTS "Members can view organisation members" ON public.organisation_members;
CREATE POLICY "Members can view organisation members" ON public.organisation_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = organisation_members.organisation_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Leaders can add members" ON public.organisation_members;
CREATE POLICY "Leaders can add members" ON public.organisation_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = organisation_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('leader', 'admin')
  ) OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "Leaders can update members" ON public.organisation_members;
CREATE POLICY "Leaders can update members" ON public.organisation_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = organisation_members.organisation_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('leader', 'admin')
  )
);

DROP POLICY IF EXISTS "Leaders can remove members" ON public.organisation_members;
CREATE POLICY "Leaders can remove members" ON public.organisation_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = organisation_members.organisation_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('leader', 'admin')
  ) OR auth.uid() = user_id
);

-- =============================================
-- 4. NOW ADD THE SELECT POLICY FOR ORGANISATIONS (depends on organisation_members)
-- =============================================
DROP POLICY IF EXISTS "Members can view their organisations" ON public.organisations;
CREATE POLICY "Members can view their organisations" ON public.organisations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organisation_members 
    WHERE organisation_id = organisations.id AND user_id = auth.uid()
  )
);

-- =============================================
-- 5. CREATE ORGANISATION INVITES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.organisation_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  invited_by uuid REFERENCES public.users(id) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token text UNIQUE DEFAULT gen_random_uuid()::text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at timestamp with time zone DEFAULT (timezone('utc'::text, now()) + interval '7 days') NOT NULL
);

ALTER TABLE public.organisation_invites ENABLE ROW LEVEL SECURITY;

-- Policies for organisation_invites
DROP POLICY IF EXISTS "Users can view invites to their email" ON public.organisation_invites;
CREATE POLICY "Users can view invites to their email" ON public.organisation_invites FOR SELECT USING (
  email = (SELECT email FROM public.users WHERE id = auth.uid())
  OR invited_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = organisation_invites.organisation_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('leader', 'admin')
  )
);

DROP POLICY IF EXISTS "Leaders can create invites" ON public.organisation_invites;
CREATE POLICY "Leaders can create invites" ON public.organisation_invites FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = organisation_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('leader', 'admin')
  )
);

DROP POLICY IF EXISTS "Users can update their invites" ON public.organisation_invites;
CREATE POLICY "Users can update their invites" ON public.organisation_invites FOR UPDATE USING (
  email = (SELECT email FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Leaders can delete invites" ON public.organisation_invites;
CREATE POLICY "Leaders can delete invites" ON public.organisation_invites FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = organisation_invites.organisation_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('leader', 'admin')
  )
);

-- =============================================
-- 6. UPDATE PROJECTS TABLE
-- =============================================
-- Add new columns
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id);

-- If owner_id exists, copy to created_by and drop it
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'owner_id') THEN
        UPDATE public.projects SET created_by = owner_id WHERE created_by IS NULL;
        ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_owner_id_fkey;
        ALTER TABLE public.projects DROP COLUMN IF EXISTS owner_id;
    END IF;
END $$;

-- Create new policies for projects
DROP POLICY IF EXISTS "Organisation members can view projects" ON public.projects;
CREATE POLICY "Organisation members can view projects" ON public.projects FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = projects.organisation_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organisation members can create projects" ON public.projects;
CREATE POLICY "Organisation members can create projects" ON public.projects FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = organisation_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organisation members can update projects" ON public.projects;
CREATE POLICY "Organisation members can update projects" ON public.projects FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = projects.organisation_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Leaders can delete projects" ON public.projects;
CREATE POLICY "Leaders can delete projects" ON public.projects FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.organisation_members om
    WHERE om.organisation_id = projects.organisation_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('leader', 'admin')
  ) OR created_by = auth.uid()
);

-- =============================================
-- 7. UPDATE TASKS TABLE
-- =============================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id);

-- Create new policies for tasks
DROP POLICY IF EXISTS "Organisation members can view tasks" ON public.tasks;
CREATE POLICY "Organisation members can view tasks" ON public.tasks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.organisation_members om ON om.organisation_id = p.organisation_id
    WHERE p.id = tasks.project_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organisation members can create tasks" ON public.tasks;
CREATE POLICY "Organisation members can create tasks" ON public.tasks FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.organisation_members om ON om.organisation_id = p.organisation_id
    WHERE p.id = project_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organisation members can update tasks" ON public.tasks;
CREATE POLICY "Organisation members can update tasks" ON public.tasks FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.organisation_members om ON om.organisation_id = p.organisation_id
    WHERE p.id = tasks.project_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Task creators can delete tasks" ON public.tasks;
CREATE POLICY "Task creators can delete tasks" ON public.tasks FOR DELETE USING (
  created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.organisation_members om ON om.organisation_id = p.organisation_id
    WHERE p.id = tasks.project_id AND om.user_id = auth.uid() AND om.role IN ('leader', 'admin')
  )
);

-- =============================================
-- 8. UPDATE COMMENTS POLICIES
-- =============================================
DROP POLICY IF EXISTS "Organisation members can view comments" ON public.comments;
CREATE POLICY "Organisation members can view comments" ON public.comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    JOIN public.organisation_members om ON om.organisation_id = p.organisation_id
    WHERE t.id = comments.task_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organisation members can create comments" ON public.comments;
CREATE POLICY "Organisation members can create comments" ON public.comments FOR INSERT WITH CHECK (
  auth.uid() = author_id AND EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    JOIN public.organisation_members om ON om.organisation_id = p.organisation_id
    WHERE t.id = task_id AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authors can delete comments" ON public.comments;
CREATE POLICY "Authors can delete comments" ON public.comments FOR DELETE USING (author_id = auth.uid());

-- =============================================
-- 9. REALTIME PUBLICATION
-- =============================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.organisations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.organisation_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- DONE!
-- =============================================
-- After running this migration:
-- 1. Existing users will need to create/join an organisation
-- 2. Existing projects without organisation_id will not be visible
--    (You may need to manually migrate them or delete them)
-- =============================================

-- =============================================
-- ROLE-BASED PERMISSIONS FIX
-- =============================================
-- Leaders & Admins: Can create projects and tasks
-- Members: View only, can comment
-- =============================================

-- Helper function to check if user is admin/leader
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid, usr_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE organisation_id = org_id 
    AND user_id = usr_id 
    AND role IN ('leader', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = org_id AND leader_id = usr_id
  );
$$;

-- =============================================
-- PROJECTS: Only admins/leaders can create
-- =============================================
DROP POLICY IF EXISTS "Organisation members can create projects" ON public.projects;
CREATE POLICY "Admins can create projects" ON public.projects FOR INSERT WITH CHECK (
  public.is_org_admin(organisation_id, auth.uid())
);

-- Members can still view
DROP POLICY IF EXISTS "Organisation members can view projects" ON public.projects;
CREATE POLICY "Organisation members can view projects" ON public.projects FOR SELECT USING (
  public.is_org_member(organisation_id, auth.uid())
);

-- Only admins can update projects
DROP POLICY IF EXISTS "Organisation members can update projects" ON public.projects;
CREATE POLICY "Admins can update projects" ON public.projects FOR UPDATE USING (
  public.is_org_admin(organisation_id, auth.uid())
);

-- Only admins can delete projects
DROP POLICY IF EXISTS "Leaders can delete projects" ON public.projects;
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE USING (
  public.is_org_admin(organisation_id, auth.uid())
);

-- =============================================
-- TASKS: Only admins/leaders can create/edit/delete
-- =============================================

-- Helper function to check if user is admin for a task's project
CREATE OR REPLACE FUNCTION public.is_task_admin(proj_id uuid, usr_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.organisation_members om ON om.organisation_id = p.organisation_id
    WHERE p.id = proj_id 
    AND om.user_id = usr_id 
    AND om.role IN ('leader', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.organisations o ON o.id = p.organisation_id
    WHERE p.id = proj_id AND o.leader_id = usr_id
  );
$$;

-- Members can view all tasks
DROP POLICY IF EXISTS "Organisation members can view tasks" ON public.tasks;
CREATE POLICY "Organisation members can view tasks" ON public.tasks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = tasks.project_id AND public.is_org_member(p.organisation_id, auth.uid())
  )
);

-- Only admins can create tasks
DROP POLICY IF EXISTS "Organisation members can create tasks" ON public.tasks;
CREATE POLICY "Admins can create tasks" ON public.tasks FOR INSERT WITH CHECK (
  public.is_task_admin(project_id, auth.uid())
);

-- Only admins can update tasks
DROP POLICY IF EXISTS "Organisation members can update tasks" ON public.tasks;
CREATE POLICY "Admins can update tasks" ON public.tasks FOR UPDATE USING (
  public.is_task_admin(tasks.project_id, auth.uid())
);

-- Only admins can delete tasks
DROP POLICY IF EXISTS "Task creators can delete tasks" ON public.tasks;
CREATE POLICY "Admins can delete tasks" ON public.tasks FOR DELETE USING (
  public.is_task_admin(tasks.project_id, auth.uid())
);

-- =============================================
-- COMMENTS: All members can create/view comments
-- =============================================

-- Keep comments open for all members (already set up correctly)
-- Members can view comments
DROP POLICY IF EXISTS "Organisation members can view comments" ON public.comments;
CREATE POLICY "Organisation members can view comments" ON public.comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.id = comments.task_id AND public.is_org_member(p.organisation_id, auth.uid())
  )
);

-- Members can create comments
DROP POLICY IF EXISTS "Organisation members can create comments" ON public.comments;
CREATE POLICY "Members can create comments" ON public.comments FOR INSERT WITH CHECK (
  auth.uid() = author_id AND EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.id = task_id AND public.is_org_member(p.organisation_id, auth.uid())
  )
);

-- Authors can delete their own comments
DROP POLICY IF EXISTS "Authors can delete comments" ON public.comments;
CREATE POLICY "Authors can delete comments" ON public.comments FOR DELETE USING (author_id = auth.uid());

-- =============================================
-- DONE! Role-based permissions are now active.
-- =============================================

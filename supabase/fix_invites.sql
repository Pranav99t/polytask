-- =============================================
-- FIX: Organisation Invites Policies
-- =============================================
-- Use the helper functions to check permissions
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view invites to their email" ON public.organisation_invites;
DROP POLICY IF EXISTS "Leaders can create invites" ON public.organisation_invites;
DROP POLICY IF EXISTS "Users can update their invites" ON public.organisation_invites;
DROP POLICY IF EXISTS "Leaders can delete invites" ON public.organisation_invites;

-- Helper function to check if user is admin/leader of an org
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

-- SELECT: Can view if it's your invite, you sent it, or you're an admin
CREATE POLICY "View invites" ON public.organisation_invites FOR SELECT USING (
  email = (SELECT email FROM public.users WHERE id = auth.uid())
  OR invited_by = auth.uid()
  OR public.is_org_admin(organisation_id, auth.uid())
);

-- INSERT: Leaders and admins can create invites
CREATE POLICY "Create invites" ON public.organisation_invites FOR INSERT WITH CHECK (
  public.is_org_admin(organisation_id, auth.uid())
);

-- UPDATE: Users can update invites sent to their email (accept/decline)
CREATE POLICY "Update own invites" ON public.organisation_invites FOR UPDATE USING (
  email = (SELECT email FROM public.users WHERE id = auth.uid())
);

-- DELETE: Admins can cancel invites
CREATE POLICY "Delete invites" ON public.organisation_invites FOR DELETE USING (
  public.is_org_admin(organisation_id, auth.uid())
);

-- =============================================
-- DONE! Try sending an invitation again.
-- =============================================

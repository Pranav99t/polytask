-- =============================================
-- FIX: Allow invited users to see organisation info
-- =============================================

-- Update organisations SELECT policy to include invited users
DROP POLICY IF EXISTS "Members can view their organisations" ON public.organisations;
CREATE POLICY "Members can view their organisations" ON public.organisations FOR SELECT USING (
  -- Leader can always see their own organisation
  leader_id = auth.uid()
  OR
  -- Members can see organisations they belong to
  public.is_org_member(id, auth.uid())
  OR
  -- Invited users can see the organisation they're invited to
  EXISTS (
    SELECT 1 FROM public.organisation_invites oi
    WHERE oi.organisation_id = organisations.id
    AND oi.email = (SELECT email FROM public.users WHERE id = auth.uid())
    AND oi.status = 'pending'
  )
);

-- =============================================
-- DONE! Invited users can now see org info.
-- =============================================

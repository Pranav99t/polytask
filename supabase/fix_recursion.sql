-- =============================================
-- COMPLETE FIX: Use Security Definer Function
-- =============================================
-- This avoids ALL recursion by using a function that bypasses RLS
-- =============================================

-- Step 1: Drop ALL existing policies on organisation_members
DROP POLICY IF EXISTS "Members can view organisation members" ON public.organisation_members;
DROP POLICY IF EXISTS "Leaders can add members" ON public.organisation_members;
DROP POLICY IF EXISTS "Users can join organisations" ON public.organisation_members;
DROP POLICY IF EXISTS "Leaders can update members" ON public.organisation_members;
DROP POLICY IF EXISTS "Leaders can remove members" ON public.organisation_members;

-- Step 2: Create a SECURITY DEFINER function that bypasses RLS to check membership
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid, usr_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE organisation_id = org_id AND user_id = usr_id
  );
$$;

-- Step 3: Create a function to check if user is org leader
CREATE OR REPLACE FUNCTION public.is_org_leader(org_id uuid, usr_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = org_id AND leader_id = usr_id
  );
$$;

-- Step 4: Create simple, non-recursive policies using these functions

-- SELECT: Can view if member of the org
CREATE POLICY "Members can view organisation members" ON public.organisation_members 
FOR SELECT USING (
  public.is_org_member(organisation_id, auth.uid())
  OR public.is_org_leader(organisation_id, auth.uid())
  OR user_id = auth.uid()
);

-- INSERT: Can join if adding yourself, or if you're the leader
CREATE POLICY "Users can join organisations" ON public.organisation_members 
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR public.is_org_leader(organisation_id, auth.uid())
);

-- UPDATE: Only leader can update roles
CREATE POLICY "Leaders can update members" ON public.organisation_members 
FOR UPDATE USING (
  public.is_org_leader(organisation_id, auth.uid())
);

-- DELETE: Can leave yourself, or leader can remove
CREATE POLICY "Leaders can remove members" ON public.organisation_members 
FOR DELETE USING (
  user_id = auth.uid()
  OR public.is_org_leader(organisation_id, auth.uid())
);

-- =============================================
-- DONE! This should fix the infinite recursion completely.
-- =============================================

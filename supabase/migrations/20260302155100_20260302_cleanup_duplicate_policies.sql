/*
  # Cleanup Duplicate RLS Policies

  ## Overview
  Removes old duplicate policies to keep only the new comprehensive policies
  created by the MASTER organization migration.

  ## Changes
  - Removes old super_admin policies (duplicates)
  - Keeps new comprehensive policies from 20260302_master_organization_system
  
  ## Policies Removed
  - Old super admin specific policies (superseded by new policies)
  
  ## Policies Kept
  - org_select_policy, org_insert_policy, org_update_policy, org_delete_policy
  - org_members_select_policy, org_members_insert_policy, org_members_update_policy, org_members_delete_policy
*/

-- Remove old duplicate super admin policies on orgs
drop policy if exists "Super admins can view all orgs" on public.orgs;
drop policy if exists "Operators can view assigned orgs" on public.orgs;
drop policy if exists "Super admins can create orgs" on public.orgs;
drop policy if exists "Super admins can update orgs" on public.orgs;
drop policy if exists "Super admins can delete orgs" on public.orgs;

-- Remove old duplicate super admin policies on org_members
drop policy if exists "Super admins can view all members" on public.org_members;
drop policy if exists "Users can view own memberships" on public.org_members;
drop policy if exists "Super admins can create members" on public.org_members;
drop policy if exists "Super admins can update members" on public.org_members;
drop policy if exists "Super admins can delete members" on public.org_members;

-- Verify remaining policies
-- Should have exactly 4 policies per table: select, insert, update, delete
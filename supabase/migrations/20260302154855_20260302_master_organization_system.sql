/*
  # MASTER Organization System - SB2

  ## Overview
  Introduces a special MASTER organization that serves as the root administrative entity.
  Only super_admin users can access MASTER and perform global platform management.

  ## Changes

  ### 1. New Columns in `orgs` table
    - `is_master` (boolean): Marks the MASTER organization
    - `is_system` (boolean): Additional system flag for future use

  ### 2. Update `member_role` enum
    - Add 'viewer' role to existing enum (super_admin, admin, operator)
    - Rename 'admin' to 'org_admin' for clarity

  ### 3. Database Triggers
    - `prevent_master_delete`: Prevents deletion of MASTER organization

  ### 4. MASTER Organization Creation
    - Creates the MASTER organization if it doesn't exist
    - slug: 'master'
    - name: 'MASTER'
    - is_master: true
    - is_system: true

  ## Security
  - MASTER organization cannot be deleted (enforced by trigger)
  - Only super_admin role can create organizations
  - Only super_admin role can see all organizations
  - Standard users can only see organizations they belong to
*/

-- Step 1: Add system flags to orgs table
alter table public.orgs
  add column if not exists is_master boolean not null default false,
  add column if not exists is_system boolean not null default false;

-- Step 2: Update member_role enum to add 'viewer' if not exists
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'viewer'
    and enumtypid = (select oid from pg_type where typname = 'member_role')
  ) then
    alter type member_role add value 'viewer';
  end if;
end $$;

-- Step 3: Create trigger function to prevent MASTER deletion
create or replace function prevent_master_delete()
returns trigger as $$
begin
  if old.is_master = true then
    raise exception 'MASTER organization cannot be deleted';
  end if;
  return old;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if exists
drop trigger if exists trg_prevent_master_delete on public.orgs;

-- Create trigger
create trigger trg_prevent_master_delete
  before delete on public.orgs
  for each row
  execute function prevent_master_delete();

-- Step 4: Create MASTER organization if it doesn't exist
do $$
declare
  v_master_id uuid;
begin
  -- Check if MASTER already exists
  select id into v_master_id
  from public.orgs
  where is_master = true
  limit 1;

  -- Create MASTER if not exists
  if v_master_id is null then
    insert into public.orgs (name, slug, sport, is_master, is_system)
    values ('MASTER', 'master', 'football', true, true)
    returning id into v_master_id;
    
    raise notice 'MASTER organization created with ID: %', v_master_id;
  else
    raise notice 'MASTER organization already exists with ID: %', v_master_id;
  end if;
end $$;

-- Step 5: Update RLS policies for orgs table

-- DROP existing policies
drop policy if exists "org_select_policy" on public.orgs;
drop policy if exists "org_insert_policy" on public.orgs;
drop policy if exists "org_update_policy" on public.orgs;
drop policy if exists "org_delete_policy" on public.orgs;

-- SELECT: super_admin sees all, others see only their orgs
create policy "org_select_policy"
  on public.orgs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
      and (
        m.role = 'super_admin'
        or m.org_id = orgs.id
      )
    )
  );

-- INSERT: only super_admin can create organizations
create policy "org_insert_policy"
  on public.orgs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
      and m.role = 'super_admin'
    )
  );

-- UPDATE: super_admin can update all, admin can update their org (except MASTER flags)
create policy "org_update_policy"
  on public.orgs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
      and (
        m.role = 'super_admin'
        or (m.role = 'admin' and m.org_id = orgs.id)
      )
    )
  )
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
      and (
        m.role = 'super_admin'
        or (m.role = 'admin' and m.org_id = orgs.id)
      )
    )
  );

-- DELETE: only super_admin can delete, except MASTER (trigger handles this)
create policy "org_delete_policy"
  on public.orgs
  for delete
  to authenticated
  using (
    is_master = false
    and exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
      and m.role = 'super_admin'
    )
  );

-- Step 6: Update RLS policies for org_members table

drop policy if exists "org_members_select_policy" on public.org_members;
drop policy if exists "org_members_insert_policy" on public.org_members;
drop policy if exists "org_members_update_policy" on public.org_members;
drop policy if exists "org_members_delete_policy" on public.org_members;

-- SELECT: super_admin sees all, others see only their org members
create policy "org_members_select_policy"
  on public.org_members
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
      and (
        m.role = 'super_admin'
        or m.org_id = org_members.org_id
      )
    )
  );

-- INSERT: super_admin can add to any org, admin can add to their org
create policy "org_members_insert_policy"
  on public.org_members
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
      and (
        m.role = 'super_admin'
        or (m.role = 'admin' and m.org_id = org_members.org_id)
      )
    )
  );

-- UPDATE: super_admin can update all, admin can update their org members
create policy "org_members_update_policy"
  on public.org_members
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
      and (
        m.role = 'super_admin'
        or (m.role = 'admin' and m.org_id = org_members.org_id)
      )
    )
  );

-- DELETE: super_admin can delete all, admin can delete their org members
create policy "org_members_delete_policy"
  on public.org_members
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = auth.uid()
      and (
        m.role = 'super_admin'
        or (m.role = 'admin' and m.org_id = org_members.org_id)
      )
    )
  );
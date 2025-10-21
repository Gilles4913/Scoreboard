/*
  # Initialize Scoreboard Pro Database

  ## Overview
  This migration initializes the complete database schema for the Scoreboard Pro application.
  It creates all necessary tables, views, functions, and Row Level Security policies.

  ## New Tables
  
  ### 1. `profiles`
  - Stores user profile information synced with auth.users
  - `id` (uuid, primary key) - references auth.users(id)
  - `email` (text) - user email address
  - `created_at` (timestamptz) - profile creation timestamp
  - `updated_at` (timestamptz) - last update timestamp

  ### 2. `orgs`
  - Stores organizations (isolated from each other)
  - `id` (uuid, primary key) - unique organization identifier
  - `slug` (text, unique) - URL-friendly organization identifier
  - `name` (text) - organization display name
  - `sport` (text) - sport type for the organization (basic, football, handball, basket, hockey_ice, hockey_field, volleyball)
  - `created_at` (timestamptz) - organization creation timestamp
  
  ### 3. `org_members`
  - Links users to organizations with specific roles
  - `org_id` (uuid) - references orgs(id)
  - `user_id` (uuid) - references profiles(id)
  - `role` (member_role enum) - user role: 'super_admin', 'admin', or 'operator'
  - Primary key: (org_id, user_id)

  ### 4. `matches`
  - Stores match/game information
  - `id` (uuid, primary key) - unique match identifier
  - `org_id` (uuid) - references orgs(id)
  - `name` (text) - match name/description
  - `sport` (text) - sport type for this match
  - `home_name` (text) - home team name
  - `away_name` (text) - away team name
  - `scheduled_at` (timestamptz) - scheduled start time
  - `status` (match_status enum) - 'scheduled', 'live', 'finished', or 'archived'
  - `public_display` (boolean) - whether match is publicly visible
  - `display_token` (text) - secure token for public display access
  - `created_by` (uuid) - user who created the match
  - `created_at` (timestamptz) - match creation timestamp
  - `updated_at` (timestamptz) - last update timestamp

  ## Views
  - `org_members_with_org` - joins org_members with organization details

  ## Security (RLS)
  
  ### Important Security Model
  1. All tables have RLS enabled
  2. Super admins (role='super_admin') have full access across ALL organizations
  3. Regular operators only access their assigned organizations
  4. Each organization is isolated - operators cannot see other organizations
  5. Business rule: Only 1 active match per organization (enforced in application)

  ### Policies Summary
  - **Profiles**: Users can only view/update their own profile
  - **Orgs**: Super admins manage all, operators view their assigned orgs
  - **Org Members**: Super admins manage all, users view their memberships
  - **Matches**: Users access matches only from their assigned organizations

  ## Functions
  - `handle_new_user()` - auto-creates profile when user signs up
  - `set_updated_at()` - updates the updated_at timestamp
  - `rand_token()` - generates secure random tokens
*/

-- ============================================
-- STEP 1: EXTENSIONS & TYPES
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_role') THEN
    CREATE TYPE public.member_role AS ENUM ('super_admin','admin','operator');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
    CREATE TYPE public.match_status AS ENUM ('scheduled','live','finished','archived');
  END IF;
END $$;

-- ============================================
-- STEP 2: UTILITY FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.set_updated_at() 
RETURNS trigger 
LANGUAGE plpgsql 
AS $$
BEGIN 
  new.updated_at = now(); 
  RETURN new; 
END; 
$$;

CREATE OR REPLACE FUNCTION public.rand_token(n int DEFAULT 12) 
RETURNS text 
LANGUAGE sql 
IMMUTABLE 
AS $$
  SELECT substring(encode(gen_random_bytes(ceil(n/2.0)::int), 'hex') FROM 1 FOR n);
$$;

-- ============================================
-- STEP 3: CREATE TABLES (WITHOUT RLS)
-- ============================================

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Organizations table
CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  sport text NOT NULL DEFAULT 'basic' CHECK (sport IN ('basic','football','handball','basket','hockey_ice','hockey_field','volleyball')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Organization members table
CREATE TABLE IF NOT EXISTS public.org_members (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.member_role NOT NULL DEFAULT 'operator',
  PRIMARY KEY (org_id, user_id)
);

-- Matches table
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  sport text NOT NULL CHECK (sport IN ('basic','football','handball','basket','hockey_ice','hockey_field','volleyball')),
  home_name text NOT NULL,
  away_name text NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status public.match_status NOT NULL DEFAULT 'scheduled',
  public_display boolean NOT NULL DEFAULT true,
  display_token text NOT NULL DEFAULT public.rand_token(12),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- STEP 4: CREATE VIEWS
-- ============================================

CREATE OR REPLACE VIEW public.org_members_with_org AS
SELECT 
  om.org_id,
  om.user_id,
  om.role,
  o.slug AS org_slug, 
  o.name AS org_name,
  o.sport AS org_sport,
  p.email AS user_email
FROM public.org_members om
JOIN public.orgs o ON o.id = om.org_id
LEFT JOIN public.profiles p ON p.id = om.user_id;

-- ============================================
-- STEP 5: CREATE TRIGGERS
-- ============================================

-- Auto-create profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Update triggers
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated 
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_matches_updated ON public.matches;
CREATE TRIGGER trg_matches_updated 
  BEFORE UPDATE ON public.matches 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- STEP 6: ENABLE RLS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 7: RLS POLICIES FOR PROFILES
-- ============================================

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- STEP 8: RLS POLICIES FOR ORGS
-- ============================================

CREATE POLICY "Super admins can view all orgs"
  ON public.orgs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role = 'super_admin'
    )
  );

CREATE POLICY "Operators can view assigned orgs"
  ON public.orgs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = orgs.id
      AND org_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can create orgs"
  ON public.orgs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update orgs"
  ON public.orgs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete orgs"
  ON public.orgs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role = 'super_admin'
    )
  );

-- ============================================
-- STEP 9: RLS POLICIES FOR ORG_MEMBERS
-- ============================================

CREATE POLICY "Super admins can view all members"
  ON public.org_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view own memberships"
  ON public.org_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can create members"
  ON public.org_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update members"
  ON public.org_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete members"
  ON public.org_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'super_admin'
    )
  );

-- ============================================
-- STEP 10: RLS POLICIES FOR MATCHES
-- ============================================

CREATE POLICY "Users can view org matches"
  ON public.matches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = matches.org_id
      AND org_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create org matches"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = matches.org_id
      AND org_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update org matches"
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = matches.org_id
      AND org_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = matches.org_id
      AND org_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete org matches"
  ON public.matches
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = matches.org_id
      AND org_members.user_id = auth.uid()
    )
  );
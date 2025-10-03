/*
  # Schéma initial avec système de rôles et Display token
  
  1. Tables principales
    - `orgs` : Organisations/Espaces (associations sportives)
      - Chaque organisation a un `display_token` unique pour son affichage
    - `org_members` : Membres des organisations avec leurs rôles
      - `super_admin` : Gère tous les Espaces, crée les associations et opérateurs
      - `operator` : Gère uniquement son Espace
    - `matches` : Matchs de chaque organisation
      - Chaque match appartient à une organisation
    - `profiles` : Profils utilisateurs liés à auth.users
  
  2. Concept d'Espace
    - 1 Espace = 1 Organisation = 1 Opérateur = 1 Match actif = 1 Display
    - Chaque Espace est indépendant et isolé
    - URL Display unique : /display/:display_token
  
  3. Sécurité
    - RLS activé sur toutes les tables
    - Super_admin peut tout gérer
    - Operator ne voit que son organisation
    - Display est public via le token
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fonction pour générer des tokens aléatoires
CREATE OR REPLACE FUNCTION public.rand_token(n int DEFAULT 12) 
RETURNS text 
LANGUAGE sql 
IMMUTABLE AS $$
  SELECT substring(encode(gen_random_bytes(ceil(n/2.0)::int), 'hex') FROM 1 FOR n);
$$;

-- Table des organisations (Espaces)
CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  display_token text UNIQUE NOT NULL DEFAULT public.rand_token(16),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Type enum pour les rôles
DO $$ BEGIN
  CREATE TYPE public.member_role AS ENUM ('super_admin', 'operator');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Table des membres d'organisation
CREATE TABLE IF NOT EXISTS public.org_members (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.member_role NOT NULL DEFAULT 'operator',
  PRIMARY KEY (org_id, user_id)
);

-- Vue pour joindre les membres avec leurs organisations
CREATE OR REPLACE VIEW public.org_members_with_org AS
SELECT om.*, o.slug as org_slug, o.name as org_name, o.display_token as org_display_token
FROM public.org_members om
JOIN public.orgs o ON o.id = om.org_id;

-- Type enum pour les statuts de match
DO $$ BEGIN
  CREATE TYPE public.match_status AS ENUM ('scheduled', 'live', 'finished', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Table des matchs
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  sport text NOT NULL CHECK (sport IN ('basic', 'football', 'handball', 'basket', 'hockey_ice', 'hockey_field', 'volleyball')),
  home_name text NOT NULL,
  away_name text NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status public.match_status NOT NULL DEFAULT 'scheduled',
  public_display boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() 
RETURNS trigger 
LANGUAGE plpgsql AS $$
BEGIN 
  new.updated_at = now(); 
  RETURN new; 
END; 
$$;

-- Trigger pour matches.updated_at
DROP TRIGGER IF EXISTS trg_matches_updated ON public.matches;
CREATE TRIGGER trg_matches_updated 
  BEFORE UPDATE ON public.matches 
  FOR EACH ROW 
  EXECUTE FUNCTION public.set_updated_at();

-- Table des profils utilisateurs
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger pour profiles.updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated 
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION public.set_updated_at();

-- Fonction pour créer automatiquement un profil lors de l'inscription
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

-- Trigger pour créer le profil automatiquement
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();

-- ==================
-- RLS (Row Level Security)
-- ==================

-- Activer RLS sur toutes les tables
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies pour orgs
CREATE POLICY "Super admins can manage all orgs"
  ON public.orgs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role = 'super_admin'
    )
  );

CREATE POLICY "Operators can view their org"
  ON public.orgs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = orgs.id
      AND org_members.user_id = auth.uid()
    )
  );

-- Policies pour org_members
CREATE POLICY "Super admins can manage all members"
  ON public.org_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view their own memberships"
  ON public.org_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policies pour matches
CREATE POLICY "Super admins can manage all matches"
  ON public.matches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role = 'super_admin'
    )
  );

CREATE POLICY "Operators can manage their org matches"
  ON public.matches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = matches.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'operator'
    )
  );

-- Policies pour profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
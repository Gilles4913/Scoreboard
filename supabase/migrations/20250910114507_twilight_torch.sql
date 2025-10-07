@@ .. @@
 drop trigger if exists trg_matches_updated on public.matches;
 create trigger trg_matches_updated before update on public.matches for each row execute function public.set_updated_at();
 
+-- User profiles table
+create table if not exists public.profiles (
+  id uuid primary key references auth.users(id) on delete cascade,
+  email text,
+  created_at timestamptz not null default now(),
+  updated_at timestamptz not null default now()
+);
+
+alter table public.profiles enable row level security;
+
+-- RLS policies for profiles
+create policy "Users can view own profile"
+  on public.profiles
+  for select
+  to authenticated
+  using (auth.uid() = id);
+
+create policy "Users can update own profile"
+  on public.profiles
+  for update
+  to authenticated
+  using (auth.uid() = id);
+
+-- Function to handle new user creation
+create or replace function public.handle_new_user()
+returns trigger
+language plpgsql
+security definer set search_path = public
+as $$
+begin
+  insert into public.profiles (id, email)
+  values (new.id, new.email);
+  return new;
+end;
+$$;
+
+-- Trigger to automatically create profile for new users
+drop trigger if exists on_auth_user_created on auth.users;
+create trigger on_auth_user_created
+  after insert on auth.users
+  for each row execute procedure public.handle_new_user();
+
+-- Update trigger for profiles
+drop trigger if exists trg_profiles_updated on public.profiles;
+create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
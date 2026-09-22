-- ============================================================================
-- 0005: FUNCTIONS + TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_admin()
--
-- A small helper that answers "is the currently logged-in person an admin?".
-- We'll use this inside our security policies (migration 0007) instead of
-- writing "select role from profiles where id = auth.uid()" over and over.
--
-- It's marked SECURITY DEFINER, which is a special Postgres setting meaning
-- "run this with the permissions of the person who created it" rather than
-- the permissions of whoever calls it. This matters because it lets the
-- function peek at the profiles table even when row-level security would
-- normally block that - otherwise checking "are you an admin" from inside a
-- security policy ON the profiles table would cause an infinite loop.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

comment on function public.is_admin() is 'True if the currently authenticated user is an active admin. Used inside RLS policies.';

-- ----------------------------------------------------------------------------
-- set_updated_at()
--
-- Whenever a row in a table that has an "updated_at" column changes, this
-- automatically stamps it with the current time, so nobody has to remember
-- to do it manually in application code.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- handle_new_user()
--
-- Supabase Auth's "auth.users" table is separate from our "public.profiles"
-- table. This trigger watches for new sign-ups and automatically creates the
-- matching profile row the moment someone signs up, so the app never has to
-- do that step itself (and can never forget to).
--
-- SECURITY NOTE: every new sign-up becomes role = 'worker', no exceptions,
-- no matter what data they send during sign-up. We deliberately IGNORE any
-- "role" field a person might try to sneak into their sign-up request -
-- never trust the client to tell you what permissions it should have.
-- The only supported way to become an admin is the claim_admin_role()
-- function below, which checks a secret code on the server.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'worker'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

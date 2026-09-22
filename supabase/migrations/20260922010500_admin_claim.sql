-- ============================================================================
-- 0006: THE ADMIN SIGN-UP CODE (done the safe way)
--
-- Your original plan: "type a special code when signing up as admin".
-- The unsafe version of this lives entirely in the browser's JavaScript,
-- which means anyone can open dev tools and read the code, or just skip
-- the check entirely. We're going to do it properly instead: the code lives
-- ONLY in the database, in a table nobody (and no API key) is allowed to
-- read directly. The only way to use it is through one narrow, one-purpose
-- function.
-- ============================================================================

-- A single-row table holding the current admin sign-up code.
-- The "id boolean primary key default true check (id)" trick is a common
-- Postgres pattern to guarantee this table can only ever contain ONE row -
-- there's nothing to look up, there's just "the" row.
create table if not exists public.app_secrets (
  id                 boolean primary key default true check (id),
  admin_signup_code  text not null
);

comment on table public.app_secrets is 'Holds server-only secrets. RLS blocks ALL direct access - only SECURITY DEFINER functions may read this.';

-- Turn on RLS and then deliberately add ZERO policies. With RLS on and no
-- policies, the answer to "can anyone read or write this table directly?"
-- is simply no - not workers, not admins, not even using the public API key.
alter table public.app_secrets enable row level security;

-- Put in a starter code so the table isn't empty. CHANGE THIS before you
-- give this code to anyone, and change it again any time someone leaves
-- who shouldn't be able to make new admins anymore. See the README for how
-- to update it safely from the SQL editor.
insert into public.app_secrets (id, admin_signup_code)
values (true, 'CHANGE-ME-BEFORE-LAUNCH')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- claim_admin_role(input_code)
--
-- Called by the app AFTER someone has already signed up normally (so they
-- already exist as a 'worker'). If input_code matches what's stored in
-- app_secrets, their own profile is upgraded to 'admin'. If it doesn't
-- match, nothing happens and it returns false.
--
-- Three things make this safe:
--  1. It's SECURITY DEFINER, so it can read app_secrets even though the
--     table's own RLS would otherwise block that for everyone.
--  2. It only ever updates the CALLER's own row (auth.uid()), never
--     someone else's - a worker can't use this to promote a different user.
--  3. The comparison happens entirely inside the database. The code is
--     never sent to, or checked in, the browser.
-- ----------------------------------------------------------------------------
create or replace function public.claim_admin_role(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  correct_code text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select admin_signup_code into correct_code from public.app_secrets where id = true;

  if correct_code is null or input_code is null or input_code <> correct_code then
    return false;
  end if;

  -- The "role" column is normally protected by the trg_protect_profile_role
  -- trigger (migration 0008), which stops anyone but an existing admin from
  -- changing it - and right up until the next line, this person isn't an
  -- admin yet. set_config below raises a one-time, transaction-local flag
  -- that the trigger checks and treats as "this specific write is trusted,
  -- let it through". "true" as the third argument means it automatically
  -- resets itself the moment this transaction finishes - it can't leak into
  -- any other request.
  perform set_config('app.bypass_role_protection', 'true', true);

  update public.profiles
     set role = 'admin'
   where id = auth.uid();

  return true;
end;
$$;

comment on function public.claim_admin_role(text) is 'Upgrades the calling user to admin ONLY if input_code matches app_secrets.admin_signup_code.';

-- Any logged-in user is allowed to CALL this function (they need to, to ever
-- become an admin) - but calling it does nothing useful unless they know
-- the correct code, because of the check inside the function itself.
revoke all on function public.claim_admin_role(text) from public;
grant execute on function public.claim_admin_role(text) to authenticated;

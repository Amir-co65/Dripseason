-- ============================================================================
-- 0008: CLOSING A GAP - protecting the "role" and "is_active" columns
--
-- The "profiles_update_own" policy in migration 0007 lets a user update
-- their OWN row. Row Level Security only controls which ROWS you can touch,
-- not which COLUMNS within an allowed row - so as written, a worker could
-- call supabase.from('profiles').update({ role: 'admin' }) on their own id
-- and it would be allowed by that policy. This trigger closes that gap: on
-- any update, unless the caller is already an admin (or this is the one
-- trusted exception below), we silently put the old role/is_active value
-- back before the row is saved - so the write "succeeds" but quietly does
-- nothing to those two fields.
--
-- THE ONE EXCEPTION: claim_admin_role() (migration 0006) legitimately needs
-- to flip a brand-new user's role to 'admin', at a moment when they are, by
-- definition, not an admin yet - so the normal rule above would block it.
-- That function raises a short-lived, transaction-only flag via
-- set_config('app.bypass_role_protection', 'true', true) right before it
-- writes, and this trigger checks for that exact flag. Nothing else in the
-- app sets that flag, so this exception can't be triggered from outside
-- that one function.
-- ============================================================================

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bypass_role_protection', true) = 'true' then
    return new;
  end if;

  if not public.is_admin() then
    new.role = old.role;
    new.is_active = old.is_active;
  end if;

  return new;
end;
$$;

create trigger trg_protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ============================================================================
-- 0007: ROW LEVEL SECURITY POLICIES
--
-- RLS was turned ON for these tables back in migrations 0002-0004, which by
-- itself means "block everything". Each policy below is an exception that
-- opens up one specific, narrow kind of access. Read them as sentences:
-- "workers ARE allowed to select their own profile", etc.
--
-- auth.uid() = the id of whoever is currently logged in, as far as
-- Supabase Auth is concerned. It's null if nobody is logged in.
-- ============================================================================

-- -----------------------------
-- PROFILES
-- -----------------------------

-- Anyone logged in can see their own profile row.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Admins can see every profile (needed for an admin's "manage workers" screen).
create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- A user can update their own row, but ONLY the safe fields - see the note
-- below about why "role" isn't protected at this layer alone.
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins can update anyone's row (e.g. to deactivate a worker, or manually
-- change a role).
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Nobody gets an INSERT policy here on purpose - the only supported way a
-- profile row gets created is the handle_new_user() trigger from migration
-- 0005, which runs as SECURITY DEFINER and therefore bypasses RLS entirely.
-- Same idea for DELETE: profiles are removed automatically (via
-- "on delete cascade") when the matching auth.users row is deleted.

-- -----------------------------
-- ACTIVITY_LOGS
-- -----------------------------

-- A user can see log entries about their own actions.
create policy "activity_logs_select_own"
  on public.activity_logs for select
  to authenticated
  using (user_id = auth.uid());

-- Admins can see the full audit trail.
create policy "activity_logs_select_admin"
  on public.activity_logs for select
  to authenticated
  using (public.is_admin());

-- Any logged-in user can write a log entry, but only ever attributed to
-- themselves - they can't log an action as if it were done by someone else.
create policy "activity_logs_insert_own"
  on public.activity_logs for insert
  to authenticated
  with check (user_id = auth.uid());

-- Log entries are an audit trail - once written, nobody (not even admins)
-- can edit or delete them through the API. That's intentional: an audit
-- trail that can be edited isn't trustworthy. (An admin could still do it
-- from the Supabase dashboard directly if truly necessary, since that
-- connects as a superuser and bypasses RLS.)

-- -----------------------------
-- NOTIFICATIONS
-- -----------------------------

-- A user can see notifications sent TO them.
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications_select_admin"
  on public.notifications for select
  to authenticated
  using (public.is_admin());

-- A user can mark their own notifications as read (that's the only kind of
-- update a normal user should ever make here).
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Only admins can create notifications (i.e. send messages to workers).
create policy "notifications_insert_admin"
  on public.notifications for insert
  to authenticated
  with check (public.is_admin());

-- Only admins can delete notifications outright.
create policy "notifications_delete_admin"
  on public.notifications for delete
  to authenticated
  using (public.is_admin());

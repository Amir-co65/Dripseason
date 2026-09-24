-- ============================================================================
-- PHASE 2 - 0009: CHAPTERS
--
-- Maps from the original app's hauls.chapters[]. A chapter is a batch of
-- haul purchases (the original JSON's chapter.name / chapter.dateRange).
--
-- We deliberately do NOT store moneySpent/moneyWon/profit/etc. as columns
-- here, even though the original JSON had them. Those were CALCULATED
-- values (sums over the chapter's items), and storing calculated numbers
-- as their own columns means they can quietly drift out of sync with the
-- real data over time. In this new schema they'll be calculated on demand
-- from inventory_items/sales instead (a reporting view, once Sales exists)
-- - so nothing is lost, it's just computed instead of stored twice.
-- ============================================================================

create table if not exists public.chapters (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  date_range    text,                     -- kept as free text, e.g. "21.1" - matches original, not a real date
  chapter_number integer,

  -- --- import / legacy tracking ---
  legacy_id     text unique,              -- original chapter.id, e.g. "ch-abc123"
  legacy_raw    jsonb,                    -- the ENTIRE original chapter object, verbatim, as a safety net

  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.chapters is 'A batch of haul purchases. Maps 1:1 from the original app''s hauls.chapters[].';
comment on column public.chapters.legacy_raw is 'The full original JSON object for this chapter, kept so no field is ever lost even if it has no typed column here.';

create index if not exists idx_chapters_legacy_id on public.chapters (legacy_id);

create trigger trg_chapters_set_updated_at
  before update on public.chapters
  for each row execute function public.set_updated_at();

alter table public.chapters enable row level security;

-- Inventory data is shared operational data both roles need to do their
-- job (unlike profiles, which are private per-person). Both workers and
-- admins can see and manage chapters - the sensitive part isn't THIS
-- table, it's the money fields living on inventory_items/sales, which get
-- masked separately (see migration 0014).
create policy "chapters_select_authenticated"
  on public.chapters for select
  to authenticated
  using (true);

create policy "chapters_insert_authenticated"
  on public.chapters for insert
  to authenticated
  with check (true);

create policy "chapters_update_authenticated"
  on public.chapters for update
  to authenticated
  using (true)
  with check (true);

-- Deleting a whole chapter is destructive (cascades to its packages and
-- items) - restrict that to admins only.
create policy "chapters_delete_admin"
  on public.chapters for delete
  to authenticated
  using (public.is_admin());

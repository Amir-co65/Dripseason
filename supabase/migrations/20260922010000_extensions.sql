-- ============================================================================
-- 0001: EXTENSIONS
-- Turns on a couple of built-in Postgres add-ons Supabase ships with.
-- pgcrypto gives us gen_random_uuid() to generate unique IDs.
-- ============================================================================

create extension if not exists "pgcrypto" with schema extensions;

# Project26 - Web Foundation

This is the brand-new foundation for Project26, built on React + Supabase.
It does NOT touch or replace your old single-file app - this is a separate,
from-scratch project. Right now it only handles **signing up, signing in,
and roles (admin/worker)**. There's no inventory yet on purpose - that comes
next, once this part is confirmed solid.

This README assumes you've never done this before, so every step is spelled
out. If a word is unfamiliar, check the "Words used in this guide" section
at the bottom.

---

## What you're about to do, in one sentence each

1. Create a free Supabase project (this is your database + login system).
2. Run the SQL files in `supabase/migrations/` to build your database tables.
3. Tell the app how to find your Supabase project (one small file).
4. Install the project's tools and run it on your computer.
5. (Later) Put it online.

---

## Part 1 - Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub sign-in is the fastest way).
2. Click **New project**.
3. Pick an organization (if it's your first time, Supabase creates one for you automatically).
4. Fill in:
   - **Name**: `project26` (or anything you like)
   - **Database Password**: click "Generate a password" and then **save it somewhere** (a notes app is fine) - you likely won't need it day-to-day, but it's your master key if you ever need it.
   - **Region**: pick whichever is closest to you.
5. Click **Create new project**. It takes 1-2 minutes to set up - you'll see a progress screen.

## Part 2 - Run the database migrations

The files in `supabase/migrations/` are numbered SQL files that build your
entire database - tables, security rules, everything. You'll run them in
order, in Supabase's built-in web-based SQL editor (no extra software needed
for this part).

1. In your Supabase project, click **SQL Editor** in the left-hand menu.
2. Click **New query**.
3. Open the first file, `supabase/migrations/20260922010000_extensions.sql`, on your computer (any text editor, even Notepad, works). Copy its entire contents.
4. Paste it into the Supabase SQL editor, then click **Run** (or press Ctrl+Enter / Cmd+Enter).
5. You should see "Success. No rows returned" at the bottom. If you see a red error instead, stop and re-check you copied the whole file.
6. Repeat steps 3-5 for **every file in the folder, in this exact order** (the numbers at the start of each filename tell you the order):
   1. `20260922010000_extensions.sql`
   2. `20260922010100_profiles.sql`
   3. `20260922010200_activity_logs.sql`
   4. `20260922010300_notifications.sql`
   5. `20260922010400_functions_triggers.sql`
   6. `20260922010500_admin_claim.sql`
   7. `20260922010600_rls_policies.sql`
   8. `20260922010700_protect_role_column.sql`

That's it - your database now has three tables, all your security rules, and
the admin-code system, all live.

### Set your real admin code

Migration 6 inserted a placeholder admin code: `CHANGE-ME-BEFORE-LAUNCH`.
Change it now:

1. Back in the SQL Editor, run this (put your own secret phrase in place of the example):
   ```sql
   update public.app_secrets
   set admin_signup_code = 'your-own-secret-phrase-here'
   where id = true;
   ```
2. This is the code you (or whoever you trust) will type in when signing up as an admin. Keep it somewhere private - anyone who has it can make themselves an admin.

## Part 3 - Connect the app to your Supabase project

1. In Supabase, click **Project Settings** (gear icon) → **API**.
2. You'll see **Project URL** and a key labeled **anon / public** - you need both. (There's also a "service_role" key on that page - never use that one here, it bypasses all your security rules.)
3. In this project folder on your computer, find the file called `.env.example`. Make a copy of it and rename the copy to exactly `.env` (just those 4 characters, no ".example").
4. Open `.env` in a text editor and fill it in:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-long-anon-key-here
   ```
5. Save the file. Never share this file or upload it anywhere public - even though the anon key is meant to be public-safe, it's good habit to keep `.env` private (it's already excluded via `.gitignore` so it won't accidentally get uploaded to GitHub).

## Part 4 - Install and run the app on your computer

You'll need **Node.js** installed first - it's the program that runs
JavaScript tools like this one outside of a browser.

1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** version. Install it like any other program (click Next through the installer).
2. Open a terminal (on Windows: search for "Command Prompt" or "PowerShell"; on Mac: search for "Terminal").
3. Navigate into this project folder. If you extracted it to your Desktop, that's usually:
   ```
   cd Desktop/project26-web
   ```
4. Install all the project's dependencies (the libraries the code needs to run) - this downloads everything listed in `package.json`:
   ```
   npm install
   ```
   This can take a minute or two the first time.
5. Start the app:
   ```
   npm run dev
   ```
6. The terminal will print a web address, almost always `http://localhost:5173`. Open that in your browser.
7. You should see a **Sign in** screen. Click **Sign up**, create an account, and check the "I have an admin code" box if you want to be the first admin (using the code you set in Part 2).

If something goes wrong, the terminal's error message almost always says
exactly what's missing (usually a typo in `.env`, or `npm install` not
finishing). Copy the error and we can go through it together.

## Part 5 - Putting this online (when you're ready)

This app is built to deploy on **Vercel** (free tier is enough for now).
That's a separate step we can walk through together once you've confirmed
sign-up/sign-in works locally - it mainly involves connecting this same
GitHub repo you already have, and pasting your two `.env` values into
Vercel's project settings instead of a local `.env` file.

---

## How the security actually works (short version)

- Every table starts **completely locked** (Row Level Security **on**, no
  exceptions) - nobody can read or write anything until a policy explicitly
  allows it.
- Workers can only ever see **their own** rows. Admins can see everything.
  This is enforced by the database itself, not by the app's code - so even
  if someone tampered with the website, the database would still refuse to
  hand over data they're not allowed to see.
- New sign-ups are **always** created as `worker`, no matter what. The
  **only** way to become `admin` is the `claim_admin_role` database function,
  which checks a secret code that lives only in the database - never in the
  browser.
- Even if a worker's own browser tried to sneakily change their own
  `role` to `admin` (something a plain "update your own profile" rule would
  otherwise allow), a dedicated trigger silently blocks just that one field.

## What's next

Once you've confirmed you can sign up, sign in, sign out, and that a worker
account and an admin account see the (currently identical, since there's no
inventory yet) dashboard correctly, tell me and we'll start building the
actual inventory tables (hauls, sold items, accounts, and so on) on top of
this same foundation - reusing the exact same role/security pattern that's
already in place.

---

## Words used in this guide

- **Repository / repo** - a folder of code, usually stored on GitHub.
- **Terminal** - a text-based way to run commands on your computer, instead of clicking buttons.
- **`npm install`** - downloads all the external code libraries this project depends on (React, Supabase's toolkit, etc.) into a folder called `node_modules`.
- **Environment variable / `.env` file** - a small settings file holding values (like your Supabase keys) that shouldn't be hard-coded into the actual program files.
- **Migration** - a SQL file that makes one specific change to your database (like "add this table"). Running them in order builds up your full database step by step.
- **RLS (Row Level Security)** - a Postgres (database) feature where the database itself checks, on every single request, "is this specific person allowed to see/change this specific row?" - regardless of what the app's frontend code does or doesn't check.
- **Anon / public key** - a key that's safe to put in browser-facing code, because RLS controls what it can actually access.
- **Service role key** - a master key that skips all RLS rules. Never put this in any frontend code - it only belongs on a secure server, and this project doesn't need it at all yet.

# Granite — Deployment Setup

A standalone copy of the credit-hire.ai engine, re-skinned for CRASH + JMK. It runs on its **own**
Supabase project and its **own** Anthropic key — nothing here calls back to credit-hire.ai.

Estimated time: ~30–45 minutes.

## 1. Anthropic key (the new CRASH/JMK key)

Create a key at console.anthropic.com. You'll set it on Vercel as `ANTHROPIC_API_KEY` (Step 4).

## 2. New Supabase project

1. supabase.com → **New Project** (region: EU West / London).
2. **Project Settings → API**: copy the **Project URL** and **anon/public key**.
3. **Authentication → Providers**: ensure **Email** is enabled.
4. **Authentication → URL Configuration**: set Site URL to your Vercel URL once you have it.
5. **SQL Editor**: run the scripts in `/sql` to create the approvals, learn-progress and logging
   tables (run `setup_auto_approval.sql`, `setup_activity_logs.sql`, the `champions_and_emails`,
   `trial_invites`, `fix_module_progress_rls` and `diagnose_and_fix_learn_progress` scripts).
   The `bhr_domain_gate.sql` from the original is intentionally **not** included.

### Approved users (email-gated access)

Load the approved staff emails into the approvals table (see `champions_and_emails.sql` for the
pattern). Registration succeeds only for an approved email on an approved domain
(`crashservices.com` / `jmksolicitors.com`); the user then sets a personal password. Removing an
email revokes access. Seed with dummy users first, then add the real CRASH/JMK testers.

## 3. Configure the app

Edit `config.js` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the new project's values.

## 4. Deploy to Vercel

1. Import the **Granite** GitHub repo at vercel.com (New Project).
2. **Environment Variables** — add:
   - `ANTHROPIC_API_KEY` — the CRASH/JMK key from Step 1
   - `SUPABASE_URL` — the new project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API → service_role key
   - `SUPABASE_ANON_KEY` — the anon key
3. Deploy. You'll get a `*.vercel.app` preview URL — that's the prototype target.

## 5. Smoke test

- Sign in with a `@crashservices.com` dummy user → UI should be **blue**; a `@jmksolicitors.com`
  user → **burgundy**.
- Ask a question on `/app` → answer returns **with citations**.
- Work through a `/learn` module + assessment → progress shows on `/dashboard`.

## Notes

- Brand palettes/fonts live in `brand.js`. CRASH font is a sans fallback pending confirmation.
- The standing "research aid, not advice" disclaimer is injected by `brand.js` on every page.
- To later split CRASH and JMK into fully separate stacks, fork this repo and stand up a second
  Supabase project — cheap, because the corpus is just the JSON files in this repo.

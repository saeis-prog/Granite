# Granite — "Ask the Oracle"

Internal staff portal for **CRASH Services** and **JMK Solicitors**. One app, two brands,
selected automatically from the signed-in user's email domain:

- `@crashservices.com` → **CRASH** (blue)
- `@jmksolicitors.com` → **JMK** (burgundy)

It is a working prototype (not a production system) demonstrating two components, built on the
proven credit-hire.ai engine, copied in so the two brands can diverge editorially over time.

## Components

1. **AI knowledge query** (`/app`) — ask a credit-hire / liability / process question and get an
   answer grounded in curated source material, **with citations**. Retrieval-with-citation, never
   unsourced assertion.
2. **Learning module** (`/learn`) — work through training with a multiple-choice assessment;
   progress and performance are recorded (manager view at `/dashboard`, admin at `/admin`).

## Stack

Static HTML + Vercel serverless functions (`/api/*.js`) + Supabase (auth, approvals, learn
progress) + Anthropic (inference). No dependency on Proclaim or any back-office system.

## Brand-by-domain

`brand.js` re-skins the UI by overriding the shared CSS variables and sets the standing
disclaimer. The brand is derived from the authenticated email domain; a user belongs to one
business or the other. Edit palettes/fonts in `brand.js`.

## What was deliberately left out (vs credit-hire.ai)

- The **BHR rebuttal programme** (`bhr-rebuttal*.html`, `bhr-review.js`, rebuttal template data,
  `bhr_domain_gate.sql`) — walled off per the brief. Note: *basic-hire-rate reference data*
  (`bhr_terms_db.json`) is retained because rate **issues** remain in scope for queries.
- Out-of-scope tooling: ACRISS lookup, correspondence generator, supplier conviction/surcharge
  updaters, driving-distance, T&C monitor, news/tools pages.

## Outstanding (see brief §11)

- CRASH wordmark **font** + graphics (brand.js uses a sans fallback until confirmed).
- **NI corpus** (Greenbook NI, NI Highway Code, County/High Court rules, etc.) — ingested later
  from SharePoint and tagged by jurisdiction. The query engine already weights NI authority ahead
  of England & Wales except Supreme Court / House of Lords decisions.
- A **separate CRASH/JMK Anthropic key** (set as the `ANTHROPIC_API_KEY` env var on Vercel).

See `SETUP.md` to deploy.

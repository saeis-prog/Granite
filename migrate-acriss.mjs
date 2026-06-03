#!/usr/bin/env node
// ============================================================
// Granite — migrate acriss_vehicles  (credit-hire.ai  ->  Granite)
// ------------------------------------------------------------
// Run AFTER creating the table with sql/create_acriss_vehicles.sql.
//
// Usage (service-role keys are SECRET — pass as env vars, never edit them in):
//
//   SRC_KEY="<credit-hire.ai service_role key>" \
//   DST_KEY="<Granite service_role key>" \
//   node migrate-acriss.mjs
//
// Get each service_role key from: Supabase → that project → Settings → API.
// (Override SRC_URL / DST_URL only if the project URLs differ from the defaults.)
// ============================================================

const SRC_URL = process.env.SRC_URL || 'https://qgxefdfatcvcodjoodyg.supabase.co'; // credit-hire.ai
const DST_URL = process.env.DST_URL || 'https://oekqefnoocgdgwsxsfdm.supabase.co'; // Granite
const SRC_KEY = process.env.SRC_KEY;
const DST_KEY = process.env.DST_KEY;

const TABLE = 'acriss_vehicles';
// Exact columns the app uses — keeps source/dest shapes aligned (id is omitted so
// the destination generates its own primary keys).
const COLS = 'manufacturer,model,year,trim,descriptor,category,fuel_type,list_price,' +
             'acriss_category,acriss_type,acriss_fuel,acriss_code,seats,doors,bhp';
const PAGE = 1000;  // PostgREST max rows per read
const BATCH = 500;  // rows per insert

if (!SRC_KEY || !DST_KEY) {
  console.error('✗ Set SRC_KEY and DST_KEY env vars (the two service_role keys). Aborting.');
  process.exit(1);
}

async function readAll() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${SRC_URL}/rest/v1/${TABLE}?select=${COLS}`, {
      headers: {
        apikey: SRC_KEY,
        Authorization: `Bearer ${SRC_KEY}`,
        Range: `${from}-${from + PAGE - 1}`,
        'Range-Unit': 'items',
      },
    });
    if (!res.ok) throw new Error(`Read failed ${res.status}: ${await res.text()}`);
    const chunk = await res.json();
    rows.push(...chunk);
    process.stdout.write(`\r  read ${rows.length} rows…`);
    if (chunk.length < PAGE) break;
  }
  process.stdout.write('\n');
  return rows;
}

async function writeAll(rows) {
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${DST_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        apikey: DST_KEY,
        Authorization: `Bearer ${DST_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Write failed ${res.status}: ${await res.text()}`);
    done += batch.length;
    process.stdout.write(`\r  wrote ${done}/${rows.length} rows…`);
  }
  process.stdout.write('\n');
}

(async () => {
  console.log(`Source: ${SRC_URL}`);
  console.log(`Dest:   ${DST_URL}`);
  console.log(`Table:  ${TABLE}\n`);
  const rows = await readAll();
  if (!rows.length) { console.log('No rows found in source — nothing to migrate.'); return; }
  await writeAll(rows);
  console.log(`\n✓ Done — migrated ${rows.length} rows.`);
})().catch((e) => { console.error('\n✗ ERROR:', e.message); process.exit(1); });

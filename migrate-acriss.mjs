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

// Source stores some numbers as text with thousands commas (e.g. "30,985").
// Coerce numeric/integer columns so they fit the typed destination columns.
const NUM_COLS = ['list_price'];
const INT_COLS = ['year', 'seats', 'doors', 'bhp'];
function toNum(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function cleanRow(r) {
  const o = { ...r };
  for (const c of NUM_COLS) if (c in o) o[c] = toNum(o[c]);
  for (const c of INT_COLS) if (c in o) { const n = toNum(o[c]); o[c] = n == null ? null : Math.round(n); }
  return o;
}

async function countRows(url, key) {
  // exact count via PostgREST (Prefer: count=exact -> Content-Range: 0-0/<total>)
  const res = await fetch(`${url}/rest/v1/${TABLE}?select=acriss_code`, {
    method: 'HEAD',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Range: '0-0',
      'Range-Unit': 'items',
      Prefer: 'count=exact',
    },
  });
  if (!res.ok) throw new Error(`Count failed ${res.status}: ${await res.text()}`);
  const cr = res.headers.get('content-range') || '';      // e.g. "0-0/12345"
  const total = parseInt(cr.split('/')[1], 10);
  return Number.isNaN(total) ? null : total;
}

async function writeAll(rows) {
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(cleanRow);
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

  // ── Verify: compare exact row counts in source vs destination ──
  const srcCount = await countRows(SRC_URL, SRC_KEY);
  const dstCount = await countRows(DST_URL, DST_KEY);
  console.log(`\nSource rows:      ${srcCount ?? 'unknown'}`);
  console.log(`Destination rows: ${dstCount ?? 'unknown'}`);

  if (srcCount != null && dstCount != null && srcCount === dstCount) {
    console.log(`\n✓ Done — counts match (${dstCount} rows).`);
  } else {
    console.log('\n⚠ Done, but counts do NOT match. If the destination already had rows, ' +
                'TRUNCATE acriss_vehicles and re-run, or investigate the difference above.');
    process.exitCode = 2;
  }
})().catch((e) => { console.error('\n✗ ERROR:', e.message); process.exit(1); });

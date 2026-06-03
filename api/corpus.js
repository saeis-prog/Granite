/**
 * credit-hire.ai — Authenticated Corpus File Server
 * Vercel Serverless Function: /api/corpus
 *
 * GET /api/corpus?file=case_database.json
 *
 * Security:
 *   - Requires a valid Supabase JWT in the Authorization header
 *   - Only serves whitelisted JSON filenames (no path traversal)
 *   - CORS restricted to credit-hire.ai (+ localhost for dev)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// ── Whitelist of servable files ──
// Only these filenames can be requested — prevents directory traversal
const ALLOWED_FILES = new Set([
  'case_database.json',
  'liability_database.json',
  'resources_database.json',
  'posts_index.json',
  'knowledge_base.json',
  'bhr_terms_db.json',
  'jurisdiction_equivalents.json',
  // Learn module files
  'learn/training-index.json',
  'learn/module-01-introduction.json',
  'learn/module-02-legal-framework.json',
  'learn/module-03-liability.json',
  'learn/module-04-qualifying-periods.json',
  'learn/module-05-intervention.json',
  'learn/module-06-rates-evidence.json',
  'learn/module-07-claims-handling.json',
  'learn/module-08-litigation.json',
  'learn/module-09-industry-dynamics.json',
  'learn/module-10-emerging-issues.json'
]);

// ── Allowed origins ──
const ALLOWED_ORIGINS = [
  'https://www.credit-hire.ai',
  'https://credit-hire.ai',
  'http://localhost:3000',
  'http://localhost:5173'
];

function getAllowedOrigin(req) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.endsWith('.vercel.app')) return origin;
  return null;
}

// ── Verify Supabase JWT ──
async function verifyAuth(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { error: 'Auth not configured', status: 500 };
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Authentication required', status: 401 };
  }

  const token = authHeader.slice(7);
  if (!token) {
    return { error: 'Empty token', status: 401 };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (!res.ok) {
      return { error: 'Invalid or expired session — please log in again', status: 401 };
    }

    const user = await res.json();
    if (!user || !user.id) {
      return { error: 'Invalid token', status: 401 };
    }

    return { user };
  } catch (e) {
    console.error('Corpus auth error:', e.message);
    return { error: 'Auth verification failed', status: 500 };
  }
}

// ── File cache (persists across warm invocations) ──
const fileCache = new Map();

export default async function handler(req, res) {
  // ── CORS ──
  const origin = getAllowedOrigin(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  // ── Verify authentication ──
  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  // ── Get requested filename ──
  const { file } = req.query || {};
  if (!file || typeof file !== 'string') {
    return res.status(400).json({ error: 'Missing ?file= parameter' });
  }

  // Normalise: strip leading ./ or /
  const normalised = file.replace(/^\.?\//, '');

  // Check whitelist (prevents path traversal)
  if (!ALLOWED_FILES.has(normalised)) {
    return res.status(404).json({ error: 'File not found or not permitted' });
  }

  try {
    // Check cache first
    if (!fileCache.has(normalised)) {
      const filePath = join(process.cwd(), normalised);
      const content = readFileSync(filePath, 'utf-8');
      fileCache.set(normalised, content);
    }

    const content = fileCache.get(normalised);

    // Set cache headers — browsers can cache for 5 minutes
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=300');

    return res.status(200).send(content);

  } catch (e) {
    console.error(`Corpus read error for ${normalised}:`, e.message);
    return res.status(500).json({ error: 'Failed to read file' });
  }
}

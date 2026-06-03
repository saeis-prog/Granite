/**
 * credit-hire.ai — AI Tutor API
 * Vercel Serverless Function: /api/tutor
 *
 * POST body: {
 *   system_prompt: string,
 *   scenario: string,
 *   messages: [{ role: "user"|"assistant", content: string }],
 *   exchange_count: number
 * }
 * Returns: { reply: string }
 *
 * Security:
 *   - Requires a valid Supabase JWT in the Authorization header
 *   - CORS restricted to credit-hire.ai (+ localhost for dev)
 *   - System prompt length capped to prevent abuse
 */

import Anthropic from '@anthropic-ai/sdk';

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
  // Vercel preview deployments
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
    return { error: 'Missing or invalid Authorization header', status: 401 };
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
      return { error: 'Invalid or expired token', status: 401 };
    }

    const user = await res.json();
    if (!user || !user.id) {
      return { error: 'Invalid token — no user', status: 401 };
    }

    return { user };
  } catch (e) {
    console.error('Auth verification error:', e.message);
    return { error: 'Auth verification failed', status: 500 };
  }
}

export default async function handler(req, res) {
  // ── CORS ──
  const origin = getAllowedOrigin(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Verify authentication ──
  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { system_prompt, scenario, messages, exchange_count } = req.body || {};

  // Validate required fields
  if (!system_prompt || typeof system_prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid system_prompt.' });
  }

  // Cap system prompt length to prevent abuse as a generic Claude proxy
  if (system_prompt.length > 5000) {
    return res.status(400).json({ error: 'system_prompt exceeds maximum length (5000 chars).' });
  }

  if (!scenario || typeof scenario !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid scenario.' });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid messages array.' });
  }

  // Cap conversation length
  if (messages.length > 30) {
    return res.status(400).json({ error: 'Conversation too long (max 30 messages).' });
  }

  if (typeof exchange_count !== 'number' || exchange_count < 0) {
    return res.status(400).json({ error: 'Missing or invalid exchange_count.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable is not set.' });
  }

  try {
    // Build the full system prompt
    let fullSystemPrompt = system_prompt;
    fullSystemPrompt += '\n\nThe scenario for this section is: ' + scenario;

    if (exchange_count >= 8) {
      fullSystemPrompt += '\n\nThe learner has had 8+ exchanges. Summarise what they have learned and offer to move to the next section.';
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: fullSystemPrompt,
      messages: messages
    });

    const reply = message.content[0]?.text || 'No reply generated.';

    res.status(200).json({ reply });

  } catch (e) {
    console.error('Tutor API error:', e);
    res.status(500).json({ error: e.message || 'An unexpected error occurred.' });
  }
}

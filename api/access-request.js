/**
 * credit-hire.ai — Access Request Notification
 * Vercel Serverless Function: /api/access-request
 *
 * POST body: { email: string }
 *
 * 1. Checks if the email/domain already has a recent request (dedup: 24h)
 * 2. Inserts into bhr_access_requests
 * 3. Sends notification email to admin via SendGrid
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || 'sae@credithire.org.uk';
  const FROM_EMAIL = process.env.CHANGELOG_FROM_EMAIL || 'sae@credithire.org.uk';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured.' });
  }

  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required.' });
  }

  const domain = email.split('@')[1].toLowerCase();

  try {
    // 1. Check for recent request from this email (dedup: 7 days — prevents
    //    daily spam when users visit the site for Learn/Ask but aren't approved for BHR)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dedupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bhr_access_requests?email=eq.${encodeURIComponent(email)}&created_at=gte.${encodeURIComponent(sevenDaysAgo)}&select=id&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    const existing = dedupRes.ok ? await dedupRes.json() : [];
    if (existing.length > 0) {
      return res.status(200).json({ ok: true, deduped: true });
    }

    // 2. Insert access request
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/bhr_access_requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ email, domain })
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      return res.status(500).json({ error: 'Failed to log request', detail: err });
    }

    // 3. Send notification email to admin
    let emailSent = false;
    if (SENDGRID_API_KEY) {
      const emailBody = {
        personalizations: [{
          to: [{ email: ADMIN_EMAIL, name: 'Steve Evans' }]
        }],
        from: { email: FROM_EMAIL, name: 'credit-hire.ai' },
        subject: `BHR Access Request — ${domain}`,
        content: [{
          type: 'text/html',
          value: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
              <div style="background:#1a2332;padding:20px 24px;border-radius:8px 8px 0 0;">
                <span style="font-family:Georgia,serif;font-size:1.4rem;color:#fff;">credit-hire</span><span style="color:#c9a84c;font-family:Georgia,serif;font-size:1.4rem;">.ai</span>
              </div>
              <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
                <p style="margin:0 0 16px;font-size:1.05rem;font-weight:700;color:#1a2332;">New BHR Access Request</p>
                <div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:16px;margin:0 0 16px;border-radius:0 6px 6px 0;">
                  <p style="margin:0 0 8px;"><strong>Email:</strong> ${email}</p>
                  <p style="margin:0 0 8px;"><strong>Domain:</strong> ${domain}</p>
                  <p style="margin:0;font-size:0.85rem;color:#666;">Requested: ${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/London' })}</p>
                </div>
                <p style="margin:0 0 12px;">A user from <strong>${domain}</strong> attempted to access the BHR Rebuttal tool but their domain is not yet approved.</p>
                <p style="margin:0;">
                  <a href="https://www.credit-hire.ai/admin" style="display:inline-block;background:#1a2332;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Review in Admin Panel</a>
                </p>
              </div>
              <p style="font-size:0.75rem;color:#999;text-align:center;margin-top:12px;">
                You will not receive another notification for this email address within 7 days.
              </p>
            </div>
          `
        }]
      };

      try {
        const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SENDGRID_API_KEY}`
          },
          body: JSON.stringify(emailBody)
        });
        emailSent = sgRes.ok || sgRes.status === 202;
      } catch (e) {
        console.error('SendGrid admin notification error:', e.message);
      }

      // 4. Send courtesy reply to the user
      const userReply = {
        personalizations: [{
          to: [{ email }]
        }],
        from: { email: FROM_EMAIL, name: 'Steve Evans — credit-hire.ai' },
        reply_to: { email: ADMIN_EMAIL, name: 'Steve Evans' },
        subject: 'BHR Rebuttal Module — Access Request Received',
        content: [{
          type: 'text/html',
          value: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
              <div style="background:#1a2332;padding:20px 24px;border-radius:8px 8px 0 0;">
                <span style="font-family:Georgia,serif;font-size:1.4rem;color:#fff;">credit-hire</span><span style="color:#c9a84c;font-family:Georgia,serif;font-size:1.4rem;">.ai</span>
              </div>
              <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
                <p style="margin:0 0 16px;">Thank you for your interest in the BHR Rebuttal programme.</p>
                <p style="margin:0 0 16px;">I am afraid that this is not yet available to you until your company:</p>
                <ol style="margin:0 0 16px;padding-left:24px;">
                  <li style="margin-bottom:8px;">Identifies a <strong>BHR Champion</strong></li>
                  <li>Arranges for <strong>staff training</strong> on the module</li>
                </ol>
                <p style="margin:0 0 16px;">As soon as those steps are completed you can have access to the system.</p>
                <p style="margin:0 0 4px;">Steve</p>
                <p style="margin:0;font-size:0.85rem;color:#666;">Steve Evans — credit-hire.ai</p>
              </div>
            </div>
          `
        }]
      };

      try {
        await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SENDGRID_API_KEY}`
          },
          body: JSON.stringify(userReply)
        });
      } catch (e) {
        console.error('SendGrid user reply error:', e.message);
      }
    }

    return res.status(200).json({ ok: true, email_sent: emailSent });

  } catch (e) {
    console.error('Access request error:', e);
    return res.status(500).json({ error: e.message });
  }
}

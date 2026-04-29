// /api/capture-email.js
// Captures abandoned-paywall emails to Mailchimp

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, contractPreview } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX; // e.g. "us21"

  // If Mailchimp not configured, just log and return success
  // (so the user-facing flow still works during dev)
  if (!apiKey || !audienceId || !serverPrefix) {
    console.log('Email captured (Mailchimp not configured):', email);
    return res.status(200).json({ ok: true, stored: 'log-only' });
  }

  try {
    const response = await fetch(
      `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${audienceId}/members`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `apikey ${apiKey}`
        },
        body: JSON.stringify({
          email_address: email,
          status: 'subscribed',
          tags: ['abandoned-analysis'],
          merge_fields: {
            CONTRACT: contractPreview ? contractPreview.slice(0, 100) : ''
          }
        })
      }
    );

    if (!response.ok && response.status !== 400) {
      // 400 usually means already subscribed - that's fine
      const errText = await response.text();
      console.error('Mailchimp error:', errText);
      return res.status(500).json({ error: 'Could not save email' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Capture error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// /api/analyze.js
// Vercel serverless function — keeps your API key hidden

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contractText } = req.body || {};
  if (!contractText || typeof contractText !== 'string') {
    return res.status(400).json({ error: 'Missing contract text' });
  }

  if (contractText.length < 100) {
    return res.status(400).json({ error: 'Contract text too short' });
  }

  const systemPrompt = `You are a sharp, experienced contract attorney explaining documents to a non-lawyer client. 
You are direct, clear, and protective of your client's interests.
You MUST respond with valid JSON only — no markdown, no backticks, no preamble.

Return this exact JSON structure:
{
  "summary": "2-3 sentence plain English summary of what this contract is and what it does",
  "red_flags": [{"text": "description of concerning clause"}],
  "yellow_flags": [{"text": "description of unusual or one-sided clause"}],
  "green_flags": [{"text": "description of protective or favorable clause"}],
  "pushback": ["Specific thing to negotiate or push back on"],
  "verdict": "One sentence honest verdict — should they sign, negotiate, or walk away?"
}

red_flags: clauses that are genuinely harmful, predatory, or legally risky
yellow_flags: clauses that are unusual, one-sided, or worth questioning
green_flags: clauses that protect the signer or are fair
pushback: 3-5 specific, actionable negotiation points
verdict: honest, direct, no hedging

If the input is not a contract or legal document, return: {"error": "This doesn't appear to be a contract or legal document."}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Analyze this contract:\n\n${contractText.slice(0, 12000)}` }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(500).json({ error: 'Analysis service unavailable' });
    }

    const data = await response.json();
    const result = data.content?.[0]?.text || '';
    return res.status(200).json({ result });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

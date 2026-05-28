// LeaseLoft API server — port 3002
// Handles the maintenance-chat endpoint, proxying to Anthropic Claude.

import express from 'express';
import cors    from 'cors';

const app  = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// ── System prompt factory ─────────────────────────────────────────────────────
function systemPrompt(title) {
  return `\
You are a friendly maintenance coordinator helping a tenant describe their issue so a contractor can quote and fix it efficiently.

The tenant reported: "${title}"

Your job:
1. Ask ONE short, conversational question at a time — never multiple questions in one message.
2. Tailor your questions to the issue type:

   PLUMBING (faucet, pipe, toilet, drain, sink, water, leak):
   → Which fixture/location? | How long? | Constant or intermittent? | Visible water damage? | Emergency (water shut-off needed)?

   ELECTRICAL (outlet, switch, light, breaker, panel, power):
   → Which room/fixture? | Any burning smell or sparks? | Breaker tripping? | Complete outage or intermittent? | Safety concern?

   HVAC (heat, AC, air, furnace, cooling, thermostat):
   → Heating or cooling? | How long without it? | Current indoor temp? | Any strange noises or smells?

   APPLIANCE (dishwasher, stove, oven, fridge, washer, dryer):
   → Which appliance? | Brand/model if known? | Error message shown? | Still partially working?

   STRUCTURAL (door, window, ceiling, wall, floor, roof):
   → Which room and exact location? | Any water involved? | Safety/security risk?

   PEST (bug, insect, rodent, mouse, roach, ant):
   → What type? | Where in the unit? | How long? | Severity (a few vs. many)?

   GENERAL: → Exact location in unit? | How long? | Safety concern? | Getting worse?

3. After the tenant has answered 3–4 questions, end with a short bridge sentence then exactly:
   ---SUMMARY---
   [Write a 3–5 sentence work-order description for a contractor. Include: what's broken, exact location, how long, urgency level, and any specific details the tenant mentioned. Professional tone. No tenant name.]

Keep every message brief and warm. Do not ask for information already given.`;
}

// ── POST /api/maintenance-chat ────────────────────────────────────────────────
app.post('/api/maintenance-chat', async (req, res) => {
  try {
    const { title, messages } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set on server');

    // Seed with a silent user turn so the assistant speaks first
    const history = (!messages || messages.length === 0)
      ? [{ role: 'user', content: `I need to report an issue: ${title}` }]
      : messages;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',
        max_tokens: 450,
        system:     systemPrompt(title),
        messages:   history,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';
    res.json({ message: text });

  } catch (err) {
    console.error('[maintenance-chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`LeaseLoft API running on port ${PORT}`));

// supabase/functions/maintenance-chat/index.ts
// Drives a contextual chat session to gather maintenance issue details.
// Called by the tenant Maintenance page; returns Claude's next question or
// a final ---SUMMARY--- block when enough detail has been collected.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = (title: string) => `\
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

Keep every message brief and warm. Do not ask for information already given.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { title, messages } = await req.json() as {
      title: string
      messages: { role: 'user' | 'assistant'; content: string }[]
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

    // Seed with a silent user turn so the assistant speaks first
    const history = messages.length === 0
      ? [{ role: 'user' as const, content: `I need to report an issue: ${title}` }]
      : messages

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
        system:     SYSTEM_PROMPT(title),
        messages:   history,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    const text: string = data.content?.[0]?.text ?? ''

    return new Response(JSON.stringify({ message: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[maintenance-chat]', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

// CORS: allow your local dev and your domain (add more origins if needed)
const ALLOWED = [
  'http://localhost:3000',
  'https://mbaza-ai.site'
];
app.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED.includes(origin)) return cb(null, true);
    cb(null, true); // relax during rollout; tighten later
  }
}));

app.use(express.json({ limit: '1mb' }));

// env
const PORT = process.env.PORT || 8080;
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const TAVILY_KEY = process.env.TAVILY_API_KEY || ''; // optional

// sanity logs
console.log('[boot] PORT=', PORT);
console.log('[boot] GROQ key set=', GROQ_KEY ? 'yes' : 'no');
console.log('[boot] Tavily key set=', TAVILY_KEY ? 'yes' : 'no');

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Mbaza AI backend running',
    providers: { groq: !!GROQ_KEY, tavily: !!TAVILY_KEY },
    model: 'llama-3.3-70b-versatile',
    timestamp: new Date().toISOString()
  });
});

// optional web search via Tavily
async function webSearch(query) {
  if (!TAVILY_KEY) return [];
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TAVILY_KEY}` },
      body: JSON.stringify({ query, search_depth: 'advanced', include_domains: [], max_results: 5 })
    });
    const j = await r.json();
    return (j.results || []).map(x => ({ title: x.title, url: x.url, snippet: x.snippet }));
  } catch {
    return [];
  }
}

// tiny prompt guard for “speak good Kinyarwanda”
const SYSTEM_RW = `Uri "Mbaza AI", umujyanama w'ubuzima uvuga Kinyarwanda kinyamwuga kandi gisobanutse.
- Wirinde amagambo y'icyongereza/Suahili atari ngombwa.
- Subiza mu buryo burimo ibisobanuro, intambwe, ingamba z'ubutabazi bwihuse nibiba bikenewe, n’amabwiriza yo kujya kwa muganga.
- Niba ikibazo kijyanye n’ubuzima, shapira imvugo y'ubujyanama; niba kijyanye n’ubundi bumenyi, jya usubiza mu Kinyarwanda gisanzwe, ukosore imvugo idahwitse.`;

async function callGroq(messages) {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY missing');
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1200,
      messages
    })
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Groq HTTP ${r.status}: ${t}`);
  }
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content || '';
  return content.trim();
}

app.post('/api/chat', async (req, res) => {
  const userMsg = (req.body?.message || '').toString().trim();
  if (!userMsg) return res.status(400).json({ error: 'message required' });

  try {
    // optional browse first
    let sources = [];
    if (TAVILY_KEY && /shakisha|internet|amakuru|seriveri|google|shakisha kuri interinet/i.test(userMsg)) {
      sources = await webSearch(userMsg);
    }

    const systemMsg = { role: 'system', content: SYSTEM_RW };
    const userContent = [
      sources.length
        ? `Inkomoko zashakiwe kuri internet:\n${sources.map((s,i)=>`${i+1}. ${s.title} — ${s.url}`).join('\n')}\n\nSobanura mu Kinyarwanda:`
        : '',
      userMsg
    ].join('\n');

    const reply = await callGroq([
      systemMsg,
      { role: 'user', content: userContent }
    ]);

    res.json({
      ok: true,
      reply,
      sources,
      meta: {
        model: process.env.HIDE_MODEL_NAME === '1' ? undefined : (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
        ts: Date.now()
      }
    });
  } catch (err) {
    console.error('chat error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`[server] listening on :${PORT}`);
});

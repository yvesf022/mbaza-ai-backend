// index.js  — Mbaza AI Backend (Render-ready, Kinyarwanda-focused)
// Node 18+ / ESM

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---------------------- ENV & CONSTANTS ----------------------

const PORT = process.env.PORT || 8080;

// LLM provider (Groq)
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Optional browsing (Tavily)
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";

// RW controls
const FORCE_KINYARWANDA = (process.env.FORCE_KINYARWANDA || "true").toLowerCase() === "true";
const RW_POLISH = (process.env.RW_POLISH || "true").toLowerCase() === "true";
const RW_TONE = process.env.RW_TONE || "umujyanama w'ubuzima";
const RW_DOMAIN = process.env.RW_DOMAIN || "ubuvuzi, amategeko, kwiga";
const GLOSSARY_JSON = process.env.RW_GLOSSARY_JSON || "{}";

// Parsed glossary
let GLOSSARY = {};
try { GLOSSARY = JSON.parse(GLOSSARY_JSON); } catch { GLOSSARY = {}; }

// Utility: tiny replacer from glossary
function applyGlossary(text) {
  if (!text) return text;
  let out = text;
  for (const [bad, good] of Object.entries(GLOSSARY)) {
    const re = new RegExp(`\\b${escapeRegExp(bad)}\\b`, "gi");
    out = out.replace(re, good);
  }
  return out;
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------- PROMPTS ----------------------

const SYSTEM_PROMPT = `
Uri ${FORCE_KINYARWANDA ? "kwandika mu Kinyarwanda gusa" : "kwandika mu Kinyarwanda"} kandi ufite imvugo y’${RW_TONE}.
Inshingano:
1) Subiza mu Kinyarwanda gisobanutse, gisukuye, kandi cyoroheye umusomyi.
2) Irinde kuvanga Icyongereza/Ciswahili n’Ikinyarwanda; niba ubonye inyito z’amahanga, uzisobanure mu Kinyarwanda.
3) Ukoreshe imiterere ifatika: 
   - Ibisobanuro/umwimerere
   - Ibimenyetso/ibimenyetso by’ingenzi
   - Iby’ingenzi wakora ubu
   - Igihe cyo gushaka ubutabazi bwihuse
   - Uko wabyirinda/kugenzura
4) Niba ikibazo kijyanye n’“${RW_DOMAIN}”, ushyiremo inama zifatika, ariko usobanure ko utari usimbura muganga cyangwa umunyamategeko.
5) Niba hari ingingo idasobanutse, saba amakuru y’inyongera mu Kinyarwanda.
6) Witondere imvugo y’ihungabana; jya utuza kandi ufate umwanya wo gusobanura.
7) Ntukavuge izina rya model cyangwa API. 
`.trim();

const POLISH_PROMPT = `
Subiza uri umusesenguzi w’Ikinyarwanda: ongera usukure, usobanuze, kandi uhindure igisubizo gikurikira mu Kinyarwanda cyiza.
- Ntukoreshe Icyongereza/Ciswahili uretse inyito zikomeye, hanyuma uzisobanure mu Kinyarwanda.
- Gumana umutuzo w’umujyanama w’ubuzima; tangira n’igisobanuro gito, ukurikizeho iby’ingenzi wakora nonaha, ibimenyetso bikomeye (red flags), hanyuma inama zo kwirinda.
- Ntugaragaze izina rya model cyangwa API.
- Garura igisubizo mu nyandiko yonyine, nta yindi nsobanuro.
Igisubizo gikosorwa:
`.trim();

// ---------------------- GROQ CLIENT ----------------------

async function groqChat(messages, temperature = 0.2, maxTokens = 1200) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY missing");
  }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature,
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Groq HTTP ${res.status}: ${txt}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ---------------------- BROWSING (OPTIONAL) ----------------------

async function tavilySearch(query) {
  if (!TAVILY_API_KEY) return [];
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TAVILY_API_KEY}` },
    body: JSON.stringify({
      query,
      max_results: 5,
      include_answer: false,
      include_domains: [],
      search_depth: "basic",
    }),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const items = data.results || [];
  // keep only minimal fields
  return items.map(x => ({
    title: x.title,
    url: x.url,
    snippet: (x.content || "").slice(0, 800)
  }));
}

async function summarizeSourcesKinyarwanda(query, sources) {
  if (!sources?.length) return "";
  const srcText = sources.map((s, i) => `(${i + 1}) ${s.title}\n${s.snippet}\nURL: ${s.url}`).join("\n\n");
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `
Sobanura mu Kinyarwanda amakuru akwiye kuri "${query}" hifashishijwe uduce dukurikira twaturutse kuri interineti:

${srcText}

- Tanga incamake yanditse neza mu Kinyarwanda.
- Shyiramo ingingo ngufi zikoze neza.
- Niba ari ubuvuzi, tangira n’icyo ari cyo, ibimenyetso, ibyo wakora nonaha, ibimenyetso bikomeye, n’inama zo kwirinda.
- Nta mvange y’indimi; ukoreshe Ikinyarwanda.
` }
  ];
  return groqChat(messages, 0.2, 900);
}

// ---------------------- ROUTES ----------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "Mbaza AI backend running",
    providers: {
      groq: !!GROQ_API_KEY,
      tavily: !!TAVILY_API_KEY
    },
    model: GROQ_MODEL,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, browse } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message (string) required" });
    }

    // Optional browsing
    let browseNote = "";
    if (browse && TAVILY_API_KEY) {
      const sources = await tavilySearch(message);
      const summary = await summarizeSourcesKinyarwanda(message, sources);
      if (summary) {
        browseNote = `\n\n[Incamake ishingiye ku byo nshakishije kuri interineti]\n${summary}\n`;
      }
    }

    // First pass answer (strict system)
    const first = await groqChat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${message}\n${browseNote}` }
    ], 0.2, 1000);

    // Glossary + optional second pass polish
    const cleaned = applyGlossary(first);
    let finalText = cleaned;

    if (RW_POLISH) {
      const polished = await groqChat([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${POLISH_PROMPT}\n\n${cleaned}` }
      ], 0.2, 900);
      finalText = applyGlossary(polished || cleaned);
    }

    // Safety: force Kinyarwanda note if we detect heavy English
    if (FORCE_KINYARWANDA) {
      const latinWords = (finalText.match(/[a-zA-Z]+/g) || []).length;
      const rwMarkers = (finalText.match(/[’'’]|\bumu|\bibi|\bku|\bni\b|\bna\b/g) || []).length;
      if (latinWords > 40 && rwMarkers < 5) {
        finalText = "Ndakumva. Reka mbisubize mu Kinyarwanda gisobanutse: \n\n" + finalText;
      }
    }

    res.json({
      id: cryptoRandom(),
      reply: finalText,
      meta: {
        model: GROQ_MODEL,
        polish: RW_POLISH,
        forced_rw: FORCE_KINYARWANDA
      }
    });

  } catch (err) {
    console.error("chat error:", err?.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------- UTILS & START ----------------------

function cryptoRandom() {
  return "mbz_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

app.listen(PORT, () => {
  console.log(`[server] Mbaza AI backend on :${PORT}  Powered by Umuvuduko 2.5`);
  console.log(`[boot]  GROQ key set: ${GROQ_API_KEY ? "yes" : "no"}`);
  console.log(`[boot]  Tavily key set: ${TAVILY_API_KEY ? "yes" : "no"}`);
});

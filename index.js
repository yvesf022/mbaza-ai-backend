// index.js  — Mbaza AI backend with Groq -> Translate(rw)
// Node 18+ (global fetch). "type":"module" in package.json.

import express from "express";
import cors from "cors";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: "*" }));

// ------------------- ENV -------------------
const PORT = process.env.PORT || 8080;

// LLM (Groq)
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Translation
// Choose provider by setting TRANSLATE_PROVIDER = "google" or "libre"
const TRANSLATE_PROVIDER = (process.env.TRANSLATE_PROVIDER || "google").toLowerCase();

// Google Translate v2
const GOOGLE_TRANSLATE_KEY = process.env.GOOGLE_TRANSLATE_KEY || "";

// LibreTranslate (self-host or public endpoint)
const LIBRE_URL = process.env.LIBRE_URL || "https://libretranslate.com/translate";

// Target language for final answer
const TARGET_LANG = "rw"; // Kinyarwanda

// ------------------- HELPERS -------------------
const sysPromptEnglish =
  `You are Mbaza AI, a helpful assistant. 
   Reply ONLY in **English** with clear, structured, short paragraphs and bullet points when helpful.
   Avoid code blocks and emojis. Write concise, factual, safe answers.`;

/**
 * Call Groq chat completion to get an English answer.
 */
async function callGroqEnglish(userMessage) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const body = {
    model: GROQ_MODEL,
    temperature: 0.3,
    max_tokens: 800,
    messages: [
      { role: "system", content: sysPromptEnglish },
      { role: "user", content: userMessage }
    ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Groq HTTP ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Groq returned empty content");
  return content;
}

/**
 * Translate text to Kinyarwanda (rw) using Google (preferred) or LibreTranslate.
 */
async function translateToRW(text) {
  // Already Kinyarwanda? If you want, add a heuristic language detector here.
  if (!text || text.length < 2) return text;

  if (TRANSLATE_PROVIDER === "google" && GOOGLE_TRANSLATE_KEY) {
    // Google v2 REST
    const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_KEY}`;
    const body = { q: text, target: TARGET_LANG, format: "text" };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Google Translate HTTP ${res.status}: ${t}`);
    }

    const data = await res.json();
    const translated = data?.data?.translations?.[0]?.translatedText;
    return translated || text;
  }

  // Fallback: LibreTranslate
  const libreRes = await fetch(LIBRE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: "auto",
      target: TARGET_LANG,
      format: "text"
    })
  });

  if (!libreRes.ok) {
    const t = await libreRes.text().catch(() => "");
    throw new Error(`LibreTranslate HTTP ${libreRes.status}: ${t}`);
  }

  const libreData = await libreRes.json();
  return libreData?.translatedText || text;
}

// Optionally enforce final cleanup (replace stray English/Swa tokens)
function cleanupKinyarwanda(s) {
  if (!s) return s;
  const blacklist = [
    /\b(okay|ok|hello|thanks|sorry|please)\b/gi,
    /\b(sawa|tafadhali|asante)\b/gi
  ];
  let out = s;
  blacklist.forEach(rx => { out = out.replace(rx, ""); });
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

// ------------------- ROUTES -------------------
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "Mbaza AI backend running",
    providers: {
      groq: Boolean(GROQ_API_KEY),
      translate: TRANSLATE_PROVIDER,
      googleKey: Boolean(GOOGLE_TRANSLATE_KEY)
    },
    model: GROQ_MODEL,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = (req.body?.message || "").toString().trim();
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY missing" });
    }

    // 1) Ask Groq in English
    const english = await callGroqEnglish(message);

    // 2) Translate to Kinyarwanda (rw)
    let rw = english;
    try {
      rw = await translateToRW(english);
      rw = cleanupKinyarwanda(rw);
    } catch (e) {
      // If translation fails, still return English as fallback
      rw = english;
      console.error("Translate error:", e.message);
    }

    res.json({
      ok: true,
      provider: "groq+translate",
      lang: "rw",
      text: rw,
      meta: { english }
    });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------- START -------------------
app.listen(PORT, () => {
  console.log(`[server] Mbaza AI on :${PORT}  (translate=${TRANSLATE_PROVIDER})`);
});

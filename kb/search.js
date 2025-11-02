// kb/search.js
const fs = require('fs');
const path = require('path');

const KB_PATH = path.join(__dirname, 'index.json');

function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function loadKB() {
  if (!fs.existsSync(KB_PATH)) {
    throw new Error(`KB not found: ${KB_PATH} (run: npm run kb:build)`);
  }
  const raw = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
  return raw;
}

function cosine(a, b) {
  // a, b are maps term -> weight
  let dot = 0, na = 0, nb = 0;
  for (const k in a) {
    na += a[k] * a[k];
    if (b[k]) dot += a[k] * b[k];
  }
  for (const k in b) nb += b[k] * b[k];
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function buildQueryVec(qTokens, df, totalDocs) {
  const tf = {};
  qTokens.forEach(t => tf[t] = (tf[t] || 0) + 1);
  const vec = {};
  for (const t in tf) {
    const idf = Math.log((1 + totalDocs) / (1 + (df[t] || 0))) + 1;
    vec[t] = tf[t] * idf;
  }
  return vec;
}

function buildDocVec(tf, df, totalDocs) {
  const vec = {};
  for (const t in tf) {
    const idf = Math.log((1 + totalDocs) / (1 + (df[t] || 0))) + 1;
    vec[t] = tf[t] * idf;
  }
  return vec;
}

function retrieve(query, kb, topK = 6) {
  const qTok = tokenize(query);
  const qVec = buildQueryVec(qTok, kb.df, kb.chunks.length);
  const scored = kb.chunks.map(ch => {
    const dVec = buildDocVec(ch.tf, kb.df, kb.chunks.length);
    const score = cosine(qVec, dVec);
    return { score, chapter: ch.chapter, text: ch.text };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter(s => s.score > 0);
}

module.exports = { loadKB, retrieve };

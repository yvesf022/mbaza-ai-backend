// server/kb/build.js
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const KB_DIR = path.join(ROOT, 'kb');
const CH_DIR = path.join(KB_DIR, 'chapters');
const OUT = path.join(KB_DIR, 'index.json');

function ensureDirs() {
  if (!fs.existsSync(KB_DIR)) fs.mkdirSync(KB_DIR, { recursive: true });
  if (!fs.existsSync(CH_DIR)) fs.mkdirSync(CH_DIR, { recursive: true });
}

function readChapters() {
  if (!fs.existsSync(CH_DIR)) return [];
  const files = fs.readdirSync(CH_DIR).filter(f => /\.(txt|md|json)$/i.test(f));
  const items = [];
  for (const f of files) {
    const fp = path.join(CH_DIR, f);
    const raw = fs.readFileSync(fp, 'utf8');
    const input = `Urusobanuro rwasomwe muri ${f}`;
    const output = raw.trim();
    items.push({ id: f, input, output });
  }
  return items;
}

function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function build() {
  ensureDirs();
  let items = readChapters();

  // If no chapters yet, create minimal seed so retrieval is optional
  if (!items.length) {
    items = [
      {
        id: 'seed',
        input: 'Ukoresheje amagambo asobanutse mu Kinyarwanda',
        output: 'Ibi ni ibirimo bituma dushyiraho KB itangirika.',
      }
    ];
  }

  // add tokens
  items = items.map(x => ({ ...x, tokens: tokenize(`${x.input} ${x.output}`) }));

  const out = { items, built_at: new Date().toISOString() };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log(`[kb] Wrote ${items.length} items -> ${OUT}`);
}

build();

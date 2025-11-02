import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import translate from '@vitalets/google-translate-api';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Mbaza AI backend is running');
});

app.get('/translate', async (req, res) => {
  const { text, lang } = req.query;

  if (!text || !lang) {
    return res.status(400).json({ error: 'Missing text or lang query parameter' });
  }

  try {
    const result = await translate(text, { to: lang });
    res.json({ translated: result.text });
  } catch (error) {
    console.error('TRANSLATION / LLM ERROR:', error);
    res.status(500).json({ error: 'Translation failed', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend running on port ${port}`);
});

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

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.get('/translate', async (req, res) => {
  const { text } = req.query;

  if (!text) {
    return res.status(400).json({ error: 'Missing text query parameter' });
  }

  try {
    // Step 1: Translate Kinyarwanda → English
    const toEnglish = await translate(text, { to: 'en' });
    const englishInput = toEnglish.text;

    // Step 2: Ask Groq
    const groqResponse = await groq.chat.completions.create({
      messages: [{ role: 'user', content: englishInput }],
      model: 'mixtral-8x7b-32768'
    });

    const englishAnswer = groqResponse.choices?.[0]?.message?.content?.trim();
    if (!englishAnswer) {
      return res.json({ translated: 'Ndababariwe, sinabonye igisubizo cyiza.' });
    }

    // Step 3: Translate Groq answer → Kinyarwanda
    const toKinyarwanda = await translate(englishAnswer, { to: 'rw' });
    const finalAnswer = toKinyarwanda.text?.trim();

    if (!finalAnswer) {
      return res.json({ translated: 'Igisubizo cyabonetse ariko nticyashoboye guhindurwa.' });
    }

    // Step 4: Return final answer
    res.json({ translated: finalAnswer });

  } catch (error) {
    console.error('TRANSLATION / LLM ERROR:', error);
    res.status(500).json({ translated: 'Habaye ikosa. Ongera ugerageze.' });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend running on port ${port}`);
});

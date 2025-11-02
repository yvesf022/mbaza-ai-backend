import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import translate from '@vitalets/google-translate-api';
import Groq from 'groq-sdk';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.get('/translate', async (req, res) => {
  const { text, useWebSearch } = req.query;

  if (!text) {
    return res.status(400).json({ error: 'Missing text query parameter' });
  }

  try {
    console.log("🔹 Original Kinyarwanda:", text);

    // Step 1: Translate Kinyarwanda → English
    const toEnglish = await translate(text, { to: 'en' });
    const englishInput = toEnglish.text;
    console.log("🔹 English input:", englishInput);

    let context = '';

    // Step 2: Optional Tavily web search
    if (useWebSearch === 'true') {
      console.log("🔹 Performing Tavily web search...");
      const tavilyRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
        },
        body: JSON.stringify({
          query: englishInput,
          search_depth: 'advanced',
          include_answer: false
        })
      });

      const tavilyData = await tavilyRes.json();
      context = tavilyData?.results?.map(r => r.content).join('\n\n') || '';
      console.log("🔹 Tavily context:", context);
    }

    // Step 3: Ask Groq with optional context
    const groqResponse = await groq.chat.completions.create({
      messages: [
        ...(context ? [{ role: 'system', content: `Use this context:\n${context}` }] : []),
        { role: 'user', content: englishInput }
      ],
      model: 'mixtral-8x7b-32768'
    });

    const englishAnswer = groqResponse.choices?.[0]?.message?.content?.trim();
    console.log("🔹 Groq answer:", englishAnswer);

    if (!englishAnswer) {
      return res.json({ translated: 'Ndababariwe, sinabonye igisubizo cyiza.' });
    }

    // Step 4: Translate Groq answer → Kinyarwanda
    const toKinyarwanda = await translate(englishAnswer, { to: 'rw' });
    const finalAnswer = toKinyarwanda.text?.trim();
    console.log("🔹 Final Kinyarwanda:", finalAnswer);

    if (!finalAnswer) {
      return res.json({ translated: 'Igisubizo cyabonetse ariko nticyashoboye guhindurwa.' });
    }

    res.json({ translated: finalAnswer });

  } catch (error) {
    console.error('❌ ERROR:', error);
    res.status(500).json({ translated: 'Habaye ikosa. Ongera ugerageze.' });
  }
});

app.listen(port, () => {
  console.log(`✅ Mbaza AI backend running on port ${port}`);
});

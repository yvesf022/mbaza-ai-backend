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

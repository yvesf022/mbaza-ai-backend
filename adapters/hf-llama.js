// server/adapters/hf-llama.js
// Adapter for Hugging Face Inference API (text generation).
// Works with HF hosted models (Llama-3, Mistral, Falcon if available on HF).
// Requires HUGGING_FACE_API_KEY and HUGGING_FACE_MODEL set in .env

const axios = require('axios');

async function send(messages = [], { options = {}, env = process.env } = {}) {
  const HF_KEY = env.HUGGING_FACE_API_KEY;
  const MODEL = options.model || env.HUGGING_FACE_MODEL || 'meta-llama/Llama-3-7b-instruct';

  if (!HF_KEY) {
    return { text: '[Hugging Face API key not configured on server (.env HUGGING_FACE_API_KEY)]', sources: [] };
  }

  // Build a single prompt from messages.
  // This simple join keeps conversation context. You may want to convert to provider chat format.
  const prompt = messages.map(m => {
    const role = m.role || 'user';
    const prefix = role === 'system' ? 'System:' : role === 'assistant' ? 'Assistant:' : 'User:';
    return `${prefix} ${m.text}`;
  }).join('\n') + '\nAssistant:';

  try {
    const url = `https://api-inference.huggingface.co/models/${MODEL}`;
    const payload = {
      inputs: prompt,
      parameters: {
        max_new_tokens: options.max_tokens || 512,
        temperature: options.temperature ?? 0.2,
        top_k: options.top_k ?? 50,
        top_p: options.top_p ?? 0.95,
        repetition_penalty: options.repetition_penalty ?? 1.0
      }
    };

    const resp = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${HF_KEY}`, 'Content-Type': 'application/json' },
      timeout: 120000
    });

    // Parse response (HF inference may return different shapes)
    let text = '';

    if (!resp || !resp.data) {
      text = '[No response from Hugging Face]';
    } else if (typeof resp.data === 'string') {
      text = resp.data;
    } else if (Array.isArray(resp.data) && resp.data[0] && typeof resp.data[0].generated_text === 'string') {
      text = resp.data[0].generated_text;
    } else if (resp.data.generated_text) {
      text = resp.data.generated_text;
    } else {
      // fallback stringify
      text = JSON.stringify(resp.data).slice(0, 4000);
    }

    // Basic minimal post-processing: remove repeated prompt echoed
    if (text.startsWith(prompt)) {
      text = text.slice(prompt.length).trim();
    }

    return { text, sources: [] };
  } catch (err) {
    console.error('hf-llama adapter error:', err?.response?.data || err.message || err);
    const message = err?.response?.data ? JSON.stringify(err.response.data).slice(0, 1000) : (err.message || String(err));
    return { text: `[HuggingFace adapter error] ${message}`, sources: [] };
  }
}

module.exports = { send };

// server/adapters/llama2-example.js
const axios = require('axios');

async function send(messages, { options = {}, env = process.env } = {}) {
  // Example: call a Hugging Face text generation endpoint (or any Llama provider)
  // Requirements: set HUGGING_FACE_API_KEY in .env and HUGGING_FACE_MODEL (api model id)
  const HF_KEY = env.HUGGING_FACE_API_KEY;
  const MODEL = env.HUGGING_FACE_MODEL || 'meta-llama/Llama-3-7b-instruct'; // replace as needed

  if (!HF_KEY) {
    return { text: '[HuggingFace API key not set in server .env]', sources: [] };
  }

  // Convert our messages into a single prompt (simple approach)
  const prompt = messages.map(m => (m.role === 'user' ? `User: ${m.text}` : (m.role === 'assistant' ? `Assistant: ${m.text}` : `System: ${m.text}`))).join('\n') + '\nAssistant:';

  try {
    const url = `https://api-inference.huggingface.co/models/${MODEL}`;
    const resp = await axios.post(url, { inputs: prompt, parameters: { max_new_tokens: 512 } }, {
      headers: { Authorization: `Bearer ${HF_KEY}` },
      timeout: 120000
    });

    // HF inference returns different formats — adapt accordingly
    // This example assumes resp.data is { generated_text: "..." } or array.
    let text = '';
    if (resp.data && typeof resp.data === 'object') {
      if (resp.data.generated_text) text = resp.data.generated_text;
      else if (Array.isArray(resp.data) && resp.data[0] && resp.data[0].generated_text) text = resp.data[0].generated_text;
      else text = JSON.stringify(resp.data).slice(0, 2000);
    } else {
      text = String(resp.data || '');
    }

    return { text: text, sources: [] };
  } catch (err) {
    console.error('llama2-example adapter error', err?.response?.data || err.message);
    return { text: `[Adapter error] ${err?.response?.data ? JSON.stringify(err.response.data) : err.message}`, sources: [] };
  }
}

module.exports = { send };

// server/adapters/provider-template.js
/**
 * Template adapter for a provider.
 * Implement provider-specific HTTP calls here.
 *
 * Export: async function send(messages, { options, env }) => { text, sources?: [] }
 *
 * messages: array of { role, text } like ChatML
 *
 * IMPORTANT:
 * - Use env to read API keys (do not hardcode).
 * - Respect provider API docs for rate / streaming / chunking.
 */

const axios = require('axios');

module.exports.send = async function send(messages, { options = {}, env = process.env } = {}) {
  // Example structure only -- replace with provider-specific code.
  // const API_KEY = env.MY_PROVIDER_KEY;
  // const url = 'https://api.provider.example/v1/generate';

  // Convert messages to provider format:
  // const payload = { ... };

  // const resp = await axios.post(url, payload, { headers: { Authorization: `Bearer ${API_KEY}` }});
  // return { text: resp.data.output_text, sources: resp.data.sources || [] };

  // Fallback stub for development:
  return { text: "Adapter not implemented yet. Replace provider-template with a real adapter.", sources: [] };
};

Adapters folder
---------------

Each adapter must export an async function: send(messages, { options, env }).

- messages is an array [{role, text}, ...]
- options is optional provider-specific options
- env is process.env for the adapter to read keys

To add a provider:
- Duplicate provider-template.js -> provider-name.js
- Implement provider-specific HTTP call and result parsing
- Add to server/index.js adapters map: adapters['providerKey'] = require('./provider-name')

Model keys:
Use small keys (e.g. llama3, gemini, mistral7b, falcon180b, qwen3, gemma2, stablelm2, vicuna33b, gptneox, bloom, commandr, jamba, dbrx, phi3, groq, together, botpress)

When adding adapter, restart server.

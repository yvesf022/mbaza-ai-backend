Run locally (development)
-------------------------
1. cd server
2. copy .env.example -> .env and fill API keys you intend to use
3. npm install
4. npm run dev
5. Server runs on PORT (default 8080)
6. From your React app (client) set proxy or FRONTEND_ORIGIN to http://localhost:3000

How front-end calls server
--------------------------
POST /api/chat
Body JSON:
{
  "model": "llama3",
  "messages": [
     {"role":"system", "text":"..."},
     {"role":"user", "text":"..."}
  ],
  "options": { ...optional provider-specific options... }
}

Response:
{ ok: true, model: "llama3", result: { text: "...", sources: [...] } }

Deploy
------
- Render / Railway / Fly / DigitalOcean App: create a Node web service, point to this repo/server, set env vars.
- If serving static client from same host, set SERVE_STATIC=1 and place client/build next to server.

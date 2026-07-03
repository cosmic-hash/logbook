# Logbook (EdgeOne Makers)

Conversational task tracker with real login: paste or talk, AI extracts
tasks/deadlines into categorized groups (Events, Work, Personal, School, Inbox).

## Quick start (local)

```bash
npm run dev
```

Open **http://localhost:8088**

1. Create an account (email + password, min 8 chars)
2. Type or paste a task — e.g. *"planning to attend a tencent mini hackathon on july 3rd"*
3. Tasks appear grouped by category; click to edit notes, dot to mark done

Local extraction works without any API keys. For smarter parsing of pasted emails/Slack threads:

```bash
cp .env.example .env
# paste your MAKERS_MODELS_KEY from EdgeOne → Project → Settings → Environment Variables
npm run dev
```

## Project layout

```
index.html                      → frontend
cloud-functions/api/
  _lib.js                       → auth + KV helpers (private)
  _extract.js                   → local fallback task parser (private)
  signup.js                     → POST /api/signup
  login.js                      → POST /api/login
  logout.js                     → POST /api/logout
  me.js                         → GET  /api/me
  tasks.js                      → GET/POST /api/tasks
  chat.js                       → POST /api/chat
dev-server.mjs                  → local dev (persisted KV in .dev-kv.json)
```

## Deploy to EdgeOne

1. **KV**: Storage → KV → create namespace, bind as `logbook_kv`
2. **Env var**: `MAKERS_MODELS_KEY` from your Makers account
3. Push to Git → Makers Console → Import → deploy

Or via CLI:

```bash
npm i -g edgeone
edgeone login
edgeone makers deploy . -n logbook
```

## Main flows

| Flow | Works locally | Works on EdgeOne |
|------|--------------|------------------|
| Sign up / sign in / sign out | ✓ | ✓ (needs KV) |
| Add task via chat | ✓ (local parser) | ✓ (AI + fallback) |
| Category groups | ✓ | ✓ |
| Mark done / delete / edit notes | ✓ | ✓ |
| Tasks persist across sessions | ✓ (.dev-kv.json) | ✓ (KV) |
| Voice input | ✓ (Chrome/Safari) | ✓ |

# Logbook

**Your personal task manager with an AI agent that understands how you actually talk.**

Paste a message, speak a reminder, or drop in a wall of text — Logbook extracts tasks, deadlines, and categories automatically. Built for real life, extensible to Gmail and beyond.

**Live demo:** https://logbook-dpgi7oj4y204.edgeone.dev

---

## The problem

Most task apps make you do the organizing.

- You copy text from an email, then manually create a task, pick a date, and choose a list.
- Personal chores, work deadlines, school assignments, and events all land in one flat inbox.
- Voice notes and quick messages get lost because turning them into tasks takes too many steps.

People don't need another form. They need something that **reads what they already write** and keeps it sorted.

---

## The solution

Logbook is a conversational personal task manager powered by an AI agent.

You talk to it the way you'd talk to yourself:

> *"I'm going to the mini hackathon on July 3rd at Agent Forge SF"*
> *"Do laundry tomorrow and submit CS homework by Friday"*

The agent extracts actionable items, assigns deadlines, and **categorizes everything into the right bucket** — so you see your life in order, not a pile of text.

---

## How it works

```
You (type / paste / speak)
        ↓
   AI Agent (EdgeOne @makers/deepseek-v4-flash)
        ↓
   Task extraction + deadline parsing + categorization
        ↓
   Horizontal sticky-note board (Events · Work · Personal · School · Inbox)
        ↓
   Persistent storage (Supabase)
```

1. **Input anything** — natural language, pasted emails, Slack threads, voice
2. **AI extracts** — titles, dates, and categories from unstructured text
3. **Tasks appear as sticky notes** — grouped in horizontal scrollable columns by category
4. **You stay in control** — click a note to edit, mark done, or delete

If AI is unavailable, a local parser keeps the app working — no dead ends.

---

## New in v1.1

### Sticky-note board

Tasks render as colored sticky notes on a **horizontal Kanban-style board**. Scroll sideways on mobile to browse categories. Each category has its own column with slight rotation and shadow for a tactile feel.

| Category | Note color |
|----------|------------|
| Events | Yellow |
| Work | Blue |
| Personal | Green |
| School | Purple |
| Inbox | Neutral |

### Ephemeral activity log

Journal entries appear briefly after you send a message, then **fade away** after ~45 seconds (configurable). Full history is still saved to localStorage; only the on-screen display is ephemeral.

```js
// In browser console — set fade duration (15–120 seconds)
localStorage.setItem('logbook_log_fade_sec', '60')
```

### MCP server

Logbook is available as an **MCP (Model Context Protocol) server** so AI assistants can manage your tasks directly.

**Tools:** `get_categories`, `list_tasks`, `add_task`, `complete_task`, `delete_task`

**Connect in Cursor** — add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "logbook": {
      "command": "node",
      "args": ["/absolute/path/to/logbook/mcp-server/index.js"],
      "env": {
        "LOGBOOK_EMAIL": "you@example.com"
      }
    }
  }
}
```

**Connect in Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "logbook": {
      "command": "node",
      "args": ["/absolute/path/to/logbook/mcp-server/index.js"],
      "env": { "LOGBOOK_EMAIL": "you@example.com" }
    }
  }
}
```

Run manually: `npm run mcp`

The MCP server reads/writes the local `.dev-kv.json` store (same as `npm run dev`). Create an account via the web UI first so tasks exist for your email.

### Gmail integration (scaffold)

OAuth flow and sync endpoints are scaffolded. See [docs/gmail-integration.md](docs/gmail-integration.md) for architecture, setup steps, and what's left to implement.

---

## Categories

Logbook organizes your life into five groups:

| Category | Examples |
|----------|----------|
| **Events** | Hackathons, conferences, meetups, workshops, outings |
| **Work** | Meetings, deadlines, code reviews, client tasks |
| **Personal** | Laundry, groceries, dentist, gym, travel, family |
| **School** | Homework, exams, assignments, study sessions |
| **Inbox** | Anything that doesn't fit elsewhere |

Each group is its own **horizontal column** on the board — scroll sideways to browse.

---

## In-page reminders

Logbook surfaces what needs attention **before you forget** — no email setup required.

| Reminder type | What you see |
|---------------|--------------|
| **Overdue** | Red banner + task in Reminders section |
| **Due today** | Amber banner + in-page toast |
| **Due tomorrow** | Listed under Reminders |
| **Browser alerts** | Optional — click "Enable alerts" for system notifications |

Reminders run while you're logged in and recheck every 5 minutes.

---

## Key features

- **Sticky-note board** — horizontal scrollable columns per category
- **Conversational input** — type, paste, or use voice (Chrome/Safari)
- **AI-powered extraction** — EdgeOne Makers Models (`@makers/deepseek-v4-flash`)
- **Smart categorization** — Events, Work, Personal, School, Inbox
- **Deadline awareness** — parses "July 3rd", "tomorrow", "next Friday"
- **Ephemeral activity log** — entries fade after configurable timeout
- **Task detail modal** — edit notes, mark done, delete, see category/deadline
- **MCP server** — manage tasks from Cursor, Claude, or any MCP client
- **Real accounts** — sign up, sign in, tasks persist across sessions
- **Edge-native** — deployed on Tencent EdgeOne

---

## Tech stack

| Layer | Technology |
|-------|-------------|
| Frontend | Single-page HTML/CSS/JS (notebook + sticky notes UI) |
| Backend | EdgeOne Makers Cloud Functions |
| AI | EdgeOne Makers Models — `@makers/deepseek-v4-flash` |
| Storage | Supabase (auth sessions + task data) |
| MCP | `@modelcontextprotocol/sdk` (stdio transport) |
| Hosting | Tencent EdgeOne Pages |
| Voice | Web Speech API |

---

## Quick start (local)

```bash
npm install
npm run dev
```

Open **http://localhost:8088**

1. Create an account (email + password, min 8 chars)
2. Type or paste a task — e.g. *"planning to attend a tencent mini hackathon on july 3rd"*
3. Tasks appear as sticky notes in horizontal columns; click to edit notes, dot to mark done

For AI extraction locally, copy `.env.example` to `.env` and add your keys:

```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
MAKERS_MODELS_KEY=...   # optional — local parser works without it
```

### Run tests

```bash
npm test
```

E2E tests start a dev server on port 8099, then verify signup, chat/add task, categorization, persistence, and UI markup.

### Run MCP server

```bash
LOGBOOK_EMAIL=you@example.com npm run mcp
```

---

## Deploy to EdgeOne

1. Push to GitHub → import in EdgeOne Makers Console
2. **Environment variables:**
   - `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (storage)
   - `MAKERS_MODELS_KEY` (AI extraction)
3. Deploy — no build step needed (`index.html` at repo root)

Or via CLI:

```bash
npm i -g edgeone
edgeone login
edgeone makers deploy . -n logbook
```

**Supabase setup:** run `supabase.sql` in the SQL Editor to create the `kv_store` table.

---

## Demo script (5 min)

1. Sign up → show auth works
2. *"I'm going to mini hackathon on July 3rd at Agent Forge SF"* → **Events** column (yellow note)
3. *"Do laundry tomorrow"* → **Personal** column (green note)
4. *"Submit CS homework by Friday"* → **School** column (purple note)
5. Scroll the horizontal board on mobile
6. Show **Reminders** banner (task due tomorrow appears automatically)
7. Click a sticky note → add notes → mark done
8. Watch log entry fade after ~45 seconds
9. Sign out → sign in → tasks persist

---

## Project layout

```
index.html                      → frontend (sticky-note board UI)
cloud-functions/api/
  _lib.js                       → auth + storage helpers
  _store.js                     → Supabase / KV storage adapter
  _extract.js                   → local fallback task parser
  signup.js                     → POST /api/signup
  login.js                      → POST /api/login
  logout.js                     → POST /api/logout
  me.js                         → GET  /api/me
  tasks.js                      → GET/POST /api/tasks
  chat.js                       → POST /api/chat (AI agent)
  gmail.js                      → Gmail OAuth + sync scaffold
mcp-server/
  index.js                      → MCP server (stdio)
docs/
  gmail-integration.md          → Gmail architecture + setup
tests/
  e2e.mjs                       → end-to-end API tests
dev-server.mjs                  → local dev server
supabase.sql                    → database setup
```

---

## One-liner for slides

> **Logbook** — paste anything, talk, or type. An AI agent turns your messy input into categorized sticky notes on a horizontal board, with MCP access for your AI tools. Personal task management that meets you where you already write.

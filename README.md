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
   Grouped task board (Events · Work · Personal · School)
        ↓
   Persistent storage (Supabase)
```

1. **Input anything** — natural language, pasted emails, Slack threads, voice
2. **AI extracts** — titles, dates, and categories from unstructured text
3. **Tasks appear grouped** — hackathons under Events, laundry under Personal, homework under School
4. **You stay in control** — edit notes, mark done, delete, or add more via chat

If AI is unavailable, a local parser keeps the app working — no dead ends.

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

Each group is its own section on the board — personal chores in one place, academic work in another, professional tasks separate from social events.

---

## In-page reminders

Logbook surfaces what needs attention **before you forget** — no email setup required.

| Reminder type | What you see |
|---------------|--------------|
| **Overdue** | Red banner + task in Reminders section |
| **Due today** | Amber banner + in-page toast |
| **Due tomorrow** | Listed under Reminders |
| **Browser alerts** | Optional — click "Enable alerts" for system notifications |

Reminders run while you're logged in and recheck every 5 minutes. Tasks with deadlines automatically appear — no extra input needed.

**Future:** email reminders and Gmail-triggered alerts (see roadmap below).

---

## Key features

- **Conversational input** — type, paste, or use voice (Chrome/Safari)
- **AI-powered extraction** — EdgeOne Makers Models (`@makers/deepseek-v4-flash`)
- **Smart categorization** — tasks sorted into Events, Work, Personal, School
- **Deadline awareness** — parses "July 3rd", "tomorrow", "next Friday"
- **In-page reminders** — banner + reminder list for overdue, today, and tomorrow; optional browser alerts
- **Urgency indicators** — color-coded dots for overdue, due soon, on track
- **Real accounts** — sign up, sign in, tasks persist across sessions
- **Activity log** — see what you said and what the agent did
- **Edge-native** — deployed on Tencent EdgeOne, runs at the edge

---

## Roadmap: Gmail & beyond

Logbook is built as an **extensible AI agent**, not a closed todo app.

**Next: Gmail integration**

- Connect your inbox via OAuth
- Agent reads incoming emails and surfaces buried action items
- Auto-categorize: work emails → Work, school notices → School, event invites → Events
- One dashboard for everything life throws at you — messages in, tasks out

**Future extensions**

- Email reminders (scheduled before deadlines)
- Slack / Teams thread ingestion
- Calendar sync (Google Calendar, Outlook)
- Daily briefing digest
- Shared lists for teams or households

The architecture is simple: **input source → AI agent → categorized task store**. Gmail is the next input source.

---

## Tech stack

| Layer | Technology |
|-------|-------------|
| Frontend | Single-page HTML/CSS/JS (notebook-style UI) |
| Backend | EdgeOne Makers Cloud Functions |
| AI | EdgeOne Makers Models — `@makers/deepseek-v4-flash` |
| Storage | Supabase (auth sessions + task data) |
| Hosting | Tencent EdgeOne Pages |
| Voice | Web Speech API |

---

## Quick start (local)

```bash
npm run dev
```

Open **http://localhost:8088**

1. Create an account (email + password, min 8 chars)
2. Type or paste a task — e.g. *"planning to attend a tencent mini hackathon on july 3rd"*
3. Tasks appear grouped by category; click to edit notes, dot to mark done

For AI extraction locally, copy `.env.example` to `.env` and add your keys:

```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
MAKERS_MODELS_KEY=...   # optional — local parser works without it
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
2. *"I'm going to mini hackathon on July 3rd at Agent Forge SF"* → **Events**
3. *"Do laundry tomorrow"* → **Personal**
4. *"Submit CS homework by Friday"* → **School**
5. Show **Reminders** banner (task due tomorrow appears automatically)
6. Click **Enable alerts** → optional browser notification
7. Click task → add notes → mark done
8. Sign out → sign in → tasks persist

---

## Project layout

```
index.html                      → frontend
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
dev-server.mjs                  → local dev server
supabase.sql                    → database setup
```

---

## One-liner for slides

> **Logbook** — paste anything, talk, or type. An AI agent turns your messy input into categorized, dated tasks with in-page reminders. Personal task management that meets you where you already write — extensible to Gmail next.

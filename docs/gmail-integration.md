# Gmail Integration — Architecture & Setup

Logbook's Gmail integration follows the standard **OAuth 2.0 + Gmail API** pattern. The scaffold is in place; full production wiring is the next step.

## Recommended approach (researched)

| Concern | Recommendation |
|---------|----------------|
| Auth | OAuth 2.0 with `gmail.readonly` scope (minimal permissions) |
| Client library | `googleapis` npm package |
| Token storage | Per-user `refresh_token` in Supabase/KV (`gmail:<email>`) |
| Sync strategy | Incremental via `historyId` — only process new messages |
| Task extraction | Reuse `localExtract` + AI (`chat.js`) on email subject + body |
| Categorization | Map to existing categories: Work, School, Events, Personal, Inbox |
| Rate limits | Exponential backoff on 429 responses |
| Security | Never commit credentials; use env vars |

## Category mapping from emails

| Email signal | Logbook category |
|--------------|------------------|
| Calendar invites, event RSVPs, meetup notices | **Events** |
| Work domain, manager/team threads, Jira/Slack forwards | **Work** |
| `.edu` senders, syllabus, assignment keywords | **School** |
| Personal services, health, errands, family | **Personal** |
| Unclassified | **Inbox** |

## Setup (when ready)

1. **Google Cloud Console**
   - Create a project → Enable Gmail API
   - OAuth consent screen (External) → add `gmail.readonly` scope
   - Create OAuth 2.0 Client ID (Web application)
   - Authorized redirect URI: `http://localhost:8088/api/gmail/callback` (dev) and production URL

2. **Environment variables**

   ```
   GMAIL_CLIENT_ID=...
   GMAIL_CLIENT_SECRET=...
   GMAIL_REDIRECT_URI=http://localhost:8088/api/gmail/callback
   ```

3. **Install dependency** (not yet in package.json — add when implementing)

   ```bash
   npm install googleapis
   ```

4. **API endpoints** (scaffold exists)

   | Endpoint | Method | Purpose |
   |----------|--------|---------|
   | `/api/gmail/auth-url` | POST | Returns OAuth URL to open in browser |
   | `/api/gmail/callback` | GET | Handles redirect, stores refresh token |
   | `/api/gmail/sync` | POST | Fetches emails, extracts tasks |

## Full sync flow (to implement)

```
User clicks "Connect Gmail"
  → POST /api/gmail/auth-url → open OAuth URL
  → User grants consent
  → GET /api/gmail/callback → store refresh_token
  → POST /api/gmail/sync (or cron)
      → google.gmail.users.messages.list({ q: 'is:unread' })
      → batchGet message bodies
      → For each email: localExtract / AI chat
      → Merge into tasks store
      → Mark processed (label or historyId cursor)
```

## What's done vs. remaining

**Done (scaffold):**
- OAuth URL generation
- Callback handler with token exchange
- Stub sync that demonstrates task extraction from sample email text
- Per-user token storage key (`gmail:<email>`)

**Remaining:**
- `googleapis` client for real message fetch
- UI "Connect Gmail" button in `index.html`
- Incremental sync with `historyId`
- Email-specific categorization heuristics (sender domain, keywords)
- Production redirect URI on EdgeOne deployment

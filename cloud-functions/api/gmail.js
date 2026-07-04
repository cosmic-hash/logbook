// Gmail integration scaffold — OAuth flow + email-to-task pipeline (not yet wired to UI).
// POST /api/gmail/auth-url  -> { url }
// GET  /api/gmail/callback  -> OAuth redirect handler (stub)
// POST /api/gmail/sync      -> fetch unread emails, extract tasks (stub)

import { getSessionEmail, getTasks, saveTasks, json, resolveToday } from "./_lib.js";
import { getStore } from "./_store.js";
import { localExtract } from "./_extract.js";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
];

function gmailConfig(env) {
  return {
    clientId: env.GMAIL_CLIENT_ID || process.env.GMAIL_CLIENT_ID || "",
    clientSecret: env.GMAIL_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || "",
    redirectUri:
      env.GMAIL_REDIRECT_URI ||
      process.env.GMAIL_REDIRECT_URI ||
      "http://localhost:8088/api/gmail/callback",
  };
}

function oauth2Client(config) {
  if (!config.clientId || !config.clientSecret) return null;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return {
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    config,
  };
}

// POST /api/gmail/auth-url
export async function onRequestPost(context) {
  const { request, env } = context;
  const email = await getSessionEmail(request, env);
  if (!email) return json({ error: "Not logged in" }, 401);

  const url = new URL(request.url);
  if (url.pathname.endsWith("/sync")) {
    return handleSync(context, email);
  }

  const client = oauth2Client(gmailConfig(env));
  if (!client) {
    return json(
      {
        error: "Gmail not configured",
        hint: "Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI in environment",
        docs: "See docs/gmail-integration.md",
      },
      503
    );
  }

  return json({ url: client.authUrl, scopes: GMAIL_SCOPES });
}

// GET /api/gmail/callback?code=...
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!url.pathname.endsWith("/callback")) {
    return json({ error: "Not found" }, 404);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return json({ error: "Missing authorization code" }, 400);
  }

  const config = gmailConfig(env);
  if (!config.clientId) {
    return json({ error: "Gmail not configured" }, 503);
  }

  // Token exchange stub — full implementation will store refresh_token per user
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      return json({ error: tokens.error_description || "Token exchange failed" }, 400);
    }

    const email = await getSessionEmail(request, env);
    if (email && tokens.refresh_token) {
      await getStore(env).put(
        `gmail:${email}`,
        JSON.stringify({ refresh_token: tokens.refresh_token, connected_at: new Date().toISOString() })
      );
    }

    return new Response(
      `<html><body><h2>Gmail connected!</h2><p>You can close this tab and return to Logbook.</p><script>setTimeout(()=>window.close(),2000)</script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function handleSync(context, email) {
  const { request, env } = context;
  const raw = await getStore(env).get(`gmail:${email}`);
  if (!raw) {
    return json({ error: "Gmail not connected", hint: "POST /api/gmail/auth-url first" }, 400);
  }

  // Scaffold: in production, use googleapis to fetch unread messages and extract tasks
  const tasks = await getTasks(env, email);
  let syncBody = {};
  try {
    syncBody = await request.json();
  } catch {
    // no body — use server-local today
  }
  const today = resolveToday(syncBody);

  // Placeholder sync result — real implementation fetches emails via Gmail API
  const sampleEmail = {
    subject: "Team standup tomorrow 9am",
    body: "Reminder: standup tomorrow at 9am. Also please review the Q3 report by Friday.",
  };
  const combined = `${sampleEmail.subject}\n${sampleEmail.body}`;
  const result = localExtract(combined, tasks, today);
  await saveTasks(env, email, result.tasks);

  return json({
    synced: true,
    mode: "scaffold",
    reply: result.reply,
    tasks: result.tasks,
    note: "Full Gmail sync requires googleapis + stored refresh token. See docs/gmail-integration.md",
  });
}

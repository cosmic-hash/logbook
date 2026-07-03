// POST /api/login  { email, password } -> sets session cookie, returns { email }
import { verifyPassword, newSessionToken, sessionCookie, json } from "./_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  const raw = await env.logbook_kv.get(`user:${email}`);
  if (!raw) return json({ error: "No account with that email" }, 401);

  const user = JSON.parse(raw);
  if (!verifyPassword(password, user.salt, user.hash)) {
    return json({ error: "Incorrect password" }, 401);
  }

  const token = newSessionToken();
  await env.logbook_kv.put(`session:${token}`, email);

  return json({ email }, 200, { "Set-Cookie": sessionCookie(token) });
}

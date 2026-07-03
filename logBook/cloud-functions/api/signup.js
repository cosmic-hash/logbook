// POST /api/signup  { email, password } -> sets session cookie, returns { email }
import { hashPassword, newSessionToken, sessionCookie, json } from "./_lib.js";

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

  if (!email || !email.includes("@")) return json({ error: "Enter a valid email" }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

  const existing = await env.logbook_kv.get(`user:${email}`);
  if (existing) return json({ error: "An account with that email already exists" }, 409);

  const { salt, hash } = hashPassword(password);
  await env.logbook_kv.put(
    `user:${email}`,
    JSON.stringify({ email, salt, hash, createdAt: new Date().toISOString() })
  );

  const token = newSessionToken();
  await env.logbook_kv.put(`session:${token}`, email);

  return json({ email }, 200, { "Set-Cookie": sessionCookie(token) });
}

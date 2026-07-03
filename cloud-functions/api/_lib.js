// Shared helpers for auth + KV storage.
// Not a route itself (underscore-prefixed files aren't exposed as endpoints).
// Uses one KV namespace, bound in the Makers console as `logbook_kv`, with
// key prefixes to keep users/sessions/tasks separated:
//   user:<email>     -> { email, salt, hash, createdAt }
//   session:<token>  -> email
//   tasks:<email>    -> [ ...tasks ]

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  const attempt = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  if (attempt.length !== stored.length) return false;
  return timingSafeEqual(attempt, stored);
}

export function newSessionToken() {
  return randomBytes(32).toString("hex");
}

export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const out = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return out;
}

export function sessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 30) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `session=${token}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `session=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`;
}

// Returns the logged-in user's email, or null.
export async function getSessionEmail(request, env) {
  const cookies = parseCookies(request);
  const token = cookies["session"];
  if (!token) return null;
  const email = await env.logbook_kv.get(`session:${token}`);
  return email || null;
}

export async function getTasks(env, email) {
  const raw = await env.logbook_kv.get(`tasks:${email}`);
  return raw ? JSON.parse(raw) : [];
}

export async function saveTasks(env, email, tasks) {
  await env.logbook_kv.put(`tasks:${email}`, JSON.stringify(tasks));
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

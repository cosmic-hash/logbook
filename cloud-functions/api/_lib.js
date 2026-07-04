// Shared helpers for auth + storage (Supabase or EdgeOne KV).
// Key prefixes: user:<email>, session:<token>, tasks:<email>

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getStore } from "./_store.js";

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
  const store = getStore(env);
  const email = await store.get(`session:${token}`);
  return email || null;
}

export async function getTasks(env, email) {
  const raw = await getStore(env).get(`tasks:${email}`);
  return raw ? JSON.parse(raw) : [];
}

export async function saveTasks(env, email, tasks) {
  await getStore(env).put(`tasks:${email}`, JSON.stringify(tasks));
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, mcp-session-id, Mcp-Session-Id, mcp-protocol-version, Mcp-Protocol-Version, Accept, Last-Event-ID",
    "Access-Control-Expose-Headers": "mcp-session-id, Mcp-Session-Id, mcp-protocol-version, Mcp-Protocol-Version",
  };
}

export function parseBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// Returns the MCP-authenticated user's email, or null.
export async function getMcpEmail(request, env) {
  const token = parseBearerToken(request);
  if (!token) return null;
  const store = getStore(env);
  const email = await store.get(`mcp_token:${token}`);
  return email || null;
}

export async function getOrCreateMcpToken(env, email) {
  const store = getStore(env);
  const existing = await store.get(`user_mcp_token:${email}`);
  if (existing) return existing;

  const token = newSessionToken();
  await store.put(`mcp_token:${token}`, email);
  await store.put(`user_mcp_token:${email}`, token);
  return token;
}

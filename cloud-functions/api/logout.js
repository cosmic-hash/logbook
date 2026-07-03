// POST /api/logout -> clears session cookie
import { parseCookies, clearSessionCookie, json } from "./_lib.js";
import { getStore } from "./_store.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const token = cookies["session"];
  if (token) await getStore(env).delete(`session:${token}`);
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}

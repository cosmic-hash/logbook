// GET /api/me -> { email } (session check)
import { getSessionEmail, json } from "./_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const email = await getSessionEmail(request, env);
  if (!email) return json({ error: "Not logged in" }, 401);
  return json({ email });
}

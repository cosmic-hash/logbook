// POST /api/mcp/token — session required; returns long-lived MCP API token.
import { getSessionEmail, getOrCreateMcpToken, json } from "./_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const email = await getSessionEmail(request, env);
  if (!email) return json({ error: "Not logged in" }, 401);

  const token = await getOrCreateMcpToken(env, email);
  return json({ token, email });
}

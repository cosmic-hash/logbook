// GET/POST /mcp — authenticated Streamable HTTP MCP endpoint.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, handleTool } from "./_mcp-tools.js";
import { getMcpEmail, corsHeaders, json } from "./_lib.js";

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleMcp(context) {
  const { request, env } = context;

  const email = await getMcpEmail(request, env);
  if (!email) {
    return json({ error: "Unauthorized" }, 401, corsHeaders());
  }

  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = new Server(
    { name: "logbook", version: "1.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const result = await handleTool(env, email, req.params.name, req.params.arguments || {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
        isError: true,
      };
    }
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return withCors(response);
}

export async function onRequestGet(context) {
  return handleMcp(context);
}

export async function onRequestPost(context) {
  return handleMcp(context);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

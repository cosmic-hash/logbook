#!/usr/bin/env node
// Logbook MCP server — exposes tasks via Model Context Protocol (stdio transport).
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS, handleTool } from "../cloud-functions/api/_mcp-tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STORE_FILE = join(ROOT, ".dev-kv.json");

function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

function loadStore() {
  if (!existsSync(STORE_FILE)) return new Map();
  try {
    const data = JSON.parse(readFileSync(STORE_FILE, "utf8"));
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

function saveStore(store) {
  writeFileSync(STORE_FILE, JSON.stringify(Object.fromEntries(store), null, 2));
}

const store = loadStore();
const logbook_kv = {
  async get(key) {
    return store.get(key) ?? null;
  },
  async put(key, value) {
    store.set(key, value);
    saveStore(store);
  },
  async delete(key) {
    store.delete(key);
    saveStore(store);
  },
};

const env = {
  logbook_kv,
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || "",
};

function resolveEmail() {
  return process.env.LOGBOOK_EMAIL || null;
}

const server = new Server(
  { name: "logbook", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const email = resolveEmail();
  try {
    const result = await handleTool(env, email, request.params.name, request.params.arguments || {});
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Logbook MCP server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

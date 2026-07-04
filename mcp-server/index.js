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
import { localExtract } from "../cloud-functions/api/_extract.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STORE_FILE = join(ROOT, ".dev-kv.json");

const CATEGORIES = ["Events", "Work", "Personal", "School", "Inbox"];

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

function resolveEmail(argEmail) {
  return argEmail || process.env.LOGBOOK_EMAIL || null;
}

async function getTasks(email) {
  if (!email) throw new Error("No email — set LOGBOOK_EMAIL or pass email param");
  const store = loadStore();
  const raw = store.get(`tasks:${email}`);
  return raw ? JSON.parse(raw) : [];
}

async function saveTasks(email, tasks) {
  const store = loadStore();
  store.set(`tasks:${email}`, JSON.stringify(tasks));
  saveStore(store);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const TOOLS = [
  {
    name: "get_categories",
    description: "List all Logbook task categories",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_tasks",
    description: "List tasks for a user. Optionally filter by category or done status.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "User email (defaults to LOGBOOK_EMAIL env)" },
        category: { type: "string", description: "Filter by category" },
        done: { type: "boolean", description: "Filter by done status" },
      },
    },
  },
  {
    name: "add_task",
    description: "Add a task from natural language (uses local extraction).",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        message: { type: "string", description: "Natural language task description" },
      },
      required: ["message"],
    },
  },
  {
    name: "complete_task",
    description: "Mark a task done or reopen it",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        task_id: { type: "string" },
        done: { type: "boolean", description: "true to mark done, false to reopen" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task by ID",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        task_id: { type: "string" },
      },
      required: ["task_id"],
    },
  },
];

async function handleTool(name, args) {
  const email = resolveEmail(args.email);

  switch (name) {
    case "get_categories":
      return { categories: CATEGORIES };

    case "list_tasks": {
      const tasks = await getTasks(email);
      let filtered = tasks;
      if (args.category) filtered = filtered.filter((t) => (t.category || "Inbox") === args.category);
      if (typeof args.done === "boolean") filtered = filtered.filter((t) => !!t.done === args.done);
      return { tasks: filtered, count: filtered.length };
    }

    case "add_task": {
      if (!args.message) throw new Error("message is required");
      const tasks = await getTasks(email);
      const today = new Date().toISOString().slice(0, 10);
      const result = localExtract(args.message, tasks, today);
      await saveTasks(email, result.tasks);
      return { reply: result.reply, tasks: result.tasks };
    }

    case "complete_task": {
      const tasks = await getTasks(email);
      const done = args.done !== false;
      const updated = tasks.map((t) => (t.id === args.task_id ? { ...t, done } : t));
      if (!updated.find((t) => t.id === args.task_id)) throw new Error("Task not found");
      await saveTasks(email, updated);
      return { ok: true, task: updated.find((t) => t.id === args.task_id) };
    }

    case "delete_task": {
      const tasks = await getTasks(email);
      const updated = tasks.filter((t) => t.id !== args.task_id);
      if (updated.length === tasks.length) throw new Error("Task not found");
      await saveTasks(email, updated);
      return { ok: true, remaining: updated.length };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server(
  { name: "logbook", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await handleTool(request.params.name, request.params.arguments || {});
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

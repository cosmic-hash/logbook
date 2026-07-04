// Shared MCP tool definitions + handlers (Supabase via _lib.js).
import { localExtract } from "./_extract.js";
import { getTasks, saveTasks } from "./_lib.js";

export const CATEGORIES = ["Events", "Work", "Personal", "School", "Inbox"];

export const TOOLS = [
  {
    name: "get_categories",
    description: "List all Logbook task categories",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_tasks",
    description: "List tasks for the authenticated user. Optionally filter by category or done status.",
    inputSchema: {
      type: "object",
      properties: {
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
        task_id: { type: "string" },
      },
      required: ["task_id"],
    },
  },
];

export async function handleTool(env, email, name, args = {}) {
  if (!email) throw new Error("Not authenticated");

  switch (name) {
    case "get_categories":
      return { categories: CATEGORIES };

    case "list_tasks": {
      const tasks = await getTasks(env, email);
      let filtered = tasks;
      if (args.category) {
        filtered = filtered.filter((t) => (t.category || "Inbox") === args.category);
      }
      if (typeof args.done === "boolean") {
        filtered = filtered.filter((t) => !!t.done === args.done);
      }
      return { tasks: filtered, count: filtered.length };
    }

    case "add_task": {
      if (!args.message) throw new Error("message is required");
      const tasks = await getTasks(env, email);
      const today = new Date().toISOString().slice(0, 10);
      const result = localExtract(args.message, tasks, today);
      await saveTasks(env, email, result.tasks);
      return { reply: result.reply, tasks: result.tasks };
    }

    case "complete_task": {
      const tasks = await getTasks(env, email);
      const done = args.done !== false;
      const updated = tasks.map((t) => (t.id === args.task_id ? { ...t, done } : t));
      if (!updated.find((t) => t.id === args.task_id)) throw new Error("Task not found");
      await saveTasks(env, email, updated);
      return { ok: true, task: updated.find((t) => t.id === args.task_id) };
    }

    case "delete_task": {
      const tasks = await getTasks(env, email);
      const updated = tasks.filter((t) => t.id !== args.task_id);
      if (updated.length === tasks.length) throw new Error("Task not found");
      await saveTasks(env, email, updated);
      return { ok: true, remaining: updated.length };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

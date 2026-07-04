// End-to-end tests against the local dev server.
// Run: npm test (starts server, runs tests, shuts down)

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const PORT = process.env.TEST_PORT || 8099;
const BASE = `http://localhost:${PORT}`;
const TEST_EMAIL = `e2e-${randomBytes(4).toString("hex")}@test.local`;
const TEST_PASSWORD = "testpass1234";

let serverProc = null;
let cookie = "";
let mcpToken = "";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function fetchApi(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/session=([^;]+)/);
    if (match) cookie = `session=${match[1]}`;
  }
  let body = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) body = await res.json();
  else body = await res.text();
  return { res, body };
}

async function waitForServer(maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch {}
    await sleep(300);
  }
  throw new Error("Server did not start in time");
}

function startServer() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server spawn timeout")), 10000);
    serverProc = spawn("node", ["dev-server.mjs"], {
      env: {
        ...process.env,
        PORT: String(PORT),
        SUPABASE_URL: "",
        SUPABASE_SERVICE_KEY: "",
        SUPABASE_SECRET_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    serverProc.stdout.on("data", (d) => {
      if (String(d).includes("Logbook running")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProc.stderr.on("data", (d) => console.error("[server]", String(d).trim()));
    serverProc.on("error", (err) => { clearTimeout(timeout); reject(err); });
  });
}

function stopServer() {
  if (serverProc) serverProc.kill("SIGTERM");
}

async function testSignup() {
  const { res, body } = await fetchApi("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  assert(res.ok, `signup failed: ${JSON.stringify(body)}`);
  assert(body.email === TEST_EMAIL, "signup email mismatch");
  console.log("  ✓ signup");
}

async function testMe() {
  const { res, body } = await fetchApi("/api/me");
  assert(res.ok, `me failed: ${JSON.stringify(body)}`);
  assert(body.email === TEST_EMAIL, "me email mismatch");
  console.log("  ✓ session / me");
}

async function testChatAddTask() {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const { res, body } = await fetchApi("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Do laundry tomorrow", today: todayIso }),
  });
  assert(res.ok, `chat failed: ${JSON.stringify(body)}`);
  assert(Array.isArray(body.tasks), "chat should return tasks array");
  assert(body.tasks.length >= 1, "should have at least one task");
  const laundry = body.tasks.find((t) => /laundry/i.test(t.title));
  assert(laundry, "laundry task not found");
  assert(laundry.category === "Personal", `expected Personal, got ${laundry.category}`);
  console.log("  ✓ chat add task + categorization (Personal)");
  return body.tasks;
}

async function testSchoolCategory() {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const { res, body } = await fetchApi("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Submit CS homework by Friday", today: todayIso }),
  });
  assert(res.ok, `chat school failed: ${JSON.stringify(body)}`);
  const hw = body.tasks.find((t) => /homework|cs/i.test(t.title));
  assert(hw, "homework task not found");
  assert(hw.category === "School", `expected School, got ${hw.category}`);
  console.log("  ✓ school categorization");
}

async function testPersistence() {
  const { res, body } = await fetchApi("/api/tasks");
  assert(res.ok, `get tasks failed: ${JSON.stringify(body)}`);
  assert(body.tasks.length >= 2, "tasks should persist");
  const laundry = body.tasks.find((t) => /laundry/i.test(t.title));
  assert(laundry, "laundry should persist");
  console.log("  ✓ persistence (GET /api/tasks)");
}

async function testIndexHtml() {
  const res = await fetch(`${BASE}/`);
  assert(res.ok, "index.html should load");
  const html = await res.text();
  assert(html.includes("board-scroll"), "should have horizontal board");
  assert(html.includes("sticky-note"), "should have sticky notes");
  assert(html.includes("mcpTokenBtn"), "should have MCP token button");
  assert(html.includes("retryMicAfterNetworkError"), "should have mic network retry logic");
  assert(html.includes("MIC_NETWORK_RETRY_MAX"), "should have mic network retry config");
  assert(html.includes("browser's cloud service"), "should have improved mic network error message");
  assert(html.includes("stopMicRecording"), "should have mic manual stop helper");
  console.log("  ✓ index.html loads with new UI");
}

async function testMcpUnauthorized() {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "e2e", version: "1.0.0" },
      },
    }),
  });
  assert(res.status === 401, `unauthenticated MCP should return 401, got ${res.status}`);
  console.log("  ✓ MCP rejects unauthenticated requests");
}

async function testMcpToken() {
  const { res, body } = await fetchApi("/api/mcp/token", { method: "POST" });
  assert(res.ok, `mcp token failed: ${JSON.stringify(body)}`);
  assert(typeof body.token === "string" && body.token.length >= 32, "token should be returned");
  assert(body.email === TEST_EMAIL, "token email mismatch");
  mcpToken = body.token;

  const again = await fetchApi("/api/mcp/token", { method: "POST" });
  assert(again.body.token === mcpToken, "token should be stable for same user");
  console.log("  ✓ MCP token generation");
}

async function testMcpTools() {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${mcpToken}` } },
  });
  const client = new Client({ name: "e2e", version: "1.0.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  assert(names.includes("list_tasks"), "should expose list_tasks");
  assert(names.includes("add_task"), "should expose add_task");

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const addResult = await client.callTool({
    name: "add_task",
    arguments: { message: "Book dentist appointment next Friday", today: todayIso },
  });
  const addText = addResult.content?.[0]?.text || "";
  const addParsed = JSON.parse(addText);
  assert(
    addParsed.reply.includes("Added") || addParsed.tasks.length >= 3,
    `add_task failed: ${addText}`
  );

  const listResult = await client.callTool({ name: "list_tasks", arguments: {} });
  const listText = listResult.content?.[0]?.text || "";
  const parsed = JSON.parse(listText);
  assert(parsed.count >= 3, "list_tasks should return tasks");
  const cleaning = parsed.tasks.find((t) => /dentist/i.test(t.title));
  assert(cleaning, "MCP-added task should appear in list_tasks");

  await transport.close();
  console.log("  ✓ MCP list_tasks + add_task via /mcp");
}

async function run() {
  console.log(`\nLogbook E2E tests (port ${PORT})\n`);
  try {
    await startServer();
    await waitForServer();
    await testIndexHtml();
    await testSignup();
    await testMe();
    await testChatAddTask();
    await testSchoolCategory();
    await testPersistence();
    await testMcpUnauthorized();
    await testMcpToken();
    await testMcpTools();
    console.log("\nAll tests passed.\n");
    process.exitCode = 0;
  } catch (err) {
    console.error("\nTest failed:", err.message);
    process.exitCode = 1;
  } finally {
    stopServer();
  }
}

run();

// Local dev server: serves index.html + cloud function API routes with persisted KV.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8088;
const STORE_FILE = join(__dirname, ".dev-kv.json");

function loadEnvFile() {
  const envPath = join(__dirname, ".env");
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

loadEnvFile();

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
  MAKERS_MODELS_KEY: process.env.MAKERS_MODELS_KEY || "",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function toWebRequest(req, body) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  return new Request(url, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
  });
}

async function sendWebResponse(res, webRes) {
  res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
  res.end(Buffer.from(await webRes.arrayBuffer()));
}

const routes = {
  "GET /api/me": "./cloud-functions/api/me.js",
  "POST /api/login": "./cloud-functions/api/login.js",
  "POST /api/signup": "./cloud-functions/api/signup.js",
  "POST /api/logout": "./cloud-functions/api/logout.js",
  "GET /api/tasks": "./cloud-functions/api/tasks.js",
  "POST /api/tasks": "./cloud-functions/api/tasks.js",
  "POST /api/chat": "./cloud-functions/api/chat.js",
};

const handlers = {};
for (const [route, modPath] of Object.entries(routes)) {
  const mod = await import(pathToFileURL(join(__dirname, modPath)).href);
  handlers[route] = mod;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const routeKey = `${req.method} ${url.pathname}`;

    if (routeKey in handlers) {
      const body = await readBody(req);
      const request = toWebRequest(req, body);
      const mod = handlers[routeKey];
      const handler =
        req.method === "GET" ? mod.onRequestGet : mod.onRequestPost;
      const webRes = await handler({ request, env });
      return sendWebResponse(res, webRes);
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      const html = readFileSync(join(__dirname, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal server error");
  }
}).listen(PORT, () => {
  console.log(`Logbook running at http://localhost:${PORT}`);
  if (env.MAKERS_MODELS_KEY) {
    console.log("AI extraction enabled (MAKERS_MODELS_KEY set).");
  } else {
    console.log("Using local task extraction. Add MAKERS_MODELS_KEY to .env for AI.");
  }
});

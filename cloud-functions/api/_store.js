// Storage: Supabase (instant, no approval) or EdgeOne KV (logbook_kv binding).

function cfg(env = {}) {
  const e = env || {};
  return {
    SUPABASE_URL: e.SUPABASE_URL || process.env.SUPABASE_URL || "",
    SUPABASE_SERVICE_KEY:
      e.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      e.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      "",
    logbook_kv: e.logbook_kv,
  };
}

function sbHeaders(c) {
  return {
    apikey: c.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${c.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

function useSupabase(c) {
  return Boolean(c.SUPABASE_URL && c.SUPABASE_SERVICE_KEY);
}

async function sbGet(c, key) {
  const url = `${c.SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`;
  const res = await fetch(url, { headers: sbHeaders(c) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase get failed (${res.status}): ${body.slice(0, 120)}`);
  }
  const rows = await res.json();
  return rows[0]?.value ?? null;
}

async function sbPut(c, key, value) {
  const res = await fetch(`${c.SUPABASE_URL}/rest/v1/kv_store`, {
    method: "POST",
    headers: { ...sbHeaders(c), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase put failed (${res.status}): ${body.slice(0, 120)}`);
  }
}

async function sbDelete(c, key) {
  const url = `${c.SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "DELETE", headers: sbHeaders(c) });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Supabase delete failed: ${res.status}`);
  }
}

export function getStore(env) {
  const c = cfg(env);
  if (useSupabase(c)) {
    return {
      get: (key) => sbGet(c, key),
      put: (key, value) => sbPut(c, key, value),
      delete: (key) => sbDelete(c, key),
    };
  }
  if (c.logbook_kv) return c.logbook_kv;
  throw new Error("No storage: set SUPABASE_URL + SUPABASE_SERVICE_KEY in EdgeOne env vars");
}

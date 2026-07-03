// Storage: Supabase (instant, no approval) or EdgeOne KV (logbook_kv binding).

function sbHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

function useSupabase(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY);
}

async function sbGet(env, key) {
  const url = `${env.SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`;
  const res = await fetch(url, { headers: sbHeaders(env) });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.value ?? null;
}

async function sbPut(env, key, value) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/kv_store`, {
    method: "POST",
    headers: { ...sbHeaders(env), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error(`Supabase put failed: ${res.status}`);
}

async function sbDelete(env, key) {
  const url = `${env.SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "DELETE", headers: sbHeaders(env) });
  if (!res.ok && res.status !== 404) throw new Error(`Supabase delete failed: ${res.status}`);
}

export function getStore(env) {
  if (useSupabase(env)) {
    return {
      get: (key) => sbGet(env, key),
      put: (key, value) => sbPut(env, key, value),
      delete: (key) => sbDelete(env, key),
    };
  }
  if (!env.logbook_kv) {
    throw new Error("No storage configured. Set SUPABASE_URL + SUPABASE_SERVICE_KEY or bind logbook_kv.");
  }
  return env.logbook_kv;
}

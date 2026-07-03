// GET  /api/tasks -> { tasks: [...] } for the logged-in user
// POST /api/tasks  { tasks: [...] } -> overwrites the logged-in user's task list
import { getSessionEmail, getTasks, saveTasks, json } from "./_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const email = await getSessionEmail(request, env);
  if (!email) return json({ error: "Not logged in" }, 401);
  const tasks = await getTasks(env, email);
  return json({ tasks });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const email = await getSessionEmail(request, env);
  if (!email) return json({ error: "Not logged in" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  await saveTasks(env, email, tasks);
  return json({ tasks });
}

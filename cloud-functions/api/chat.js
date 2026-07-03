// POST /api/chat  { message } -> { reply, tasks }
import { getSessionEmail, getTasks, saveTasks, json } from "./_lib.js";
import { localExtract } from "./_extract.js";

const CATEGORY_HINTS = [
  "Events — hackathons, conferences, meetups, workshops",
  "Work — projects, deadlines, meetings, clients",
  "Personal — errands, health, travel, family",
  "School — classes, exams, assignments",
  "Inbox — anything that doesn't fit elsewhere",
];

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

  const { message } = body;
  const tasks = await getTasks(env, email);
  const today = new Date().toISOString().slice(0, 10);

  if (!env.MAKERS_MODELS_KEY) {
    const fallback = localExtract(message, tasks, today);
    await saveTasks(env, email, fallback.tasks);
    return json(fallback);
  }

  const systemPrompt = `You maintain a personal task/notes tracker. Today's date is ${today}.
Current tasks (JSON): ${JSON.stringify(tasks)}

Categories (always assign one):
${CATEGORY_HINTS.map((h) => `- ${h}`).join("\n")}

The user message may be a plan ("planning to attend a hackathon on July 3rd"), an instruction, an update, or pasted content (email, Slack, notes) with buried tasks.

Rules:
- Plans and events ARE tasks. "Planning to attend X on DATE" → create a task titled clearly (e.g. "Attend Tencent mini hackathon") with category "Events" and deadline on that date.
- Assign every task exactly one category from the list above.
- Parse dates like "July 3rd", "7/3", "2026-07-03" into YYYY-MM-DD using today's year when year is omitted.
- When pasted content has multiple items, create multiple tasks in the right categories.

Respond with ONLY a JSON object, no markdown fences:
{
  "reply": "short confirmation of what you added or changed",
  "tasks": [ { "id": "string", "title": "string", "category": "Events|Work|Personal|School|Inbox", "deadline": "YYYY-MM-DD or null", "notes": "string or null", "done": boolean } ]
}
"tasks" must be the FULL updated list. Only skip creating a task if the message is purely conversational with zero actionable content.`;

  try {
    const gatewayRes = await fetch("https://ai-gateway.edgeone.link/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.MAKERS_MODELS_KEY}`,
      },
      body: JSON.stringify({
        model: "@makers/deepseek-v4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    if (!gatewayRes.ok) {
      const fallback = localExtract(message, tasks, today);
      await saveTasks(env, email, fallback.tasks);
      return json({ ...fallback, reply: fallback.reply + " (AI unavailable — used local extraction.)" });
    }

    const data = await gatewayRes.json();
    let raw = data.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = localExtract(message, tasks, today);
    }

    let updatedTasks = Array.isArray(parsed.tasks) ? parsed.tasks : tasks;
    if (updatedTasks.length === tasks.length && looksLikeNewTask(message, tasks, updatedTasks)) {
      const fallback = localExtract(message, tasks, today);
      if (fallback.tasks.length > tasks.length) {
        updatedTasks = fallback.tasks;
        parsed.reply = fallback.reply;
      }
    }

    updatedTasks = updatedTasks.map((t) => ({
      ...t,
      category: t.category || "Inbox",
    }));

    await saveTasks(env, email, updatedTasks);
    return json({ reply: parsed.reply || "Done.", tasks: updatedTasks });
  } catch (err) {
    const fallback = localExtract(message, tasks, today);
    await saveTasks(env, email, fallback.tasks);
    return json(fallback);
  }
}

function looksLikeNewTask(message, before, after) {
  return looksLikeTask(message) && after.length <= before.length;
}

function looksLikeTask(message) {
  const t = message.toLowerCase();
  return /\b(planning|plan to|attend|hackathon|conference|remind|need to|deadline|todo|meeting)\b/.test(t);
}

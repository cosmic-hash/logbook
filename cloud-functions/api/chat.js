// POST /api/chat  { message } -> { reply, tasks }
import { getSessionEmail, getTasks, saveTasks, json, resolveToday } from "./_lib.js";
import { localExtract } from "./_extract.js";

const CATEGORY_HINTS = [
  "Events — hackathons, conferences, meetups, workshops, competitions, social outings you're attending",
  "Work — job tasks, meetings, deadlines, clients, projects, code reviews, interviews",
  "Personal — chores (laundry, dishes, cleaning), errands, groceries, health appointments, gym, travel, family",
  "School — homework, exams, quizzes, assignments, lectures, study sessions, research papers, class projects",
  "Inbox — only when nothing else fits",
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

  const { message, timezone, today: clientToday } = body;
  const tasks = await getTasks(env, email);
  const today = resolveToday({ today: clientToday, timezone });

  const aiKey = env.MAKERS_MODELS_KEY || process.env.MAKERS_MODELS_KEY;
  if (!aiKey) {
    const fallback = localExtract(message, tasks, today);
    await saveTasks(env, email, fallback.tasks);
    return json(fallback);
  }

  const systemPrompt = `You maintain a personal task/notes tracker. Today's date is ${today}.
Current tasks (JSON): ${JSON.stringify(tasks)}

Categories — ALWAYS assign exactly one. Group similar tasks together:
${CATEGORY_HINTS.map((h) => `- ${h}`).join("\n")}

Examples:
- "mini hackathon on July 3rd" → Events
- "do laundry this weekend" → Personal
- "submit CS homework by Friday" → School
- "standup with team tomorrow" → Work
- "dentist appointment Thursday" → Personal

The user message may be a plan, instruction, update, or pasted content (email, Slack, notes) with multiple buried tasks.

Rules:
- Plans and events ARE tasks. "Going to X on DATE" → Events with a clear title and deadline.
- Chores and life admin → Personal. Academic work → School. Job/professional → Work.
- NEVER default to Inbox if a better category exists.
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
        Authorization: `Bearer ${aiKey}`,
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

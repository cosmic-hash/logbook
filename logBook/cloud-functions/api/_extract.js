// Lightweight local task extraction when the AI gateway is unavailable.

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 12,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const WEEKDAYS = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function toIso(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function parseWeekday(text, todayIso) {
  const m = text.match(/\b(?:by|on|before|this|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i);
  if (!m) return null;

  const today = new Date(todayIso + "T12:00:00");
  const target = WEEKDAYS[m[1].toLowerCase()];
  let diff = target - today.getDay();
  const isNext = /\bnext\b/i.test(text);

  if (isNext) {
    if (diff <= 0) diff += 7;
  } else if (diff < 0) {
    diff += 7;
  }

  return addDays(todayIso, diff);
}

function parseDeadline(text, todayIso) {
  const today = new Date(todayIso + "T12:00:00");
  const year = today.getFullYear();

  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const y = slash[3] ? (slash[3].length === 2 ? 2000 + +slash[3] : +slash[3]) : year;
    return toIso(y, +slash[1] - 1, +slash[2]);
  }

  const named = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i
  );
  if (named) {
    const y = named[3] ? +named[3] : year;
    return toIso(y, MONTHS[named[1].toLowerCase()], +named[2]);
  }

  const weekday = parseWeekday(text, todayIso);
  if (weekday) return weekday;

  if (/\btoday\b/i.test(text)) return todayIso;
  if (/\btomorrow\b/i.test(text)) return addDays(todayIso, 1);

  return null;
}

function inferCategory(text) {
  const t = text.toLowerCase();
  if (/\b(hackathon|conference|meetup|workshop|event|webinar|summit)\b/.test(t)) return "Events";
  if (/\b(invoice|client|deadline|project|meeting|standup|sprint|deploy|release|pr\b|code review|submit|report)\b/.test(t)) return "Work";
  if (/\b(doctor|gym|dentist|groceries|family|birthday|flight|hotel|trip)\b/.test(t)) return "Personal";
  if (/\b(homework|exam|class|study|assignment|course)\b/.test(t)) return "School";
  return "Inbox";
}

function inferTitle(text) {
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/^i\s+(am\s+)?/i, "");
  t = t.replace(/\b(planning to|plan to|going to|need to|have to|want to|remind me to)\b/gi, "");
  t = t.replace(/\b(by|before|on|due)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|\d{1,2}\/\d{1,2}|\w+\s+\d{1,2}).*$/i, "");
  t = t.replace(/\s+/g, " ").trim();
  if (/\b(attend|attending)\b/i.test(text) && !/^attend/i.test(t)) {
    t = "Attend " + t.replace(/\b(attend|attending)\b/gi, "").trim();
  }
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  if (cap.length <= 80) return cap;
  return cap.slice(0, 77) + "…";
}

function looksLikeTask(message) {
  const t = message.toLowerCase();
  if (/\b(mark|complete|finish)\b/.test(t) && /\bdone\b/.test(t)) return false;
  return (
    /\b(planning|plan to|attend|attending|going to|register|sign up|remind|need to|have to|must|should|todo|task|deadline|due|by friday|by monday|hackathon|conference|meeting|submit|send|finish|complete|prepare|book|schedule|mark|done)\b/.test(t) ||
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})\b/.test(t)
  );
}

function tryMarkDone(message, existingTasks) {
  const t = message.toLowerCase();
  if (!/\b(mark|complete|finish|done)\b/.test(t)) return null;

  const words = t.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const match = existingTasks.find((task) => {
    const titleWords = task.title.toLowerCase().split(/\s+/);
    return titleWords.some((w) => w.length > 3 && words.includes(w));
  });

  if (!match) return null;
  const tasks = existingTasks.map((task) =>
    task.id === match.id ? { ...task, done: true } : task
  );
  return { reply: `Marked "${match.title}" as done.`, tasks };
}

function extractSingle(message, existingTasks, todayIso) {
  if (!message?.trim() || !looksLikeTask(message)) {
    return null;
  }

  const category = inferCategory(message);
  const deadline = parseDeadline(message, todayIso);
  const title = inferTitle(message);

  const duplicate = existingTasks.find(
    (t) => t.title.toLowerCase() === title.toLowerCase() && t.category === category && !t.done
  );
  if (duplicate) return null;

  return {
    id: newId(),
    title,
    category,
    deadline,
    notes: null,
    done: false,
  };
}

export function localExtract(message, existingTasks, todayIso) {
  const doneUpdate = tryMarkDone(message, existingTasks);
  if (doneUpdate) return doneUpdate;

  const lines = message
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);

  const chunks = lines.length > 1 ? lines : [message.trim()];
  let tasks = [...existingTasks];
  let added = 0;

  for (const chunk of chunks) {
    const task = extractSingle(chunk, tasks, todayIso);
    if (task) {
      tasks.push(task);
      added++;
    }
  }

  if (added > 0) {
    const cats = [...new Set(tasks.slice(-added).map((t) => t.category))];
    return {
      reply: `Added ${added} item${added > 1 ? "s" : ""} to ${cats.join(", ")}.`,
      tasks,
    };
  }

  return {
    reply: "I didn't spot a task in that — try mentioning what you need to do and when.",
    tasks: existingTasks,
  };
}

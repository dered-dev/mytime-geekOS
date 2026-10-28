#!/usr/bin/env node
// Carga una entrada en Geek OS (gvia.io) igual que "Nueva entrada" en Mi tiempo.
// Uso:
//   node scripts/subir-horas.mjs --inicio 11:35 --fin 16:35 --desc "..." --proyecto Solfium --tarea "frontend a WP"
//   node scripts/subir-horas.mjs --inicio 11:35 --horas 5 ...   # calcula la hora fin
//   node scripts/subir-horas.mjs --fecha 2026-09-23 ...         # si no, usa hoy en Ciudad de México
//   node scripts/subir-horas.mjs --faltan                       # días lun–vie de esta semana en cero
//   node scripts/subir-horas.mjs --hoy                          # listado de hoy
//   node scripts/subir-horas.mjs --ayer                         # listado de ayer
//   Si el horario se empalma con otra entrada, igual la guarda y avisa al final.
//   node scripts/subir-horas.mjs --proyectos                    # proyectos que ves (según tus tareas)
//   node scripts/subir-horas.mjs --tareas --proyecto Roshfrans  # tareas de un proyecto
//   node scripts/subir-horas.mjs --dry-run ...                  # resuelve la tarea y no guarda
//   node scripts/subir-horas.mjs --self-check                   # prueba local, sin red

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://gvia.io";
// ponytail: Geek OS arma el ISO con offset fijo -06:00 (México ya no cambia horario).
const OFFSET = "-06:00";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? "" : (process.argv[i + 1] ?? "");
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function die(msg, code = 1) {
  const err = new Error(msg);
  err.exitCode = code;
  throw err;
}

function norm(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function loadEnv() {
  const text = readFileSync(join(ROOT, ".env"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const email = env.EMAIL || env.USER;
  const password = env.PASSWORD;
  if (!email || !password) die("Falta EMAIL (o USER) y PASSWORD en .env");
  return { email, password };
}

function todayMexico() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toLocal(fecha, hora) {
  const h = hora.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(h)) return h.slice(0, 16);
  if (!/^\d{1,2}:\d{2}$/.test(h)) die(`Hora inválida: ${hora}. Usa 11:35`);
  const [hh, mm] = h.split(":");
  return `${fecha}T${hh.padStart(2, "0")}:${mm}`;
}

function toIso(local) {
  return new Date(`${local}:00${OFFSET}`).toISOString();
}

function mexicoYmd(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function mexicoClock(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("hour")}:${get("minute")}`;
}

function addDaysYmd(ymd, n) {
  return mexicoYmd(new Date(new Date(`${ymd}T12:00:00${OFFSET}`).getTime() + n * 86400000));
}

function mondayOf(ymd) {
  const day = new Date(`${ymd}T12:00:00${OFFSET}`).getUTCDay();
  return addDaysYmd(ymd, -((day + 6) % 7));
}

function parseHoras(raw) {
  const n = Number(String(raw).trim().replace(",", ".").replace(/h$/i, ""));
  if (!Number.isFinite(n) || n <= 0) die(`Duración inválida: ${raw}. Usa horas, por ejemplo 5 o 1.5`);
  return Math.round(n * 60);
}

function addMinutes(local, minutes) {
  const end = new Date(new Date(`${local}:00${OFFSET}`).getTime() + minutes * 60000);
  return `${mexicoYmd(end)}T${mexicoClock(end)}`;
}

function crossing(entries, startMs, endMs) {
  return entries.filter((e) => {
    if (e.deletedAt || !e.startedAt || !e.endedAt) return false;
    const a = new Date(e.startedAt).getTime();
    const b = new Date(e.endedAt).getTime();
    return a < endMs && startMs < b;
  });
}

const WEEKDAYS = [
  { name: "Lun", n: 0 },
  { name: "Mar", n: 1 },
  { name: "Mié", n: 2 },
  { name: "Jue", n: 3 },
  { name: "Vie", n: 4 },
];

function fmtMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function dayLabel(ymd) {
  const [, month, day] = ymd.split("-");
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(day)} ${months[Number(month) - 1]}`;
}

function projectHay(task) {
  const p = task.project ?? {};
  return [p.name, p.client?.nombre, p.proposal?.clientName, p.proposal?.projectName, p.proposal?.folio]
    .filter(Boolean)
    .join(" ");
}

function projectList(tasks) {
  const byName = new Map();
  for (const t of tasks) {
    const name = t.project?.name;
    if (!name) continue;
    const client = t.project?.client?.nombre || t.project?.proposal?.clientName || "";
    const row = byName.get(name) ?? { name, client, tasks: 0 };
    row.tasks += 1;
    byName.set(name, row);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function fmtProjects(tasks) {
  return projectList(tasks)
    .map((p, i) => `${i + 1}. ${p.name}${p.client ? `  (${p.client})` : ""}  · ${p.tasks} tareas`)
    .join("\n");
}

function fmtTasks(tasks) {
  return tasks
    .map((t, i) => {
      const sub = t.parentId || t.parent ? "  [subtarea]" : "";
      const status = t.status ? `  · ${t.status}` : "";
      return `${i + 1}. ${t.title}${sub}${status}  [${t.project?.name ?? ""}]`;
    })
    .join("\n");
}

const CAMINOS = [
  "Opciones:",
  "  1. Registrar en una de las tareas de arriba: vuelve a correr con --tarea \"<título>\".",
  "  2. Crear una subtarea con ese nombre bajo la tarea padre que corresponda.",
  "  3. Crear una tarea nueva en el proyecto.",
  "Las opciones 2 y 3 se hacen desde la app (gvia.io) o con el MCP de Geek OS; el script no crea tareas.",
].join("\n");

function wordsHit(title, tq) {
  const words = tq.split(" ").filter((w) => w.length > 2);
  const t = norm(title);
  return words.length > 0 && words.some((w) => t.includes(w));
}

function pick(tasks, proyecto, tarea) {
  const pq = norm(proyecto);
  const tq = norm(tarea);
  const inProject = tasks.filter((t) => norm(projectHay(t)).includes(pq));
  if (inProject.length === 0) {
    die(
      `Ningún proyecto coincide con "${proyecto}". Estos son los proyectos que ves (según tus tareas). Elige uno y vuelve a correr con --proyecto:\n${fmtProjects(tasks)}`,
      2,
    );
  }
  const projects = projectList(inProject);
  const hits = inProject.filter((t) => norm(t.title).includes(tq));
  const exact = hits.filter((t) => norm(t.title) === tq);
  if (exact.length === 1) return exact[0];
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    die(`Hay ${hits.length} tareas que coinciden. Sé más específico:\n${fmtTasks(hits)}`, 2);
  }
  const near = inProject.filter((t) => wordsHit(t.title, tq));
  const head = projects.length > 1
    ? `"${proyecto}" coincide con ${projects.length} proyectos.`
    : `En "${projects[0].name}" no hay ninguna tarea que se llame "${tarea}".`;
  const parecidas = near.length ? `\nParecidas:\n${fmtTasks(near)}\n` : "";
  die(`${head}${parecidas}\nTodas las tareas:\n${fmtTasks(inProject)}\n\n${CAMINOS}`, 2);
}

class Jar {
  #cookies = new Map();
  store(res) {
    const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const raw of list) {
      const pair = raw.split(";")[0];
      const i = pair.indexOf("=");
      if (i > 0) this.#cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
  header() {
    return [...this.#cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async fetch(url, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("user-agent", "Mozilla/5.0");
    headers.set("accept", "application/json");
    if (this.#cookies.size) headers.set("cookie", this.header());
    const res = await fetch(url, { ...init, headers, redirect: init.redirect ?? "manual" });
    this.store(res);
    return res;
  }
}

async function login(jar, email, password) {
  const csrfRes = await jar.fetch(`${BASE}/api/auth/csrf`);
  if (!csrfRes.ok) die(`No pude pedir el token de sesión (${csrfRes.status})`);
  const { csrfToken } = await csrfRes.json();
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/me/timesheet`,
    json: "true",
  });
  const res = await jar.fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (text.includes("CredentialsSignin") || res.status >= 400) die("Credenciales rechazadas");
  const session = await jar.fetch(`${BASE}/api/auth/session`);
  const data = await session.json().catch(() => null);
  if (!data?.user) die("Entré pero no hay sesión. Revisa USER y PASSWORD en .env");
}

async function tasksOf(jar) {
  const res = await jar.fetch(`${BASE}/api/me/tasks`);
  if (!res.ok) die(`No pude leer tus tareas (${res.status})`);
  const data = await res.json();
  const tasks = Array.isArray(data) ? data : data.tasks;
  if (!Array.isArray(tasks)) die("La respuesta de tareas no trae una lista");
  return tasks;
}

async function entriesBetween(jar, from, to) {
  const res = await jar.fetch(`${BASE}/api/time-entries?from=${from}&to=${to}`);
  if (!res.ok) die(`No pude leer tus horas (${res.status})`);
  const data = await res.json();
  const entries = Array.isArray(data) ? data : data.entries;
  if (!Array.isArray(entries)) die("La respuesta de horas no trae una lista");
  return entries;
}

function projectName(entry) {
  const project = entry.task?.project;
  return typeof project === "string" ? project : project?.name || "";
}

function weekReport(entries, monday) {
  const lines = WEEKDAYS.map(({ name, n }) => {
    const ymd = addDaysYmd(monday, n);
    const minutes = entries
      .filter((e) => !e.deletedAt && e.startedAt && mexicoYmd(new Date(e.startedAt)) === ymd)
      .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
    return { ymd, name, minutes, line: `${name} ${dayLabel(ymd)}   ${minutes ? fmtMinutes(minutes) : "falta"}` };
  });
  const missing = lines.filter((d) => d.minutes === 0);
  const head = missing.length
    ? `Faltan: ${missing.map((d) => `${d.name} ${dayLabel(d.ymd)}`).join(", ")}`
    : "Nada pendiente de lun a vie.";
  return `${head}\n${lines.map((d) => d.line).join("\n")}`;
}

function dayReport(entries, ymd, title) {
  const day = entries
    .filter((e) => !e.deletedAt && e.startedAt && mexicoYmd(new Date(e.startedAt)) === ymd)
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  if (day.length === 0) return `${title} · ${dayLabel(ymd)}\nSin registros`;
  const total = day.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
  const lines = day.map((e) => {
    const from = mexicoClock(new Date(e.startedAt));
    const to = e.endedAt ? mexicoClock(new Date(e.endedAt)) : "";
    const note = e.description ? `\n  ${e.description}` : "";
    return `${from}–${to}  ${fmtMinutes(e.durationMinutes ?? 0)}  ${e.task?.title || "sin tarea"} · ${projectName(e)}${note}`;
  });
  return `${title} · ${dayLabel(ymd)} · ${fmtMinutes(total)}\n${lines.join("\n")}`;
}

function selfCheck() {
  const tasks = [
    { id: "1", title: "Integracion de frontend a WP", project: { name: "Rediseño Web + SEO Solfium", client: { nombre: "SOLFIUM MEXICO" }, proposal: { clientName: "Solfium" } } },
    { id: "2", title: "Desarrollo Front-End", project: { name: "Rediseño Web + SEO Solfium", client: { nombre: "SOLFIUM MEXICO" } } },
    { id: "3", title: "Otra", project: { name: "Holcim sitio", client: { nombre: "Holcim" } } },
  ];
  const hit = pick(tasks, "solfium", "frontend a wp");
  if (hit.id !== "1") die("self-check: no eligió la tarea de Solfium");
  const local = toLocal("2026-09-23", "11:35");
  if (local !== "2026-09-23T11:35") die(`self-check: fecha ${local}`);
  if (toIso(local) !== "2026-09-23T17:35:00.000Z") die(`self-check: iso ${toIso(local)}`);
  let ambiguous = false;
  try {
    pick(tasks, "solfium", "front");
  } catch {
    ambiguous = true;
  }
  if (!ambiguous) die("self-check: dos tareas con 'front' debieron frenar");
  let sinTarea = "";
  try {
    pick(tasks, "solfium", "analisis de rendimiento");
  } catch (e) {
    sinTarea = e.message;
  }
  if (!sinTarea.includes("Todas las tareas") || !sinTarea.includes("Desarrollo Front-End") || !sinTarea.includes("Crear una subtarea")) {
    die(`self-check: sin tarea debió listar todas y dar opciones\n${sinTarea}`);
  }
  let sinProyecto = "";
  try {
    pick(tasks, "roshfrans", "lo que sea");
  } catch (e) {
    sinProyecto = e.message;
  }
  if (!sinProyecto.includes("Holcim sitio") || !sinProyecto.includes("Rediseño Web + SEO Solfium")) {
    die(`self-check: sin proyecto debió listar los proyectos\n${sinProyecto}`);
  }
  const named = pick(
    [
      { id: "a", title: "Landing laboratorio", project: { name: "Roshfrans" } },
      { id: "b", title: "Landing laboratorio - Generar Landing de Metodos", project: { name: "Roshfrans" } },
    ],
    "Roshfrans",
    "Landing laboratorio",
  );
  if (named.id !== "a") die("self-check: el título exacto no ganó");
  if (addMinutes("2026-09-23T11:35", parseHoras("5")) !== "2026-09-23T16:35") die("self-check: 5h no caen en 16:35");
  if (addMinutes("2026-09-23T22:00", parseHoras("1.5")) !== "2026-09-23T23:30") die("self-check: 1.5h");
  if (mondayOf("2026-09-23") !== "2026-09-21") die("self-check: el lunes de esa semana");
  const block = [{ startedAt: "2026-09-23T17:35:00.000Z", endedAt: "2026-09-23T22:35:00.000Z" }];
  const start = new Date("2026-09-23T15:00:00.000Z").getTime();
  const end = new Date("2026-09-23T18:00:00.000Z").getTime();
  if (crossing(block, start, end).length !== 1) die("self-check: debía detectar el cruce");
  const after = new Date("2026-09-23T22:35:00.000Z").getTime();
  const later = new Date("2026-09-23T23:00:00.000Z").getTime();
  if (crossing(block, after, later).length !== 0) die("self-check: pegar en el fin no es cruce");
  const report = weekReport(
    [{ startedAt: "2026-09-21T18:00:00.000Z", durationMinutes: 60, deletedAt: null }],
    "2026-09-21",
  );
  if (!report.startsWith("Faltan: Mar") || !report.includes("Lun 21 sep   1h")) die(`self-check: semana\n${report}`);
  const listed = dayReport(
    [{
      startedAt: "2026-09-23T17:35:00.000Z",
      endedAt: "2026-09-23T22:35:00.000Z",
      durationMinutes: 300,
      description: "Integración del HTML al WP local",
      deletedAt: null,
      task: { title: "Integracion de frontend a WP", project: "Rediseño Web + SEO Solfium" },
    }],
    "2026-09-23",
    "Ayer",
  );
  if (!listed.includes("11:35–16:35") || !listed.includes("Integracion de frontend a WP")) die(`self-check: día\n${listed}`);
  if (!dayReport([], "2026-09-24", "Hoy").includes("Sin registros")) die("self-check: día vacío");
  console.log("ok");
}

async function main() {
  if (flag("self-check")) {
    selfCheck();
    return;
  }
  const { email, password } = loadEnv();
  const jar = new Jar();
  await login(jar, email, password);

  if (flag("proyectos")) {
    console.log(fmtProjects(await tasksOf(jar)));
    return;
  }

  if (flag("tareas")) {
    const proyecto = arg("proyecto");
    if (!proyecto) die("Pasa --proyecto con --tareas");
    const pq = norm(proyecto);
    const all = await tasksOf(jar);
    const list = all.filter((t) => norm(projectHay(t)).includes(pq));
    if (list.length === 0) die(`Ningún proyecto coincide con "${proyecto}":\n${fmtProjects(all)}`, 2);
    console.log(fmtTasks(list));
    return;
  }

  if (flag("faltan")) {
    const monday = mondayOf(arg("fecha") || todayMexico());
    const entries = await entriesBetween(jar, monday, addDaysYmd(monday, 6));
    console.log(weekReport(entries, monday));
    return;
  }

  if (flag("hoy") || flag("ayer")) {
    if (flag("hoy") && flag("ayer")) die("Pasa --hoy o --ayer, no las dos");
    const ymd = flag("ayer") ? addDaysYmd(todayMexico(), -1) : todayMexico();
    const entries = await entriesBetween(jar, addDaysYmd(ymd, -1), addDaysYmd(ymd, 1));
    console.log(dayReport(entries, ymd, flag("ayer") ? "Ayer" : "Hoy"));
    return;
  }

  const inicio = arg("inicio");
  const fin = arg("fin");
  const horas = arg("horas");
  const desc = arg("desc");
  const proyecto = arg("proyecto");
  const tarea = arg("tarea");
  if (!inicio || (!fin && !horas) || !proyecto || !tarea) {
    die("Faltan datos. Necesito --inicio, --proyecto, --tarea y --fin o --horas. La descripción y la fecha son opcionales.");
  }
  if (fin && horas) die("Pasa --fin o --horas, no las dos");
  const fecha = arg("fecha") || todayMexico();
  const startedLocal = toLocal(fecha, inicio);
  const endedLocal = fin ? toLocal(fecha, fin) : addMinutes(startedLocal, parseHoras(horas));
  const startMs = new Date(`${startedLocal}:00${OFFSET}`).getTime();
  const endMs = new Date(`${endedLocal}:00${OFFSET}`).getTime();
  if (endMs <= startMs) die("La hora fin tiene que ser después de la hora inicio");

  const task = pick(await tasksOf(jar), proyecto, tarea);
  const hits = crossing(await entriesBetween(jar, addDaysYmd(startedLocal.slice(0, 10), -1), addDaysYmd(endedLocal.slice(0, 10), 1)), startMs, endMs);
  const cruce = hits.map((e) => {
    const from = mexicoClock(new Date(e.startedAt));
    const to = mexicoClock(new Date(e.endedAt));
    const note = e.description ? ` · ${e.description}` : "";
    return `${dayLabel(mexicoYmd(new Date(e.startedAt)))} ${from}–${to} · ${e.task?.title || "sin tarea"} · ${projectName(e)}${note}`;
  });
  const summary = {
    proyecto: task.project.name,
    tarea: task.title,
    inicio: startedLocal,
    fin: endedLocal,
    desc: desc.trim() || null,
    cruce,
  };
  if (flag("dry-run")) {
    console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2));
    return;
  }
  const res = await jar.fetch(`${BASE}/api/time-entries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      taskId: task.id,
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      description: summary.desc,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) die(body.error || `No se guardó (${res.status})`);
  console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
  if (cruce.length) console.log(`Aviso: se empalma con\n${cruce.map((line) => `- ${line}`).join("\n")}`);
}

main().catch((err) => {
  const cause = err.cause?.code || err.cause?.message;
  console.error(cause ? `${err.message} (${cause})` : err.message || String(err));
  process.exit(err.exitCode || 1);
});

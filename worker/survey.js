// Flowlytix satisfaction survey (survey.flowlytix.co, one page for every Flowlytix product).
// POST /api/survey            -> stores one answer in the D1 database bound as SURVEY_DB. Never any money figures.
// GET  /api/survey/results    -> owner accounts only: every answer as JSON, or ?format=csv
// The page is survey.html. The owner reads answers in the Money app (Setup › Survey results; money.flowlytix.co/survey-results).
// Products the survey accepts (matches PRODUCTS in survey.html). Add a new product's id here, e.g. "education".
const PRODUCTS = new Set(["money", "website", "other"]);
const HELP_KEY = /^[a-z0-9-]{1,24}$/; // question 5 choices are defined per product in survey.html
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: {
  "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
const int = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };

const SCHEMA = `CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, product TEXT NOT NULL, page TEXT, plan TEXT, lang TEXT, device TEXT,
  csat INTEGER, nps INTEGER, ease INTEGER, helps TEXT, hard TEXT, improve TEXT, email TEXT)`;
let ready = false;
async function db(env) {
  if (!env.SURVEY_DB) return null;
  if (!ready) { await env.SURVEY_DB.prepare(SCHEMA).run(); ready = true; }
  return env.SURVEY_DB;
}

// Checks one answer and keeps only known fields; returns null when it isn't a real answer.
export function cleanAnswer(b) {
  if (!b || typeof b !== "object" || b.website_url) return null; // website_url is a hidden field only bots fill in
  const csat = int(b.csat, 1, 5), nps = int(b.nps, 0, 10), ease = int(b.ease, 1, 5);
  if (csat === null && nps === null && ease === null) return null;
  const product = PRODUCTS.has(b.product) ? b.product : "other";
  const helps = Array.isArray(b.helps) ? [...new Set(b.helps.filter(h => typeof h === "string" && HELP_KEY.test(h)))].slice(0, 15).join(",") : "";
  const email = str(b.email, 120);
  return { product, page: str(b.page, 40), plan: str(b.plan, 12), lang: b.lang === "th" ? "th" : "en", device: b.device === "phone" ? "phone" : "computer",
    csat, nps, ease, helps, hard: str(b.hard, 1000), improve: str(b.improve, 1000), email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "" };
}

export async function surveySubmit(request, env) {
  if (request.method !== "POST") return json(405, { error: "method" });
  const len = Number(request.headers.get("Content-Length") || 0); if (len > 8000) return json(413, { error: "too_big" });
  let b; try { b = await request.json(); } catch { return json(400, { error: "json" }); }
  const a = cleanAnswer(b); if (!a) return json(400, { error: "answer" });
  const d = await db(env); if (!d) return json(503, { error: "survey_not_configured" });
  await d.prepare("INSERT INTO responses (created_at,product,page,plan,lang,device,csat,nps,ease,helps,hard,improve,email) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(new Date().toISOString(), a.product, a.page, a.plan, a.lang, a.device, a.csat, a.nps, a.ease, a.helps, a.hard, a.improve, a.email).run();
  return json(200, { ok: true });
}

const COLS = ["id", "created_at", "product", "page", "plan", "lang", "device", "csat", "nps", "ease", "helps", "hard", "improve", "email"];
const csvCell = v => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export async function surveyResults(request, env, isOwner) {
  if (request.method !== "GET") return json(405, { error: "method" });
  if (!isOwner) return json(401, { error: "owner_only" });
  const d = await db(env); if (!d) return json(503, { error: "survey_not_configured" });
  const { results } = await d.prepare(`SELECT ${COLS.join(",")} FROM responses ORDER BY id DESC LIMIT 5000`).all();
  if (new URL(request.url).searchParams.get("format") === "csv")
    return new Response("﻿" + [COLS.join(","), ...results.map(r => COLS.map(c => csvCell(r[c])).join(","))].join("\n"), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="flowlytix-survey-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  return json(200, { rows: results });
}

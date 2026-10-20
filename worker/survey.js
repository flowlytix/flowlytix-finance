// Flowlytix satisfaction survey (survey.flowlytix.co, one page for every Flowlytix product).
// POST /api/survey             -> stores one answer in the D1 database bound as SURVEY_DB. Never any money figures.
// GET  /api/survey/ticket      -> signed-in people only: a signed ticket the app adds to its survey links, so their rating
//                                 counts as "verified" (the public rating uses verified answers only).
// GET  /api/survey/results     -> owner accounts only: every answer as JSON, or ?format=csv
// POST /api/survey/review      -> owner accounts only: {id, status: "approved" | "hidden"} for a review
// GET  /api/survey/public      -> anyone (flowlytix.co, the app, /pro): the rating once 10+ verified people answered, and
//                                 approved reviews that the writer agreed to publish. Name and text only, never email.
// The page is survey.html. The owner reads answers in the Money app (Setup › Survey results; money.flowlytix.co/survey-results).
// Products the survey accepts (matches PRODUCTS in survey.html). Add a new product's id here, e.g. "education".
const PRODUCTS = new Set(["money", "website", "other"]);
const HELP_KEY = /^[a-z0-9-]{1,24}$/; // question 5 choices are defined per product in survey.html
export const MIN_RATINGS = 10; // the public rating stays hidden until this many verified people have rated
const TICKET_DAYS = 14;
const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: {
  "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...extra } });
const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
const int = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };

const SCHEMA = `CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, product TEXT NOT NULL, page TEXT, plan TEXT, lang TEXT, device TEXT,
  csat INTEGER, nps INTEGER, ease INTEGER, helps TEXT, hard TEXT, improve TEXT, email TEXT)`;
// columns added later; ALTER TABLE fails harmlessly when a column already exists
const ADDED = ["verified INTEGER DEFAULT 0", "uid TEXT", "review TEXT", "review_name TEXT", "review_ok INTEGER DEFAULT 0", "review_status TEXT"];
let ready = false;
async function db(env) {
  if (!env.SURVEY_DB) return null;
  if (!ready) { await env.SURVEY_DB.prepare(SCHEMA).run(); for (const c of ADDED) { try { await env.SURVEY_DB.prepare(`ALTER TABLE responses ADD COLUMN ${c}`).run(); } catch (e) {} } ready = true; }
  return env.SURVEY_DB;
}

// ---- tickets: prove an answer came from a signed-in person, without sending who they are ----
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ticketKey = env => String(env.SURVEY_SECRET || env.GOOGLE_CLIENT_SECRET || "");
async function hmac(key, text) { const k = await crypto.subtle.importKey("raw", enc.encode("flowlytix-survey:" + key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", k, enc.encode(text))); }
async function sha(text) { return b64u(await crypto.subtle.digest("SHA-256", enc.encode(text))).slice(0, 22); }
export async function surveyTicket(request, env, email, isOwner) {
  if (request.method !== "GET") return json(405, { error: "method" });
  if (!email) return json(401, { error: "auth" });
  const key = ticketKey(env); if (!key) return json(503, { error: "survey_not_configured" });
  // the owners' own answers never count towards the public rating
  const body = `${await sha("uid:" + key + ":" + email)}.${Math.floor(Date.now() / 1000) + TICKET_DAYS * 86400}.${isOwner ? 0 : 1}`;
  return json(200, { ticket: body + "." + await hmac(key, body) });
}
async function readTicket(t, env) {
  const key = ticketKey(env), p = String(t || "").split("."); if (!key || p.length !== 4) return null;
  const body = p.slice(0, 3).join("."); if (await hmac(key, body) !== p[3]) return null;
  if (!(+p[1] > Date.now() / 1000)) return null;
  return { uid: p[0], counts: p[2] === "1" };
}

// Checks one answer and keeps only known fields; returns null when it isn't a real answer.
export function cleanAnswer(b) {
  if (!b || typeof b !== "object" || b.website_url) return null; // website_url is a hidden field only bots fill in
  const csat = int(b.csat, 1, 5), nps = int(b.nps, 0, 10), ease = int(b.ease, 1, 5);
  if (csat === null && nps === null && ease === null) return null;
  const product = PRODUCTS.has(b.product) ? b.product : "other";
  const helps = Array.isArray(b.helps) ? [...new Set(b.helps.filter(h => typeof h === "string" && HELP_KEY.test(h)))].slice(0, 15).join(",") : "";
  const email = str(b.email, 120), review = str(b.review, 600), reviewName = str(b.review_name, 60);
  return { product, page: str(b.page, 40), plan: str(b.plan, 12), lang: b.lang === "th" ? "th" : "en", device: b.device === "phone" ? "phone" : "computer",
    csat, nps, ease, helps, hard: str(b.hard, 1000), improve: str(b.improve, 1000), email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
    review, review_name: reviewName, review_ok: review && reviewName && b.review_ok === true ? 1 : 0 };
}

export async function surveySubmit(request, env) {
  if (request.method !== "POST") return json(405, { error: "method" });
  const len = Number(request.headers.get("Content-Length") || 0); if (len > 10000) return json(413, { error: "too_big" });
  let b; try { b = await request.json(); } catch { return json(400, { error: "json" }); }
  const a = cleanAnswer(b); if (!a) return json(400, { error: "answer" });
  const d = await db(env); if (!d) return json(503, { error: "survey_not_configured" });
  const tk = await readTicket(b.ticket, env);
  await d.prepare("INSERT INTO responses (created_at,product,page,plan,lang,device,csat,nps,ease,helps,hard,improve,email,verified,uid,review,review_name,review_ok,review_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(new Date().toISOString(), a.product, a.page, a.plan, a.lang, a.device, a.csat, a.nps, a.ease, a.helps, a.hard, a.improve, a.email,
      tk && tk.counts ? 1 : 0, tk ? tk.uid : "", a.review, a.review_name, a.review_ok, a.review ? "pending" : "").run();
  return json(200, { ok: true });
}

const COLS = ["id", "created_at", "product", "page", "plan", "lang", "device", "csat", "nps", "ease", "helps", "hard", "improve", "email", "verified", "review", "review_name", "review_ok", "review_status"];
const csvCell = v => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export async function surveyResults(request, env, isOwner) {
  if (request.method !== "GET") return json(405, { error: "method" });
  if (!isOwner) return json(401, { error: "owner_only" });
  const d = await db(env); if (!d) return json(503, { error: "survey_not_configured" });
  const { results } = await d.prepare(`SELECT ${COLS.join(",")} FROM responses ORDER BY id DESC LIMIT 5000`).all();
  if (new URL(request.url).searchParams.get("format") === "csv")
    return new Response("﻿" + [COLS.join(","), ...results.map(r => COLS.map(c => csvCell(r[c])).join(","))].join("\n"), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="flowlytix-survey-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  const rating = {}; for (const p of PRODUCTS) rating[p] = await ratingFor(d, p);
  return json(200, { rows: results, rating, minRatings: MIN_RATINGS });
}

export async function surveyReview(request, env, isOwner) {
  if (request.method !== "POST") return json(405, { error: "method" });
  if (!isOwner) return json(401, { error: "owner_only" });
  let b; try { b = await request.json(); } catch { return json(400, { error: "json" }); }
  const id = int(b.id, 1, 1e9), status = ["approved", "hidden", "pending"].includes(b.status) ? b.status : null;
  if (!id || !status) return json(400, { error: "review" });
  const d = await db(env); if (!d) return json(503, { error: "survey_not_configured" });
  const r = await d.prepare("SELECT review_ok, product FROM responses WHERE id = ?").bind(id).first();
  if (!r) return json(404, { error: "not_found" });
  if (status === "approved" && !r.review_ok) return json(400, { error: "no_consent" }); // only reviews the writer agreed to publish
  await d.prepare("UPDATE responses SET review_status = ? WHERE id = ?").bind(status, id).run();
  await publicCacheClear(r.product); // shows on the website straight away
  return json(200, { ok: true });
}

// average satisfaction of verified people: each person's latest answer counts once
async function ratingFor(d, product) {
  const { results } = await d.prepare(`SELECT csat FROM responses r WHERE product = ? AND verified = 1 AND csat IS NOT NULL AND uid <> ''
      AND id = (SELECT MAX(id) FROM responses x WHERE x.uid = r.uid AND x.product = r.product AND x.verified = 1 AND x.csat IS NOT NULL)`).bind(product).all();
  const n = results.length, avg = n ? results.reduce((s, x) => s + x.csat, 0) / n : 0;
  return { count: n, average: n ? Math.round(avg * 10) / 10 : null };
}

export async function surveyPublic(request, env) {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET", "Cache-Control": "public, max-age=3600" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET") return json(405, { error: "method" });
  const url = new URL(request.url), product = PRODUCTS.has(url.searchParams.get("product")) ? url.searchParams.get("product") : "money";
  const cache = typeof caches !== "undefined" ? caches.default : null, ck = new Request(`https://survey-cache.flowlytix.co/public/${product}`);
  if (cache) { const hit = await cache.match(ck); if (hit) return new Response(hit.body, { status: 200, headers: { "Content-Type": "application/json", ...cors } }); }
  const d = await db(env); if (!d) return json(503, { error: "survey_not_configured" }, cors);
  const r = await ratingFor(d, product);
  const { results } = await d.prepare(`SELECT review, review_name, csat, created_at, lang FROM responses WHERE product = ? AND review_status = 'approved' AND review_ok = 1 ORDER BY id DESC LIMIT 12`).bind(product).all();
  const body = { product, rating: r.count >= MIN_RATINGS ? r : null,
    reviews: results.map(x => ({ text: x.review, name: x.review_name, stars: x.csat, date: String(x.created_at).slice(0, 10), lang: x.lang })) };
  const res = json(200, body, cors); if (cache) await cache.put(ck, res.clone());
  return res;
}
export const publicCacheClear = async product => { try { if (typeof caches !== "undefined") await caches.default.delete(new Request(`https://survey-cache.flowlytix.co/public/${product}`)); } catch (e) {} };

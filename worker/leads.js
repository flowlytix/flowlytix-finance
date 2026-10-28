// Free template sign-ups (money.flowlytix.co/template): the email someone gives to download the "Yearly bills" template.
// POST /api/template/lead          -> anyone: {email, news: true|false, lang, utm_source, utm_campaign} -> saves it, answers with the file's address.
//                                     website_url is a hidden field only bots fill in: they get the same answer, nothing is saved.
// GET  /api/template/leads         -> owner accounts only: every sign-up as JSON, or ?format=csv (Setup › Template sign-ups in the app)
// POST /api/template/leads/delete  -> owner accounts only: {id}, for a PDPA deletion request
// Stored in the survey's D1 database (SURVEY_DB), table template_leads, created on first use. Never any money figures.
// Thai PDPA: news and tips only with the separate tick ("news" = 1, with the date and the wording they agreed to). One row per
// email; signing up again keeps the first date and source and takes the latest tick as the current choice.
export const TEMPLATE_URL = "/templates/flowlytix-yearly-bills.xlsx";
export const NEWS_TEXT = "news-tips-v1"; // "I'd like to receive news and tips from Flowlytix" (change the version when the wording changes)
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: {
  "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
const EMAIL = /^[^\s@"<>,;]+@[^\s@"<>,;]+\.[^\s@"<>,;]{2,}$/;

const SCHEMA = `CREATE TABLE IF NOT EXISTS template_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, news INTEGER NOT NULL DEFAULT 0, news_at TEXT, news_text TEXT,
  lang TEXT, template TEXT, utm_source TEXT, utm_campaign TEXT, created_at TEXT NOT NULL, last_at TEXT NOT NULL, downloads INTEGER NOT NULL DEFAULT 1)`;
let ready = false;
async function db(env) {
  if (!env.SURVEY_DB) return null;
  if (!ready) { await env.SURVEY_DB.prepare(SCHEMA).run(); ready = true; }
  return env.SURVEY_DB;
}

// Checks one sign-up and keeps only known fields; null when the email isn't usable.
export function cleanLead(b) {
  if (!b || typeof b !== "object") return null;
  const email = str(b.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return null;
  const utm = v => str(v, 60).replace(/[^\w.\-+ ]/g, "");
  return { email, news: b.news === true ? 1 : 0, lang: b.lang === "th" ? "th" : "en", utm_source: utm(b.utm_source), utm_campaign: utm(b.utm_campaign) };
}

// 5 sign-ups a minute per connection (Cloudflare's rate limiter, LEAD_LIMIT in wrangler.jsonc), and per email address
async function limited(env, key) { try { return !!(env.LEAD_LIMIT && !(await env.LEAD_LIMIT.limit({ key })).success); } catch (e) { return false; } }

export async function leadSubmit(request, env) {
  if (request.method !== "POST") return json(405, { error: "method" });
  const len = Number(request.headers.get("Content-Length") || 0); if (len > 4000) return json(413, { error: "too_big" });
  let b; try { b = await request.json(); } catch { return json(400, { error: "json" }); }
  if (b && b.website_url) return json(200, { ok: true, url: TEMPLATE_URL }); // a bot: looks the same, nothing saved
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (await limited(env, "ip:" + ip)) return json(429, { error: "slow_down" });
  const l = cleanLead(b); if (!l) return json(400, { error: "email" });
  if (await limited(env, "email:" + l.email)) return json(429, { error: "slow_down" });
  const d = await db(env); if (!d) return json(503, { error: "not_configured" });
  const now = new Date().toISOString();
  await d.prepare(`INSERT INTO template_leads (email,news,news_at,news_text,lang,template,utm_source,utm_campaign,created_at,last_at,downloads) VALUES (?,?,?,?,?,?,?,?,?,?,1)
    ON CONFLICT(email) DO UPDATE SET news = excluded.news, news_at = excluded.news_at, news_text = excluded.news_text, lang = excluded.lang,
      last_at = excluded.last_at, downloads = downloads + 1`)
    .bind(l.email, l.news, now, l.news ? NEWS_TEXT : "", l.lang, "yearly-bills", l.utm_source, l.utm_campaign, now, now).run();
  return json(200, { ok: true, url: TEMPLATE_URL });
}

const COLS = ["id", "created_at", "email", "news", "news_at", "news_text", "lang", "template", "utm_source", "utm_campaign", "last_at", "downloads"];
// a cell starting with = + - @ would run as a formula in Excel, so it gets a leading '
const csvCell = v => { let s = v === null || v === undefined ? "" : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export async function leadList(request, env, isOwner) {
  if (request.method !== "GET") return json(405, { error: "method" });
  if (!isOwner) return json(401, { error: "owner_only" });
  const d = await db(env); if (!d) return json(503, { error: "not_configured" });
  const { results } = await d.prepare(`SELECT ${COLS.join(",")} FROM template_leads ORDER BY id DESC LIMIT 10000`).all();
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const head = COLS.map(c => c === "news" ? "news_ok" : c);
    return new Response("﻿" + [head.join(","), ...results.map(r => COLS.map(c => c === "news" ? (r.news ? "yes" : "no") : csvCell(r[c])).join(","))].join("\n"), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="flowlytix-template-signups-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  }
  return json(200, { rows: results });
}

export async function leadDelete(request, env, isOwner) {
  if (request.method !== "POST") return json(405, { error: "method" });
  if (!isOwner) return json(401, { error: "owner_only" });
  let b; try { b = await request.json(); } catch { return json(400, { error: "json" }); }
  const id = Number(b && b.id); if (!Number.isInteger(id) || id < 1) return json(400, { error: "id" });
  const d = await db(env); if (!d) return json(503, { error: "not_configured" });
  const r = await d.prepare("SELECT id FROM template_leads WHERE id = ?").bind(id).first();
  if (!r) return json(404, { error: "not_found" });
  await d.prepare("DELETE FROM template_leads WHERE id = ?").bind(id).run();
  return json(200, { ok: true });
}

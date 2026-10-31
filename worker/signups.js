// Anonymous sign-up log: when a new person creates their Flowlytix Money Sheet, and which channel brought them.
// POST /api/signup-log        -> signed-in people only (Google access token, like /api/licence), once per new Sheet (the app guards it).
//                                {utm_source, utm_medium, utm_campaign, utm_content, referrer_domain, has_fbclid, lang, device, door}
// GET  /api/signup-log/stats  -> owner accounts only: totals, per day (Bangkok time, last 30 days), by source / medium / content,
//                                latest 20. Owner and test rows are left out unless ?owners=1.
// PRIVACY: never stored: email, name, Google ID, Sheet ID, IP address, user agent, or any money figure. The email is read only
// to set owner = 1 (owner accounts and PRO_EMAILS, so test sign-ups can be filtered out), then dropped. The rate limiter keys
// are a one-way hash and live only in Cloudflare's limiter memory.
// Stored in the survey's D1 database (SURVEY_DB), table signups, created on first use (like template_leads).
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: {
  "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });

const SCHEMA = `CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, product TEXT NOT NULL DEFAULT 'money',
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, referrer_domain TEXT,
  has_fbclid INTEGER NOT NULL DEFAULT 0, lang TEXT, device TEXT, owner INTEGER NOT NULL DEFAULT 0, door TEXT)`;
let ready = false;
async function db(env) {
  if (!env.SURVEY_DB) return null;
  if (!ready) {
    await env.SURVEY_DB.prepare(SCHEMA).run();
    // door (money | work) came later: add the column to a table made before it (fails harmlessly once it exists)
    try { await env.SURVEY_DB.prepare("ALTER TABLE signups ADD COLUMN door TEXT").run(); } catch (e) {}
    ready = true;
  }
  return env.SURVEY_DB;
}

// Every field: text only, trimmed, at most 64 characters, only letters, digits and . _ - + (spaces become _)
const tag = v => String(v ?? "").trim().slice(0, 64).replace(/\s+/g, "_").replace(/[^\w.\-+]/g, "");
// "https://www.Facebook.com/x" or "m.facebook.com" -> "facebook.com" style host name only, never a path or query
export function domainOf(v) {
  let h = String(v ?? "").trim().toLowerCase();
  try { if (h.includes("/")) h = new URL(h.includes("://") ? h : "https://" + h).hostname; } catch { return ""; }
  h = h.replace(/^www\./, "").slice(0, 64);
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(h) && h.includes(".") ? h : "";
}
export function cleanSignup(b) {
  b = b && typeof b === "object" ? b : {};
  return {
    utm_source: tag(b.utm_source), utm_medium: tag(b.utm_medium), utm_campaign: tag(b.utm_campaign), utm_content: tag(b.utm_content),
    referrer_domain: domainOf(b.referrer_domain), has_fbclid: b.has_fbclid === true ? 1 : 0,
    lang: b.lang === "th" ? "th" : "en", device: b.device === "mobile" ? "mobile" : "desktop",
    door: b.door === "work" ? "work" : "money",
  };
}

async function hashKey(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("flx-signup|" + s));
  return [...new Uint8Array(d)].slice(0, 12).map(x => x.toString(16).padStart(2, "0")).join("");
}
// Cloudflare's rate limiter (LEAD_LIMIT in wrangler.jsonc, 5 a minute per key): per connection and per Google account
async function limited(env, key) { try { return !!(env.LEAD_LIMIT && !(await env.LEAD_LIMIT.limit({ key: "su:" + await hashKey(key) })).success); } catch (e) { return false; } }

// email: the verified Google email (or null); isOwnerish(email): owner account or PRO_EMAILS
export async function signupLog(request, env, email, isOwnerish) {
  if (request.method !== "POST") return json(405, { error: "method" });
  if (!email) return json(401, { error: "auth" });
  if (await limited(env, "ip:" + (request.headers.get("CF-Connecting-IP") || "unknown")) || await limited(env, "acct:" + email)) return json(429, { error: "slow_down" });
  const txt = await request.text(); if (txt.length > 2000) return json(413, { error: "too_big" });
  let b; try { b = JSON.parse(txt); } catch { return json(400, { error: "json" }); }
  const s = cleanSignup(b), owner = isOwnerish(email) ? 1 : 0;
  const d = await db(env); if (!d) return json(503, { error: "not_configured" });
  await d.prepare(`INSERT INTO signups (created_at,product,utm_source,utm_medium,utm_campaign,utm_content,referrer_domain,has_fbclid,lang,device,owner,door)
    VALUES (?,'money',?,?,?,?,?,?,?,?,?,?)`)
    .bind(new Date().toISOString(), s.utm_source, s.utm_medium, s.utm_campaign, s.utm_content, s.referrer_domain, s.has_fbclid, s.lang, s.device, owner, s.door).run();
  return json(200, { ok: true });
}

// where they came from, in one word: the utm_source, else the website that sent them, else "direct"
const SRC = "COALESCE(NULLIF(utm_source,''), NULLIF(referrer_domain,''), 'direct')";
const BKK = "date(created_at, '+7 hours')";
export async function signupStats(request, env, isOwner) {
  if (request.method !== "GET") return json(405, { error: "method" });
  if (!isOwner) return json(401, { error: "owner_only" });
  const d = await db(env); if (!d) return json(503, { error: "not_configured" });
  const withOwners = new URL(request.url).searchParams.get("owners") === "1", W = withOwners ? "" : "WHERE owner = 0";
  const one = async sql => (await d.prepare(sql).all()).results;
  const total = (await d.prepare(`SELECT COUNT(*) AS n FROM signups ${W}`).first()).n;
  const hidden = withOwners ? 0 : (await d.prepare("SELECT COUNT(*) AS n FROM signups WHERE owner = 1").first()).n;
  // the last 30 days in Bangkok time, oldest first, days with no sign-ups as 0
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), days = [];
  for (let i = 29; i >= 0; i--) days.push(new Date(Date.parse(today) - i * 864e5).toISOString().slice(0, 10));
  const per = Object.fromEntries((await one(`SELECT ${BKK} AS day, COUNT(*) AS n FROM signups WHERE ${BKK} >= '${days[0]}' ${withOwners ? "" : "AND owner = 0"} GROUP BY day`)).map(r => [r.day, r.n]));
  const by = col => one(`SELECT ${col} AS k, COUNT(*) AS n FROM signups ${W} GROUP BY k ORDER BY n DESC, k LIMIT 30`);
  const latest = await one(`SELECT created_at, ${SRC} AS source, utm_medium, device, owner, door FROM signups ${W} ORDER BY id DESC LIMIT 20`);
  return json(200, {
    total, ownerRowsHidden: hidden, withOwners,
    perDay: days.map(day => ({ day, n: per[day] || 0 })),
    byDoor: await by("COALESCE(NULLIF(door,''), 'money')"), bySource: await by(SRC), byMedium: await by("COALESCE(NULLIF(utm_medium,''), '(none)')"), byContent: await by("COALESCE(NULLIF(utm_content,''), '(none)')"),
    latest,
  });
}

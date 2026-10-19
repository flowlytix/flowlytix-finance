// Fund prices for "Track a fund" on Net worth accounts.
// GET /api/funds/nav?f=PROJ:CLASS,PROJ:CLASS[&on=YYYY-MM-DD]  ->  { on, prices: { "PROJ:CLASS": {nav, date} | null } }
// Returns each fund's latest official NAV (SEC Thailand Open API) on or before `on` (default: today, Bangkok time).
// It receives fund codes only: never units, amounts or values. Answers are shared by every user through
// Cloudflare's cache, so each fund costs at most one SEC call every few hours.
const SEC = "https://api.sec.or.th/v2/fund/daily-info/nav";
const MAX_FUNDS = 15;            // Workers Free allows 50 outside calls per request: 1 sign-in check + 15 funds × up to 3 pages
const LOOKBACK_DAYS = 14;        // long enough to cover holidays like Songkran
const ID_RE = /^([A-Z]\d{4}_\d{4}):([A-Za-z0-9 ()\-.&/+]{1,40})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const bangkokToday = (now = Date.now()) => new Date(now + 7 * 3600e3).toISOString().slice(0, 10);
const minusDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") - n * 864e5).toISOString().slice(0, 10);
const json = (status, body, maxAge = 0) => new Response(JSON.stringify(body), { status, headers: {
  "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" } });

// Newest NAV for one share class on or before `on`. null if the SEC has none in the last two weeks.
async function navFor(proj, cls, on, key) {
  const q = new URLSearchParams({ proj_id: proj, start_nav_date: minusDays(on, LOOKBACK_DAYS), end_nav_date: on, page_size: "100" });
  if (cls !== "main") q.set("fund_class_name", cls);
  let best = null, cursor = null;
  for (let page = 0; page < 3; page++) {
    if (cursor) q.set("next_cursor", cursor);
    const r = await fetch(SEC + "?" + q, { headers: { "Ocp-Apim-Subscription-Key": key, "Cache-Control": "no-cache" } });
    if (r.status === 204) break;
    if (!r.ok) throw new Error("sec_" + r.status);
    const j = await r.json();
    for (const it of j.items || []) {
      if (String(it.fund_class_name || "").toLowerCase() !== cls.toLowerCase()) continue;
      const nav = Number(it.last_val);
      if (!(nav > 0) || !DATE_RE.test(it.nav_date || "") || it.nav_date > on) continue;
      if (!best || it.nav_date > best.date) best = { nav, date: it.nav_date };
    }
    cursor = j.next_cursor;
    if (!cursor) break;
  }
  return best;
}

// One fund through the shared cache. Today's answer is kept 3 hours (NAVs arrive in the evening); past dates 30 days.
async function cachedNav(proj, cls, on, today, key) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const ck = new Request(`https://funds-cache.flowlytix.co/nav/${encodeURIComponent(proj)}/${encodeURIComponent(cls)}/${on}`);
  if (cache) { const hit = await cache.match(ck); if (hit) return (await hit.json()).price; }
  const price = await navFor(proj, cls, on, key);
  if (cache) await cache.put(ck, json(200, { price }, on >= today ? 3 * 3600 : 30 * 86400));
  return price;
}

export async function fundsNav(request, env, verifiedEmail) {
  if (request.method !== "GET") return json(405, { error: "method" });
  if (!verifiedEmail) return json(401, { error: "auth" });
  if (!env.SEC_API_KEY) return json(503, { error: "funds_not_configured" });
  const url = new URL(request.url), today = bangkokToday();
  const on = url.searchParams.get("on") || today;
  if (!DATE_RE.test(on) || on > today || on < "2000-01-01") return json(400, { error: "date" });
  const ids = [...new Set(String(url.searchParams.get("f") || "").split(",").map(s => s.trim()).filter(Boolean))];
  if (!ids.length || ids.length > MAX_FUNDS) return json(400, { error: "funds", max: MAX_FUNDS });
  const parsed = ids.map(id => [id, id.match(ID_RE)]);
  if (parsed.some(([, m]) => !m)) return json(400, { error: "fund_id" });
  const prices = {};
  await Promise.all(parsed.map(async ([id, m]) => {
    try { prices[id] = await cachedNav(m[1], m[2], on, today, env.SEC_API_KEY); }
    catch (e) { console.log("fund nav error", id, e.message); prices[id] = null; } // one fund failing never breaks the others
  }));
  return json(200, { on, prices });
}

// Thai gold price for Gold accounts on Net worth.
// GET /api/gold  ->  { barBuy, barSell, ornBuy, ornSell, asOf, date }  (baht per baht-weight, 96.5% gold)
// From the Gold Traders Association (สมาคมค้าทองคำ), the price Thai gold shops use. Public prices only: nothing about
// the person is sent or received. One answer is shared by everyone through Cloudflare's cache for 10 minutes.
const SRC = "https://classic.goldtraders.or.th/default.aspx";
const ID = "DetailPlace_uc_goldprices1_lbl";
const CACHE_S = 600;

const json = (status, body, maxAge = 0) => new Response(JSON.stringify(body), { status, headers: {
  "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" } });

// text inside <span id="...lblXxx">…</span>, tags removed
const field = (html, name) => { const m = html.match(new RegExp(`id="${ID}${name}"[^>]*>([\\s\\S]*?)</span>`, "i"));
  return m ? m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim() : ""; };
const price = s => { const n = Number(String(s).replace(/[^\d.]/g, "")); return n > 1000 && n < 1e6 ? n : null; };

// "26/10/2569 เวลา 09:31 น. (ครั้งที่ 3)" -> 2026-10-26 (Buddhist year − 543)
export function gtaDate(s) { const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) return null;
  let y = +m[3]; if (y > 2400) y -= 543; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }

export function parseGold(html) {
  const p = { barBuy: price(field(html, "BLBuy")), barSell: price(field(html, "BLSell")), ornBuy: price(field(html, "OMBuy")), ornSell: price(field(html, "OMSell")) };
  const asOf = field(html, "AsTime");
  if (!p.barBuy || !p.barSell || p.barBuy > p.barSell) return null; // page changed or half-loaded: never pass on a wrong number
  return { ...p, asOf, date: gtaDate(asOf) };
}

export async function goldNow(request) {
  if (request.method !== "GET") return json(405, { error: "method" });
  const cache = typeof caches !== "undefined" ? caches.default : null, ck = new Request("https://gold-cache.flowlytix.co/latest");
  if (cache) { const hit = await cache.match(ck); if (hit) return json(200, await hit.json(), CACHE_S); }
  const r = await fetch(SRC, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FlowlytixMoney/1.0; +https://money.flowlytix.co)", "Accept-Language": "th,en" } });
  if (!r.ok) return json(502, { error: "source_" + r.status });
  const g = parseGold(await r.text());
  if (!g) return json(502, { error: "parse" });
  if (cache) await cache.put(ck, json(200, g, CACHE_S));
  return json(200, g, CACHE_S);
}

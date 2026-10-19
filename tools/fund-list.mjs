// Builds fund-list.json for the "Track a fund" search box from the SEC Thailand Open API (public data).
// Run: SEC_API_KEY=... node tools/fund-list.mjs   (about 3–5 minutes; the weekly GitHub Action runs it).
// Keeps funds that are open now (fund_status "Registered" or "IPO"), one row per share class:
// [id "PROJ:CLASS", code people see, name EN, name TH, fund company EN]. Single-class funds are class "main".
import { writeFileSync } from "node:fs";

const KEY = process.env.SEC_API_KEY;
if (!KEY) { console.error("Set SEC_API_KEY first."); process.exit(1); }
const URL0 = "https://api.sec.or.th/v2/fund/general-info/profiles";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function page(cursor) {
  const u = URL0 + "?page_size=100" + (cursor ? "&next_cursor=" + encodeURIComponent(cursor) : "");
  for (let tryN = 1; ; tryN++) {
    try {
      // this address answers only when Content-Type is sent (others don't need it)
      const r = await fetch(u, { headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Type": "application/json", "Cache-Control": "no-cache" } });
      if (r.status === 204) return { items: [] };
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) { if (tryN >= 5) throw e; await sleep(2000 * tryN); }
  }
}

const clean = s => String(s || "").replace(/\s+/g, " ").trim();
const rows = new Map(); let cursor = null, pages = 0, seen = 0;
do {
  const j = await page(cursor); pages++;
  for (const it of j.items || []) {
    seen++;
    if (!["Registered", "IPO"].includes(clean(it.fund_status))) continue;
    const cls = clean(it.fund_class_name) || "main", proj = clean(it.proj_id);
    if (!/^[A-Z]\d{4}_\d{4}$/.test(proj)) continue;
    const code = cls.toLowerCase() === "main" ? clean(it.proj_abbr_name) : cls;
    if (!code) continue;
    rows.set(proj + ":" + cls, [proj + ":" + cls, code, clean(it.proj_name_en), clean(it.proj_name_th), clean(it.comp_name_en)]);
  }
  cursor = j.next_cursor;
  if (pages % 20 === 0) console.log(`${pages} pages, ${seen} records, ${rows.size} open share classes`);
} while (cursor && pages < 2000);

const funds = [...rows.values()].sort((a, b) => a[1].localeCompare(b[1]));
writeFileSync(new URL("../fund-list.json", import.meta.url), JSON.stringify({ updated: new Date().toISOString().slice(0, 10), source: "SEC Thailand Open API", funds }) + "\n");
console.log(`Done: ${pages} pages, ${seen} records, ${funds.length} funds in fund-list.json`);

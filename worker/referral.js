// Discount codes and partners (owner, 10 Nov 2026). The agreed offer (CLAUDE.md › Codes, partners and referrals):
// - A code gives a NEW customer 20% off their first year, on the yearly or 2-year plan only (never monthly):
//   1 year = Stripe coupon flx-y1-20 (20% off the first payment); 2 years = flx-y2-10 (10% of the 2-year payment = 20% of its first year).
//   Both coupons are "repeating, 6 months", so they cover the first payment (straight away, or after the 30-day trial) and never a renewal.
// - Partner codes: the partner earns 25% of what the customer paid for their first year (2-year payment ÷ 2), once that payment is
//   past the 7-working-day refund window (REFUND_DAYS calendar days) and wasn't refunded. Paid by the owner by hand, from ฿300 owed.
// - Friend codes: the owner's friends and clients, discount only, no commission.
// - Member codes (part 2): paying members invite friends; 20% of a year off their next renewal per friend, at most 3.
// Only the code is stored with a sale (Stripe subscription metadata ref_code / ref_kind). Never who used it on our side.
import { cfg, stripe } from "./index.js";

export const CODE_RE = /^[A-Z0-9]{3,20}$/;
export const normCode = v => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
export const OFFER = { pct: 20, partnerPct: 25, minPayout: 300, memberCap: 3 };
export const REFUND_DAYS = 11; // 7 working days, with weekends and a public holiday
export const COUPONS = {
  year: { id: "flx-y1-20", percent_off: 20, name: "Code: 20% off your first year" },
  "2year": { id: "flx-y2-10", percent_off: 10, name: "Code: 20% off the first year of 2" },
};

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

let ready = false;
export async function refTables(db) {
  if (ready || !db) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS ref_codes (code TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT, created_at TEXT, active INTEGER NOT NULL DEFAULT 1)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS ref_payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, amount REAL NOT NULL, note TEXT, paid_at TEXT)").run();
  ready = true;
}
export async function findCode(db, code) {
  if (!db || !CODE_RE.test(code)) return null;
  await refTables(db);
  return await db.prepare("SELECT code, kind FROM ref_codes WHERE code = ? AND active = 1").bind(code).first();
}
// The two coupons are made on first use, so the owner sets nothing up in Stripe for them.
export async function ensureCoupon(c, billing) {
  const k = COUPONS[billing]; if (!k) return null;
  try { await stripe(c, "coupons/" + k.id); return k.id; } catch (e) { /* not there yet */ }
  try {
    await stripe(c, "coupons", { method: "POST", form: { id: k.id, percent_off: String(k.percent_off), duration: "repeating", duration_in_months: "6", name: k.name } });
  } catch (e) { await stripe(c, "coupons/" + k.id); } // made by another request at the same moment
  return k.id;
}
// Has this Stripe customer ever paid us? (A trial that ended without paying doesn't count: they're still a new customer.)
export async function everPaid(c, customer) {
  if (!customer) return false;
  const j = await stripe(c, "invoices?status=paid&limit=10&customer=" + encodeURIComponent(customer));
  return (j.data || []).some(i => (i.amount_paid || 0) > 0);
}

// GET /api/code?c=JANE (public): is this code valid? Only {ok, pct}: never who owns it.
export async function codeCheck(request, env) {
  if (request.method !== "GET") return json(405, { error: "method" });
  const code = normCode(new URL(request.url).searchParams.get("c"));
  try { if (env.LEAD_LIMIT && !(await env.LEAD_LIMIT.limit({ key: "code:" + (request.headers.get("cf-connecting-ip") || "x") })).success) return json(429, { error: "slow_down" }); } catch (e) {}
  const row = await findCode(env.SURVEY_DB, code);
  return json(200, row ? { ok: true, code, pct: OFFER.pct, plans: ["year", "2year"] } : { ok: false });
}

/* ---------- owner: support.flowlytix.co/admin › Partners (through the private Admin entrypoint) ---------- */
const dayS = 86400;
export async function partnersList(env) {
  const db = env.SURVEY_DB, c = cfg(env);
  if (!db) return json(200, { configured: false });
  await refTables(db);
  const codes = (await db.prepare("SELECT code, kind, label, created_at, active FROM ref_codes ORDER BY created_at DESC").all()).results || [];
  const paidOut = (await db.prepare("SELECT code, amount, note, paid_at FROM ref_payouts ORDER BY paid_at DESC").all()).results || [];
  const per = Object.fromEntries(codes.map(r => [r.code, { ...r, signups: 0, paying: 0, received: 0, earned: 0, pending: 0, paidOut: 0, sales: [] }]));
  for (const p of paidOut) if (per[p.code]) per[p.code].paidOut += p.amount;
  const now = Math.floor(Date.now() / 1000);
  if (c.key && codes.length) {
    // every subscription that used a code (Stripe metadata), then its first paid invoice
    for (let page = 0, after = ""; page < 20; page++) {
      const r = await stripe(c, "subscriptions?status=all&limit=100" + (after ? "&starting_after=" + after : ""));
      for (const s of r.data || []) {
        const code = s.metadata && s.metadata.ref_code, P = code && per[code]; if (!P) continue;
        P.signups++;
        const it = s.items && s.items.data && s.items.data[0], two = !!(it && it.price && it.price.recurring && it.price.recurring.interval_count === 2);
        const inv = await stripe(c, "invoices?status=paid&limit=10&subscription=" + encodeURIComponent(s.id) + "&expand[]=data.charge");
        const first = (inv.data || []).filter(i => (i.amount_paid || 0) > 0).sort((a, b) => a.created - b.created)[0];
        if (!first) continue;
        const amt = first.amount_paid / 100, refunded = !!(first.charge && typeof first.charge === "object" && first.charge.amount_refunded > 0);
        const at = (first.status_transitions && first.status_transitions.paid_at) || first.created;
        const yearPart = two ? amt / 2 : amt, comm = P.kind === "partner" && !refunded ? Math.round(yearPart * OFFER.partnerPct) / 100 : 0;
        P.paying++; P.received += refunded ? 0 : amt;
        if (now - at >= REFUND_DAYS * dayS) P.earned += comm; else P.pending += comm;
        P.sales.push({ at, amount: amt, plan: two ? "2year" : "year", refunded, commission: comm, ready: now - at >= REFUND_DAYS * dayS });
      }
      if (!r.has_more || !(r.data || []).length) break;
      after = r.data[r.data.length - 1].id;
    }
  }
  const list = Object.values(per).map(P => ({ ...P, earned: Math.round(P.earned * 100) / 100, pending: Math.round(P.pending * 100) / 100,
    owed: Math.max(0, Math.round((P.earned - P.paidOut) * 100) / 100) }));
  return json(200, { configured: true, stripe: !!c.key, offer: OFFER, refundDays: REFUND_DAYS, codes: list, payouts: paidOut, at: now });
}
async function body(request) { try { return await request.json(); } catch (e) { return {}; } }
export async function partnerCreate(request, env) {
  if (request.method !== "POST") return json(405, { error: "method" });
  const db = env.SURVEY_DB; if (!db) return json(503, { error: "no_db" });
  await refTables(db);
  const b = await body(request), code = normCode(b.code), kind = b.kind === "friend" ? "friend" : "partner";
  const label = String(b.label || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!CODE_RE.test(code)) return json(400, { error: "code", detail: "3–20 letters or numbers" });
  if (await db.prepare("SELECT 1 FROM ref_codes WHERE code = ?").bind(code).first()) return json(409, { error: "taken" });
  await db.prepare("INSERT INTO ref_codes (code, kind, label, created_at, active) VALUES (?, ?, ?, ?, 1)").bind(code, kind, label, new Date().toISOString()).run();
  return json(200, { ok: true, code });
}
export async function partnerToggle(request, env) {
  if (request.method !== "POST") return json(405, { error: "method" });
  const db = env.SURVEY_DB; if (!db) return json(503, { error: "no_db" });
  await refTables(db);
  const b = await body(request), code = normCode(b.code);
  if (!(await db.prepare("SELECT 1 FROM ref_codes WHERE code = ?").bind(code).first())) return json(404, { ok: false });
  await db.prepare("UPDATE ref_codes SET active = ? WHERE code = ?").bind(b.active ? 1 : 0, code).run();
  return json(200, { ok: true });
}
export async function partnerPayout(request, env) {
  if (request.method !== "POST") return json(405, { error: "method" });
  const db = env.SURVEY_DB; if (!db) return json(503, { error: "no_db" });
  await refTables(db);
  const b = await body(request), code = normCode(b.code), amount = Math.round(Number(b.amount) * 100) / 100;
  if (!(amount > 0) || !(await db.prepare("SELECT 1 FROM ref_codes WHERE code = ?").bind(code).first())) return json(400, { error: "bad" });
  await db.prepare("INSERT INTO ref_payouts (code, amount, note, paid_at) VALUES (?, ?, ?, ?)").bind(code, amount, String(b.note || "").slice(0, 120), new Date().toISOString()).run();
  return json(200, { ok: true });
}

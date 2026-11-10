// Discount codes and partners (owner, 10 Nov 2026). The agreed offer (CLAUDE.md › Codes, partners and referrals):
// - A code gives a NEW customer 20% off their first year, on the yearly or 2-year plan only (never monthly):
//   1 year = Stripe coupon flx-y1-20 (20% off the first payment); 2 years = flx-y2-10 (10% of the 2-year payment = 20% of its first year).
//   Both coupons are "repeating, 6 months", so they cover the first payment (straight away, or after the 30-day trial) and never a renewal.
// - Partner codes: the partner earns 25% of what the customer paid for their first year (2-year payment ÷ 2), once that payment is
//   past the 7-working-day refund window (REFUND_DAYS calendar days) and wasn't refunded. Paid by the owner by hand, from ฿300 owed.
// - Friend codes: the owner's friends and clients, discount only, no commission.
// - Member codes: paying yearly / 2-year members invite friends; 20% of a year off their next renewal per friend, at most 3 (below).
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
  try { await db.prepare("ALTER TABLE ref_codes ADD COLUMN owner TEXT").run(); } catch (e) { /* already there */ }
  await db.prepare("CREATE TABLE IF NOT EXISTS ref_rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, period_end INTEGER NOT NULL, friends INTEGER NOT NULL, amount REAL NOT NULL, at TEXT)").run();
  ready = true;
}
export async function findCode(db, code) {
  if (!db || !CODE_RE.test(code)) return null;
  await refTables(db);
  return await db.prepare("SELECT code, kind, owner FROM ref_codes WHERE code = ? AND active = 1").bind(code).first();
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
  await memberTables(db);
  const all = (await db.prepare("SELECT code, kind, label, created_at, active FROM ref_codes ORDER BY created_at DESC").all()).results || [];
  const codes = all.filter(r => r.kind !== "member"), memberCodes = all.filter(r => r.kind === "member");
  const rw = (await db.prepare("SELECT COUNT(*) n, COALESCE(SUM(friends),0) f, COALESCE(SUM(amount),0) a FROM ref_rewards").first()) || { n: 0, f: 0, a: 0 };
  const mem = { members: memberCodes.length, started: 0, paying: 0, received: 0, rewards: rw.n, friendsRewarded: rw.f, rewarded: rw.a };
  const paidOut = (await db.prepare("SELECT code, amount, note, paid_at FROM ref_payouts ORDER BY paid_at DESC").all()).results || [];
  const per = Object.fromEntries(codes.map(r => [r.code, { ...r, signups: 0, paying: 0, received: 0, earned: 0, pending: 0, paidOut: 0, sales: [] }]));
  for (const p of paidOut) if (per[p.code]) per[p.code].paidOut += p.amount;
  const now = Math.floor(Date.now() / 1000);
  if (c.key && codes.length) {
    // every subscription that used a code (Stripe metadata), then its first paid invoice
    for (let page = 0, after = ""; page < 20; page++) {
      const r = await stripe(c, "subscriptions?status=all&limit=100" + (after ? "&starting_after=" + after : ""));
      for (const s of r.data || []) {
        const code = s.metadata && s.metadata.ref_code, isMember = code && s.metadata.ref_kind === "member", P = code && (per[code] || (isMember ? { kind: "member", signups: 0, paying: 0, received: 0, earned: 0, pending: 0, sales: [] } : null)); if (!P) continue;
        P.signups++; if (isMember && !per[code]) mem.started++;
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
        if (isMember && !per[code]) { mem.paying++; mem.received += refunded ? 0 : amt; }
      }
      if (!r.has_more || !(r.data || []).length) break;
      after = r.data[r.data.length - 1].id;
    }
  }
  const list = Object.values(per).map(P => ({ ...P, earned: Math.round(P.earned * 100) / 100, pending: Math.round(P.pending * 100) / 100,
    owed: Math.max(0, Math.round((P.earned - P.paidOut) * 100) / 100) }));
  return json(200, { configured: true, stripe: !!c.key, offer: OFFER, refundDays: REFUND_DAYS, codes: list, members: mem, payouts: paidOut, at: now });
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

/* ---------- member referrals (part 2, owner 10 Nov 2026) ----------
   A paying member on a yearly or 2-year plan (never monthly; at least one paid invoice) gets their own code (M + 6 letters, random:
   it says nothing about who they are). Friends who use it get the same 20% off. For each friend who has paid, is past the refund
   window, is still subscribed and paid with a different card, the member gets 20% of one year of their own price off their next
   renewal (฿98 founding, ฿178 regular, ฿88 on the founding 2-year), at most OFFER.memberCap friends per renewal; more carry over.
   The credit is a negative Stripe invoice item on the member's subscription, added by the daily job (scheduled) once the renewal is
   10 days away or less, so the renewal invoice shows "Referral reward". D1 keeps only the code, the subscription it belongs to
   (owner) and the rewards given (code, renewal date, friends, amount). */
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ACTIVE = new Set(["active", "past_due"]);
export const REWARD_DAYS = 10;
const subEnd = s => s.current_period_end || (s.items && s.items.data && s.items.data[0] && s.items.data[0].current_period_end) || 0;
const subPrice = s => (s.items && s.items.data && s.items.data[0] && s.items.data[0].price) || {};
const yearly = s => { const r = subPrice(s).recurring || {}; return r.interval === "year"; };
// 20% of one year of the member's own price, in baht
export const memberReward = s => { const p = subPrice(s), n = (p.recurring && p.recurring.interval_count) || 1; return Math.round(((p.unit_amount || 0) / 100 / n) * OFFER.pct / 100); };

const memberTables = refTables;
// The paying yearly / 2-year subscription behind this Google email, if any
async function memberSub(c, email) {
  const custs = (await stripe(c, "customers?limit=10&email=" + encodeURIComponent(email))).data || [];
  let monthly = false, trial = false;
  for (const cu of custs) {
    const subs = (await stripe(c, "subscriptions?status=all&limit=20&customer=" + encodeURIComponent(cu.id))).data || [];
    for (const s of subs) {
      if (!c.prices.has(subPrice(s).id)) continue;
      if (s.status === "trialing") { trial = true; continue; }
      if (!ACTIVE.has(s.status)) continue;
      if (!yearly(s)) { monthly = true; continue; }
      if (await everPaid(c, cu.id)) return { sub: s, customer: cu.id };
    }
  }
  return { why: monthly ? "monthly" : trial ? "trial" : "none" };
}
// Every subscription that used this code, with its first paid invoice (and the card it was paid with)
async function friendsOf(c, code) {
  const out = [];
  for (let page = 0, after = ""; page < 20; page++) {
    const r = await stripe(c, "subscriptions?status=all&limit=100" + (after ? "&starting_after=" + after : ""));
    for (const s of r.data || []) {
      if (!(s.metadata && s.metadata.ref_code === code)) continue;
      const inv = await stripe(c, "invoices?status=paid&limit=10&subscription=" + encodeURIComponent(s.id) + "&expand[]=data.charge");
      const first = (inv.data || []).filter(i => (i.amount_paid || 0) > 0).sort((a, b) => a.created - b.created)[0];
      const ch = first && typeof first.charge === "object" ? first.charge : null;
      out.push({ sub: s, paidAt: first ? ((first.status_transitions && first.status_transitions.paid_at) || first.created) : null,
        refunded: !!(ch && ch.amount_refunded > 0), card: ch && ch.payment_method_details && ch.payment_method_details.card && ch.payment_method_details.card.fingerprint || "",
        counted: !!(s.metadata && s.metadata.ref_counted) });
    }
    if (!r.has_more || !(r.data || []).length) break;
    after = r.data[r.data.length - 1].id;
  }
  return out;
}
async function ownCards(c, customer) {
  const j = await stripe(c, "invoices?status=paid&limit=10&customer=" + encodeURIComponent(customer) + "&expand[]=data.charge");
  return new Set((j.data || []).map(i => i.charge && i.charge.payment_method_details && i.charge.payment_method_details.card && i.charge.payment_method_details.card.fingerprint).filter(Boolean));
}
const friendReady = (f, now) => f.paidAt && !f.refunded && ACTIVE.has(f.sub.status) && now - f.paidAt >= REFUND_DAYS * 86400;

// GET /api/referral (signed in): the member's code and how their invites are doing. Makes the code on first visit.
export async function memberReferral(request, env, email) {
  if (request.method !== "GET") return json(405, { error: "method" });
  if (!email) return json(401, { error: "auth" });
  const c = cfg(env), db = env.SURVEY_DB;
  if (!c.key || !db) return json(200, { eligible: false, why: "off" });
  const m = await memberSub(c, email);
  if (!m.sub) return json(200, { eligible: false, why: m.why });
  await memberTables(db);
  let row = await db.prepare("SELECT code FROM ref_codes WHERE owner = ? AND kind = 'member'").bind(m.sub.id).first();
  if (!row) {
    for (let i = 0; i < 6 && !row; i++) {
      const code = "M" + Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALPH[b % ALPH.length]).join("");
      if (await db.prepare("SELECT 1 FROM ref_codes WHERE code = ?").bind(code).first()) continue;
      await db.prepare("INSERT INTO ref_codes (code, kind, label, created_at, active, owner) VALUES (?, 'member', '', ?, 1, ?)").bind(code, new Date().toISOString(), m.sub.id).run();
      row = { code };
    }
  }
  const now = Math.floor(Date.now() / 1000), fr = await friendsOf(c, row.code), each = memberReward(m.sub), end = subEnd(m.sub);
  const given = (await db.prepare("SELECT COALESCE(SUM(friends),0) n, COALESCE(SUM(amount),0) a FROM ref_rewards WHERE code = ? AND period_end = ?").bind(row.code, end).first()) || { n: 0, a: 0 };
  const ready = fr.filter(f => friendReady(f, now) && !f.counted).length, waiting = fr.filter(f => f.paidAt && !f.refunded && ACTIVE.has(f.sub.status) && !friendReady(f, now)).length;
  const room = Math.max(0, OFFER.memberCap - given.n), next = Math.min(room, ready) * each + given.a;
  return json(200, { eligible: true, code: row.code, pct: OFFER.pct, each, cap: OFFER.memberCap, renewal: end, paid: fr.filter(f => f.paidAt && !f.refunded).length,
    waiting, rewardNext: Math.round(next), given: Math.round(given.a), started: fr.length });
}

// Daily job (wrangler.jsonc "triggers"): credit members whose renewal is close. Safe to run again: it only adds what's still due.
export async function referralRewards(env, now = Math.floor(Date.now() / 1000)) {
  const c = cfg(env), db = env.SURVEY_DB; if (!c.key || !db) return { done: 0 };
  await memberTables(db);
  const members = (await db.prepare("SELECT code, owner FROM ref_codes WHERE kind = 'member' AND active = 1 AND owner IS NOT NULL").all()).results || [];
  let done = 0;
  for (const mb of members) {
    let s; try { s = await stripe(c, "subscriptions/" + encodeURIComponent(mb.owner)); } catch (e) { continue; }
    const end = subEnd(s);
    if (!ACTIVE.has(s.status) || !yearly(s) || s.cancel_at_period_end || s.cancel_at || !end || end - now > REWARD_DAYS * 86400 || end <= now) continue;
    const given = (await db.prepare("SELECT COALESCE(SUM(friends),0) n FROM ref_rewards WHERE code = ? AND period_end = ?").bind(mb.code, end).first()) || { n: 0 };
    const room = OFFER.memberCap - given.n; if (room <= 0) continue;
    const own = await ownCards(c, s.customer);
    const ready = (await friendsOf(c, mb.code)).filter(f => friendReady(f, now) && !f.counted && !(f.card && own.has(f.card))).slice(0, room);
    if (!ready.length) continue;
    const each = memberReward(s), amount = each * ready.length, cur = String(subPrice(s).currency || "thb");
    await stripe(c, "invoiceitems", { method: "POST", form: { customer: s.customer, subscription: s.id, amount: String(-amount * 100), currency: cur,
      description: `Referral reward: ${ready.length} friend${ready.length > 1 ? "s" : ""} joined (${OFFER.pct}% of a year each)`, "metadata[ref_code]": mb.code } });
    for (const f of ready) await stripe(c, "subscriptions/" + encodeURIComponent(f.sub.id), { method: "POST", form: { "metadata[ref_counted]": String(end) } });
    await db.prepare("INSERT INTO ref_rewards (code, period_end, friends, amount, at) VALUES (?, ?, ?, ?, ?)").bind(mb.code, end, ready.length, amount, new Date().toISOString()).run();
    done++;
  }
  return { done };
}

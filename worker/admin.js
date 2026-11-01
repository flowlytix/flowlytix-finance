// Owner data for the Flowlytix admin page (support.flowlytix.co/admin), reached ONLY through the private "Admin"
// entrypoint (worker/main.js). The support Worker checks the admin password, then forwards here. No public address.
// GET  /survey[?format=csv]      survey answers + public rating (worker/survey.js)
// POST /survey/review            {id, status} approve / hide a review
// GET  /leads[?format=csv]       free template sign-ups (worker/leads.js)
// POST /leads/delete             {id} (PDPA deletion request)
// GET  /signups[?owners=1]       anonymous sign-up log summary (worker/signups.js)
// GET  /stripe                   subscriptions and payments, WITHOUT names, emails or Stripe IDs (for the dashboard's funnel)
import { surveyResults, surveyReview } from "./survey.js";
import { leadList, leadDelete } from "./leads.js";
import { signupStats } from "./signups.js";
import { cfg, stripe } from "./index.js";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function adminFetch(request, env) {
  const p = new URL(request.url).pathname.replace(/\/$/, "");
  try {
    if (p === "/survey") return await surveyResults(request, env, true);
    if (p === "/survey/review") return await surveyReview(request, env, true);
    if (p === "/leads") return await leadList(request, env, true);
    if (p === "/leads/delete") return await leadDelete(request, env, true);
    if (p === "/signups") return await signupStats(request, env, true);
    if (p === "/stripe") return request.method === "GET" ? await stripeStats(env) : json(405, { error: "method" });
    return json(404, { error: "not_found" });
  } catch (e) {
    console.log("admin error", p, e.code || "", e.message);
    return json(503, { error: e.code || "unavailable", detail: e.code === "stripe_error" ? String(e.message || "").slice(0, 240) : undefined });
  }
}

const ACTIVE = new Set(["active", "past_due"]);
// Every Flowlytix Money subscription (our prices only) and every paid invoice, as plain numbers and dates.
// test = an owner account or PRO_EMAILS address (the dashboard hides these unless asked). The email itself is not sent.
export async function stripeStats(env) {
  const c = cfg(env);
  if (!c.key) return json(200, { configured: false });
  const prices = c.prices, tierOf = id => id === c.price ? "founding" : id === c.priceRegular ? "regular" : id === c.priceMonthly ? "monthly" : "legacy";
  const subs = [], idx = new Map();
  for (let page = 0, after = ""; page < 30; page++) {
    const r = await stripe(c, "subscriptions?status=all&limit=100" + (after ? "&starting_after=" + after : ""));
    for (const s of r.data || []) {
      const it = s.items && s.items.data && s.items.data[0], price = it && it.price;
      if (!price || !(prices.has(price.id) || (s.metadata && s.metadata.app === "flowlytix-finance"))) continue;
      const m = s.metadata || {};
      idx.set(s.id, subs.length);
      subs.push({
        created: s.created, trialStart: s.trial_start || null, trialEnd: s.trial_end || null, status: s.status,
        cancelAtEnd: !!(s.cancel_at_period_end || s.cancel_at), canceledAt: s.canceled_at || null, endedAt: s.ended_at || null,
        tier: tierOf(price.id), interval: (price.recurring && price.recurring.interval) || "year", amount: (price.unit_amount || 0) / 100,
        currency: String(price.currency || "thb").toUpperCase(), src: String(m.src || ""), door: m.door === "work" ? "work" : "money",
        test: c.isComplimentary(m.email), firstPaid: null, paid: 0,
      });
    }
    if (!r.has_more || !(r.data || []).length) break;
    after = r.data[r.data.length - 1].id;
  }
  const payments = [];
  for (let page = 0, after = ""; page < 30; page++) {
    const r = await stripe(c, "invoices?status=paid&limit=100" + (after ? "&starting_after=" + after : ""));
    for (const inv of r.data || []) {
      const sid = typeof inv.subscription === "string" ? inv.subscription : inv.subscription && inv.subscription.id
        || (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription);
      const i = idx.get(sid), amt = (inv.amount_paid || 0) / 100;
      if (i === undefined || amt <= 0) continue;
      const at = (inv.status_transitions && inv.status_transitions.paid_at) || inv.created, s = subs[i];
      s.paid += amt; if (!s.firstPaid || at < s.firstPaid) s.firstPaid = at;
      payments.push({ sub: i, at, amount: amt, currency: String(inv.currency || "thb").toUpperCase() });
    }
    if (!r.has_more || !(r.data || []).length) break;
    after = r.data[r.data.length - 1].id;
  }
  const now = Math.floor(Date.now() / 1000);
  for (const s of subs) s.payingNow = ACTIVE.has(s.status) && !!s.firstPaid && !(s.trialEnd && s.trialEnd > now);
  return json(200, { configured: true, paywall: c.paywall, trialDays: c.trialDays, foundingLimit: c.foundingLimit, subs, payments, at: now });
}

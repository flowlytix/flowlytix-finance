// Flowlytix Money on Cloudflare Workers.
// Static files (index.html, pro.html, pro-img/) are served straight from Workers static assets.
// Every request except images runs this code, so the old finance.flowlytix.co address can redirect.
// /api/* is the licence service. It stores nothing. Who you are comes from Google;
// what you paid comes from Stripe. No financial data ever reaches it.
import { SECURITY_HEADERS } from "./headers.js";
import { handleAuth } from "./auth.js";
const DEFAULT_CLIENT_ID = "963989611279-0u4vll2sfmqfrvio5c199ug0oo8sfu9h.apps.googleusercontent.com";
// Owner accounts: always Pro, never charged. Add more with the PRO_EMAILS variable (comma-separated).
const OWNER_EMAILS = ["flowlytix@gmail.com", "aronsodacan@gmail.com"];
const ACTIVE = new Set(["active", "trialing", "past_due"]); // past_due keeps Pro during Stripe's retry period
const OLD_HOSTS = new Set(["finance.flowlytix.co"]);

function cfg(env) {
  const pro = new Set(OWNER_EMAILS.concat(String(env.PRO_EMAILS || "").split(",")).map(e => e.trim().toLowerCase()).filter(Boolean));
  return {
    clientId: env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID,
    appUrl: String(env.APP_URL || "https://money.flowlytix.co").replace(/\/$/, ""),
    paywall: String(env.PAYWALL || "off").toLowerCase() === "on",
    isComplimentary: email => pro.has(String(email || "").toLowerCase()),
    key: env.STRIPE_SECRET_KEY, price: env.STRIPE_PRICE_ID,
    // Founding price (STRIPE_PRICE_ID) for the first FOUNDING_LIMIT paying members, then STRIPE_PRICE_REGULAR.
    priceRegular: env.STRIPE_PRICE_REGULAR || "",
    foundingLimit: Math.max(0, parseInt(env.FOUNDING_LIMIT || "100", 10) || 0),
    // Free trial length for people who have never subscribed. 0 switches the trial off.
    trialDays: env.TRIAL_DAYS === undefined || env.TRIAL_DAYS === "" ? 7 : Math.max(0, parseInt(env.TRIAL_DAYS, 10) || 0),
    get prices() { return new Set([this.price, this.priceRegular].filter(Boolean)); },
  };
}

const send = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

// Verify the Google access token and return the verified email, or null.
async function googleEmail(request, c) {
  const h = request.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token || token.length > 4096) return null;
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(token));
  if (!r.ok) return null;
  const t = await r.json();
  if (t.aud !== c.clientId && t.azp !== c.clientId) return null; // token must be issued to this app
  if (!t.email || String(t.email_verified) !== "true") return null;
  if (t.expires_in !== undefined && +t.expires_in <= 0) return null;
  return String(t.email).toLowerCase();
}

async function stripe(c, path, { method = "GET", form } = {}) {
  if (!c.key) { const e = new Error("stripe_not_configured"); e.code = "stripe_not_configured"; throw e; }
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: { Authorization: "Bearer " + c.key, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error((j.error && j.error.message) || "stripe_error"); e.code = "stripe_error"; throw e; }
  return j;
}

async function customersFor(c, email) {
  const j = await stripe(c, "customers?limit=10&email=" + encodeURIComponent(email));
  return j.data || [];
}

// Best subscription for this email across their Stripe customers (founding or regular price).
// "ever" = they have had any Flowlytix Money subscription before, so they can't start another free trial.
async function subscriptionFor(c, email) {
  const custs = await customersFor(c, email);
  let best = null, ever = false;
  for (const cu of custs) {
    const subs = await stripe(c, "subscriptions?status=all&limit=20&customer=" + encodeURIComponent(cu.id));
    for (const s of subs.data || []) {
      const items = (s.items && s.items.data) || [];
      const pid = (items.find(i => i.price && c.prices.has(i.price.id)) || {}).price;
      if (c.prices.size && !pid) continue;
      ever = true;
      const end = s.current_period_end || (items[0] && items[0].current_period_end) || null;
      // Newer Stripe accounts record "cancel at the end of the period" as cancel_at (a date).
      const cancelAt = s.cancel_at || null;
      const cand = { customer: cu.id, status: s.status, periodEnd: cancelAt || end, cancelAtEnd: !!s.cancel_at_period_end || !!cancelAt,
        trialEnd: s.trial_end || null, needsCard: s.status === "trialing" && !s.default_payment_method,
        tier: pid && pid.id === c.priceRegular ? "regular" : "founding" };
      const rank = x => (ACTIVE.has(x.status) ? 2 : 0) + (x.periodEnd || 0) / 1e12;
      if (!best || rank(cand) > rank(best)) best = cand;
    }
  }
  return { best, ever, customer: (best && best.customer) || (custs[0] && custs[0].id) || null };
}

// How many founding places are taken: paying members (active or in Stripe's retry period) on the founding price.
async function foundingTaken(c) {
  if (!c.price) return 0;
  let n = 0;
  for (const st of ["active", "past_due"]) {
    const j = await stripe(c, "subscriptions?limit=100&status=" + st + "&price=" + encodeURIComponent(c.price));
    n += (j.data || []).length + (j.has_more ? 1000 : 0);
  }
  return n;
}
// Which price new subscribers get right now, and the numbers the app and sales page show.
async function pricingInfo(c) {
  const amt = async id => { if (!id) return null; const p = await stripe(c, "prices/" + encodeURIComponent(id)); return { amount: (p.unit_amount || 0) / 100, currency: String(p.currency || "thb").toUpperCase() }; };
  const [founding, regular, taken] = await Promise.all([amt(c.price), amt(c.priceRegular), foundingTaken(c)]);
  const left = Math.max(0, c.foundingLimit - taken);
  const current = left > 0 || !regular ? "founding" : "regular";
  return { founding, regular, foundingLimit: c.foundingLimit, foundingTaken: Math.min(taken, c.foundingLimit), foundingLeft: regular ? left : null, current, trialDays: c.trialDays };
}

// GET /api/licence -> { plan: "beta"|"free"|"pro", paywall, status, periodEnd, cancelAtEnd }
async function licence(request, c) {
  if (request.method !== "GET") return send(405, { error: "method" });
  const email = await googleEmail(request, c);
  if (!email) return send(401, { error: "auth" });
  if (!c.paywall) return send(200, { plan: "beta", paywall: false });
  if (c.isComplimentary(email)) return send(200, { plan: "pro", paywall: true, status: "complimentary", periodEnd: null });
  const { best, ever } = await subscriptionFor(c, email);
  const trialEligible = c.trialDays > 0 && !ever;
  if (best && ACTIVE.has(best.status)) return send(200, { plan: "pro", paywall: true, status: best.status, periodEnd: best.periodEnd, cancelAtEnd: best.cancelAtEnd,
    trialEnd: best.status === "trialing" ? best.trialEnd : null, needsCard: best.needsCard, tier: best.tier, trialEligible: false, trialDays: c.trialDays });
  return send(200, { plan: "free", paywall: true, status: best ? best.status : "none", periodEnd: best ? best.periodEnd : null, trialEligible, trialDays: c.trialDays });
}

// POST /api/checkout -> { url } (Stripe Checkout for the yearly Pro subscription)
async function checkout(request, c) {
  if (request.method !== "POST") return send(405, { error: "method" });
  const email = await googleEmail(request, c);
  if (!email) return send(401, { error: "auth" });
  if (!c.paywall) return send(400, { error: "billing_off" });
  if (c.isComplimentary(email)) return send(409, { error: "already_pro" });
  if (!c.price) return send(503, { error: "stripe_not_configured" });
  const { best, ever, customer } = await subscriptionFor(c, email);
  if (best && ACTIVE.has(best.status)) return send(409, { error: "already_pro" });
  const info = await pricingInfo(c);
  const tier = info.current, price = tier === "regular" ? c.priceRegular : c.price;
  const form = {
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: c.appUrl + "/?upgraded=1",
    cancel_url: c.appUrl + "/",
    client_reference_id: email,
    allow_promotion_codes: "true",
    "subscription_data[metadata][app]": "flowlytix-finance",
    "subscription_data[metadata][email]": email,
    "subscription_data[metadata][tier]": tier,
  };
  // First time only: free trial with no card needed. If no card is added by the end, the subscription simply ends (back to Free).
  if (c.trialDays > 0 && !ever) {
    form["subscription_data[trial_period_days]"] = String(c.trialDays);
    form["subscription_data[trial_settings][end_behavior][missing_payment_method]"] = "cancel";
    form.payment_method_collection = "if_required";
  }
  if (customer) form.customer = customer; else form.customer_email = email;
  const s = await stripe(c, "checkout/sessions", { method: "POST", form });
  return send(200, { url: s.url });
}

// POST /api/portal -> { url } (Stripe customer portal: cancel, change card, invoices)
async function portal(request, c) {
  if (request.method !== "POST") return send(405, { error: "method" });
  const email = await googleEmail(request, c);
  if (!email) return send(401, { error: "auth" });
  const custs = await customersFor(c, email);
  if (!custs.length) return send(404, { error: "no_customer" });
  const s = await stripe(c, "billing_portal/sessions", { method: "POST", form: { customer: custs[0].id, return_url: c.appUrl + "/" } });
  return send(200, { url: s.url });
}

// GET /api/pricing (public) -> founding/regular price, places left and trial length, for the app and the sales page.
async function pricing(request, c) {
  if (request.method !== "GET") return send(405, { error: "method" });
  if (!c.key || !c.price) return send(200, { paywall: c.paywall, configured: false, trialDays: c.trialDays });
  const cache = typeof caches !== "undefined" ? caches.default : null, key = new Request(new URL(request.url).origin + "/api/pricing");
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const info = await pricingInfo(c);
  const res = new Response(JSON.stringify({ paywall: c.paywall, configured: true, ...info }), {
    status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
  if (cache) await cache.put(key, res.clone());
  return res;
}

// POST /api/feedback {rating 1-5, comment} -> kept on the person's Stripe customer record, so the owner reads it in Stripe.
async function feedback(request, c) {
  if (request.method !== "POST") return send(405, { error: "method" });
  const email = await googleEmail(request, c);
  if (!email) return send(401, { error: "auth" });
  let b = {}; try { b = await request.json(); } catch (e) {}
  const rating = Math.round(Number(b.rating));
  if (!(rating >= 1 && rating <= 5)) return send(400, { error: "rating" });
  const comment = String(b.comment || "").replace(/\s+/g, " ").trim().slice(0, 480);
  const custs = await customersFor(c, email);
  const id = custs[0] ? custs[0].id : (await stripe(c, "customers", { method: "POST", form: { email, "metadata[app]": "flowlytix-finance" } })).id;
  await stripe(c, "customers/" + encodeURIComponent(id), { method: "POST", form: {
    "metadata[feedback_rating]": String(rating), "metadata[feedback_comment]": comment,
    "metadata[feedback_at]": new Date().toISOString().slice(0, 10), "metadata[feedback_context]": String(b.context || "").slice(0, 40) } });
  return send(200, { ok: true });
}

const ROUTES = { "/api/licence": licence, "/api/checkout": checkout, "/api/portal": portal, "/api/pricing": pricing, "/api/feedback": feedback };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // finance.flowlytix.co (old name) -> money.flowlytix.co, keeping the path
    if (OLD_HOSTS.has(url.hostname)) return Response.redirect("https://money.flowlytix.co" + url.pathname + url.search, 308);
    if (url.pathname.startsWith("/api/auth/")) {
      try { return await handleAuth(request, env, cfg(env).clientId); }
      catch (e) { return send(503, { error: "unavailable" }); }
    }
    const route = ROUTES[url.pathname.replace(/\/$/, "")];
    if (route) {
      try { return await route(request, cfg(env)); }
      catch (e) {
        // Stripe's own message (e.g. "No such price ... exists in test mode") tells the owner what to fix. It never contains secrets.
        console.log("api error", url.pathname, e.code, e.message);
        return send(503, { error: e.code || "unavailable", detail: e.code === "stripe_error" ? String(e.message || "").slice(0, 240) : undefined });
      }
    }
    if (url.pathname.startsWith("/api/")) return send(404, { error: "not_found" });
    // Pages and files: served from static assets, with the security headers added here
    // (headers in _headers are not applied when a Worker returns the response).
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!out.headers.has(k)) out.headers.set(k, v);
    return out;
  },
};

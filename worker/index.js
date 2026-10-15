// Flowlytix Money on Cloudflare Workers.
// Static files (index.html, pro.html, pro-img/) are served straight from Workers static assets.
// Only /api/* runs this code: the licence service. It stores nothing. Who you are comes from Google;
// what you paid comes from Stripe. No financial data ever reaches it.
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

// Best subscription for this email across their Stripe customers.
async function subscriptionFor(c, email) {
  const custs = await customersFor(c, email);
  let best = null;
  for (const cu of custs) {
    const subs = await stripe(c, "subscriptions?status=all&limit=20&customer=" + encodeURIComponent(cu.id));
    for (const s of subs.data || []) {
      if (c.price && !((s.items && s.items.data) || []).some(i => i.price && i.price.id === c.price)) continue;
      const end = s.current_period_end || (s.items && s.items.data && s.items.data[0] && s.items.data[0].current_period_end) || null;
      // Newer Stripe accounts record "cancel at the end of the period" as cancel_at (a date).
      const cancelAt = s.cancel_at || null;
      const cand = { customer: cu.id, status: s.status, periodEnd: cancelAt || end, cancelAtEnd: !!s.cancel_at_period_end || !!cancelAt };
      const rank = x => (ACTIVE.has(x.status) ? 2 : 0) + (x.periodEnd || 0) / 1e12;
      if (!best || rank(cand) > rank(best)) best = cand;
    }
  }
  return { best, customer: (best && best.customer) || (custs[0] && custs[0].id) || null };
}

// GET /api/licence -> { plan: "beta"|"free"|"pro", paywall, status, periodEnd, cancelAtEnd }
async function licence(request, c) {
  if (request.method !== "GET") return send(405, { error: "method" });
  const email = await googleEmail(request, c);
  if (!email) return send(401, { error: "auth" });
  if (!c.paywall) return send(200, { plan: "beta", paywall: false });
  if (c.isComplimentary(email)) return send(200, { plan: "pro", paywall: true, status: "complimentary", periodEnd: null });
  const { best } = await subscriptionFor(c, email);
  if (best && ACTIVE.has(best.status)) return send(200, { plan: "pro", paywall: true, status: best.status, periodEnd: best.periodEnd, cancelAtEnd: best.cancelAtEnd });
  return send(200, { plan: "free", paywall: true, status: best ? best.status : "none", periodEnd: best ? best.periodEnd : null });
}

// POST /api/checkout -> { url } (Stripe Checkout for the yearly Pro subscription)
async function checkout(request, c) {
  if (request.method !== "POST") return send(405, { error: "method" });
  const email = await googleEmail(request, c);
  if (!email) return send(401, { error: "auth" });
  if (!c.paywall) return send(400, { error: "billing_off" });
  if (c.isComplimentary(email)) return send(409, { error: "already_pro" });
  if (!c.price) return send(503, { error: "stripe_not_configured" });
  const { best, customer } = await subscriptionFor(c, email);
  if (best && ACTIVE.has(best.status)) return send(409, { error: "already_pro" });
  const form = {
    mode: "subscription",
    "line_items[0][price]": c.price,
    "line_items[0][quantity]": "1",
    success_url: c.appUrl + "/?upgraded=1",
    cancel_url: c.appUrl + "/",
    client_reference_id: email,
    allow_promotion_codes: "true",
    "subscription_data[metadata][app]": "flowlytix-finance",
    "subscription_data[metadata][email]": email,
  };
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

const ROUTES = { "/api/licence": licence, "/api/checkout": checkout, "/api/portal": portal };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // finance.flowlytix.co (old name) -> money.flowlytix.co, keeping the path
    if (OLD_HOSTS.has(url.hostname)) return Response.redirect("https://money.flowlytix.co" + url.pathname + url.search, 308);
    const route = ROUTES[url.pathname.replace(/\/$/, "")];
    if (route) {
      try { return await route(request, cfg(env)); }
      catch (e) { return send(503, { error: e.code || "unavailable" }); }
    }
    if (url.pathname.startsWith("/api/")) return send(404, { error: "not_found" });
    return env.ASSETS.fetch(request);
  },
};

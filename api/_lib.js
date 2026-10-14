// Shared helpers for the Flowlytix Finance licence service.
// Stores nothing. Who you are comes from Google; what you paid comes from Stripe.
// No financial data ever reaches these functions.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "963989611279-0u4vll2sfmqfrvio5c199ug0oo8sfu9h.apps.googleusercontent.com";
const APP_URL = (process.env.APP_URL || "https://finance.flowlytix.co").replace(/\/$/, "");
const PAYWALL = String(process.env.PAYWALL || "off").toLowerCase() === "on";
// Owner accounts: always Pro, never charged. Add more with the PRO_EMAILS env var (comma-separated).
const OWNER_EMAILS = ["flowlytix@gmail.com", "aronsodacan@gmail.com"];
const PRO_EMAILS = new Set(OWNER_EMAILS.concat(String(process.env.PRO_EMAILS || "").split(",")).map(e => e.trim().toLowerCase()).filter(Boolean));
const isComplimentary = email => PRO_EMAILS.has(String(email || "").toLowerCase());
const ACTIVE = new Set(["active", "trialing", "past_due"]); // past_due keeps Pro during Stripe's retry period

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

// Verify the Google access token and return the verified email, or null.
async function googleEmail(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token || token.length > 4096) return null;
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(token));
  if (!r.ok) return null;
  const t = await r.json();
  // Token must be issued to this app, not to some other Google app.
  if (t.aud !== GOOGLE_CLIENT_ID && t.azp !== GOOGLE_CLIENT_ID) return null;
  if (!t.email || String(t.email_verified) !== "true") return null;
  if (t.expires_in !== undefined && +t.expires_in <= 0) return null;
  return String(t.email).toLowerCase();
}

async function stripe(path, { method = "GET", form } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) { const e = new Error("stripe_not_configured"); e.code = "stripe_not_configured"; throw e; }
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: { Authorization: "Bearer " + key, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error((j.error && j.error.message) || "stripe_error"); e.code = "stripe_error"; throw e; }
  return j;
}

async function customersFor(email) {
  const j = await stripe("customers?limit=10&email=" + encodeURIComponent(email));
  return j.data || [];
}

// Best subscription for this email across their Stripe customers.
async function subscriptionFor(email) {
  const price = process.env.STRIPE_PRICE_ID;
  const custs = await customersFor(email);
  let best = null;
  for (const c of custs) {
    const subs = await stripe("subscriptions?status=all&limit=20&customer=" + encodeURIComponent(c.id));
    for (const s of subs.data || []) {
      if (price && !(s.items && s.items.data || []).some(i => i.price && i.price.id === price)) continue;
      const end = s.current_period_end || (s.items && s.items.data && s.items.data[0] && s.items.data[0].current_period_end) || null;
      const cand = { customer: c.id, status: s.status, periodEnd: end, cancelAtEnd: !!s.cancel_at_period_end };
      const rank = x => (ACTIVE.has(x.status) ? 2 : 0) + (x.periodEnd || 0) / 1e12;
      if (!best || rank(cand) > rank(best)) best = cand;
    }
  }
  return { best, customer: (best && best.customer) || (custs[0] && custs[0].id) || null };
}

module.exports = { isComplimentary, send, googleEmail, stripe, subscriptionFor, customersFor, PAYWALL, APP_URL, ACTIVE };

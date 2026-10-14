// POST /api/checkout  ->  { url }  (Stripe Checkout for the yearly Pro subscription)
const { isComplimentary, send, googleEmail, subscriptionFor, stripe, PAYWALL, APP_URL, ACTIVE } = require("./_lib");
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  try {
    const email = await googleEmail(req);
    if (!email) return send(res, 401, { error: "auth" });
    if (!PAYWALL) return send(res, 400, { error: "billing_off" });
    if (isComplimentary(email)) return send(res, 409, { error: "already_pro" });
    const price = process.env.STRIPE_PRICE_ID;
    if (!price) return send(res, 503, { error: "stripe_not_configured" });
    const { best, customer } = await subscriptionFor(email);
    if (best && ACTIVE.has(best.status)) return send(res, 409, { error: "already_pro" });
    const form = {
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url: APP_URL + "/?upgraded=1",
      cancel_url: APP_URL + "/",
      client_reference_id: email,
      allow_promotion_codes: "true",
      "subscription_data[metadata][app]": "flowlytix-finance",
      "subscription_data[metadata][email]": email,
    };
    if (customer) form.customer = customer; else form.customer_email = email;
    const s = await stripe("checkout/sessions", { method: "POST", form });
    return send(res, 200, { url: s.url });
  } catch (e) {
    return send(res, 503, { error: e.code || "unavailable" });
  }
};

// POST /api/portal  ->  { url }  (Stripe customer portal: cancel, change card, invoices)
const { send, googleEmail, customersFor, stripe, APP_URL } = require("./_lib");
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  try {
    const email = await googleEmail(req);
    if (!email) return send(res, 401, { error: "auth" });
    const custs = await customersFor(email);
    if (!custs.length) return send(res, 404, { error: "no_customer" });
    const s = await stripe("billing_portal/sessions", { method: "POST", form: { customer: custs[0].id, return_url: APP_URL + "/" } });
    return send(res, 200, { url: s.url });
  } catch (e) {
    return send(res, 503, { error: e.code || "unavailable" });
  }
};

// GET /api/licence  ->  { plan: "beta"|"free"|"pro", paywall, status, periodEnd, cancelAtEnd }
const { send, googleEmail, subscriptionFor, PAYWALL, ACTIVE } = require("./_lib");
module.exports = async (req, res) => {
  if (req.method !== "GET") return send(res, 405, { error: "method" });
  try {
    const email = await googleEmail(req);
    if (!email) return send(res, 401, { error: "auth" });
    if (!PAYWALL) return send(res, 200, { plan: "beta", paywall: false });
    const { best } = await subscriptionFor(email);
    if (best && ACTIVE.has(best.status)) return send(res, 200, { plan: "pro", paywall: true, status: best.status, periodEnd: best.periodEnd, cancelAtEnd: best.cancelAtEnd });
    return send(res, 200, { plan: "free", paywall: true, status: best ? best.status : "none", periodEnd: best ? best.periodEnd : null });
  } catch (e) {
    return send(res, 503, { error: e.code || "unavailable" });
  }
};

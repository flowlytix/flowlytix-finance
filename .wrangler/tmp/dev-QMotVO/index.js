var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.js
var DEFAULT_CLIENT_ID = "963989611279-0u4vll2sfmqfrvio5c199ug0oo8sfu9h.apps.googleusercontent.com";
var OWNER_EMAILS = ["flowlytix@gmail.com", "aronsodacan@gmail.com"];
var ACTIVE = /* @__PURE__ */ new Set(["active", "trialing", "past_due"]);
var OLD_HOSTS = /* @__PURE__ */ new Set(["finance.flowlytix.co"]);
function cfg(env) {
  const pro = new Set(OWNER_EMAILS.concat(String(env.PRO_EMAILS || "").split(",")).map((e) => e.trim().toLowerCase()).filter(Boolean));
  return {
    clientId: env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID,
    appUrl: String(env.APP_URL || "https://money.flowlytix.co").replace(/\/$/, ""),
    paywall: String(env.PAYWALL || "off").toLowerCase() === "on",
    isComplimentary: /* @__PURE__ */ __name((email) => pro.has(String(email || "").toLowerCase()), "isComplimentary"),
    key: env.STRIPE_SECRET_KEY,
    price: env.STRIPE_PRICE_ID
  };
}
__name(cfg, "cfg");
var send = /* @__PURE__ */ __name((status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
}), "send");
async function googleEmail(request, c) {
  const h = request.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token || token.length > 4096) return null;
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(token));
  if (!r.ok) return null;
  const t = await r.json();
  if (t.aud !== c.clientId && t.azp !== c.clientId) return null;
  if (!t.email || String(t.email_verified) !== "true") return null;
  if (t.expires_in !== void 0 && +t.expires_in <= 0) return null;
  return String(t.email).toLowerCase();
}
__name(googleEmail, "googleEmail");
async function stripe(c, path, { method = "GET", form } = {}) {
  if (!c.key) {
    const e = new Error("stripe_not_configured");
    e.code = "stripe_not_configured";
    throw e;
  }
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: { Authorization: "Bearer " + c.key, ...form ? { "Content-Type": "application/x-www-form-urlencoded" } : {} },
    body: form ? new URLSearchParams(form).toString() : void 0
  });
  const j = await r.json();
  if (!r.ok) {
    const e = new Error(j.error && j.error.message || "stripe_error");
    e.code = "stripe_error";
    throw e;
  }
  return j;
}
__name(stripe, "stripe");
async function customersFor(c, email) {
  const j = await stripe(c, "customers?limit=10&email=" + encodeURIComponent(email));
  return j.data || [];
}
__name(customersFor, "customersFor");
async function subscriptionFor(c, email) {
  const custs = await customersFor(c, email);
  let best = null;
  for (const cu of custs) {
    const subs = await stripe(c, "subscriptions?status=all&limit=20&customer=" + encodeURIComponent(cu.id));
    for (const s of subs.data || []) {
      if (c.price && !(s.items && s.items.data || []).some((i) => i.price && i.price.id === c.price)) continue;
      const end = s.current_period_end || s.items && s.items.data && s.items.data[0] && s.items.data[0].current_period_end || null;
      const cancelAt = s.cancel_at || null;
      const cand = { customer: cu.id, status: s.status, periodEnd: cancelAt || end, cancelAtEnd: !!s.cancel_at_period_end || !!cancelAt };
      const rank = /* @__PURE__ */ __name((x) => (ACTIVE.has(x.status) ? 2 : 0) + (x.periodEnd || 0) / 1e12, "rank");
      if (!best || rank(cand) > rank(best)) best = cand;
    }
  }
  return { best, customer: best && best.customer || custs[0] && custs[0].id || null };
}
__name(subscriptionFor, "subscriptionFor");
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
__name(licence, "licence");
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
    "subscription_data[metadata][email]": email
  };
  if (customer) form.customer = customer;
  else form.customer_email = email;
  const s = await stripe(c, "checkout/sessions", { method: "POST", form });
  return send(200, { url: s.url });
}
__name(checkout, "checkout");
async function portal(request, c) {
  if (request.method !== "POST") return send(405, { error: "method" });
  const email = await googleEmail(request, c);
  if (!email) return send(401, { error: "auth" });
  const custs = await customersFor(c, email);
  if (!custs.length) return send(404, { error: "no_customer" });
  const s = await stripe(c, "billing_portal/sessions", { method: "POST", form: { customer: custs[0].id, return_url: c.appUrl + "/" } });
  return send(200, { url: s.url });
}
__name(portal, "portal");
var ROUTES = { "/api/licence": licence, "/api/checkout": checkout, "/api/portal": portal };
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (OLD_HOSTS.has(url.hostname)) return Response.redirect("https://money.flowlytix.co" + url.pathname + url.search, 308);
    const route = ROUTES[url.pathname.replace(/\/$/, "")];
    if (route) {
      try {
        return await route(request, cfg(env));
      } catch (e) {
        return send(503, { error: e.code || "unavailable" });
      }
    }
    if (url.pathname.startsWith("/api/")) return send(404, { error: "not_found" });
    return env.ASSETS.fetch(request);
  }
};

// ../../../tmp/claude-0/-home-claude/286a1302-4cc0-5edc-aa10-63af98ab69d4/scratchpad/cf/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../tmp/claude-0/-home-claude/286a1302-4cc0-5edc-aa10-63af98ab69d4/scratchpad/cf/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-85wkx9/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../tmp/claude-0/-home-claude/286a1302-4cc0-5edc-aa10-63af98ab69d4/scratchpad/cf/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-85wkx9/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map

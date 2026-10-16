// "Stay signed in" for Flowlytix Money.
// Google gives a long-lived refresh token once. We keep it ONLY in the user's own browser, inside an
// encrypted, HttpOnly cookie that page scripts can't read. Flowlytix stores nothing on a server.
// The app asks /api/auth/token for a fresh 1-hour Google access token whenever it needs one.
// Switched on by setting the GOOGLE_CLIENT_SECRET secret in Cloudflare; until then the app keeps
// using the old pop-up sign-in.
const SCOPE = "https://www.googleapis.com/auth/drive.file openid email";
const RT_COOKIE = "__Host-flx_rt", ST_COOKIE = "__Host-flx_st";
const RT_AGE = 180 * 24 * 3600; // 180 days; Google may end it sooner (password change, access removed)
const enc = new TextEncoder(), dec = new TextDecoder();

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
const redirect = (to, cookies = []) => { const h = new Headers({ Location: to, "Cache-Control": "no-store" }); cookies.forEach(c => h.append("Set-Cookie", c)); return new Response(null, { status: 302, headers: h }); };
const cookie = (name, val, age, site) => `${name}=${val}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=${site}`;
const getCookie = (req, name) => { const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name.replace(/[-_]/g, "\\$&") + "=([^;]+)")); return m ? m[1] : null; };

async function key(secret) {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: enc.encode("flowlytix-money"), info: enc.encode("refresh-cookie-v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(secret, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret), enc.encode(JSON.stringify(obj)));
  const out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12); return b64u(out);
}
async function open(secret, s) {
  try { const b = unb64u(s); const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, await key(secret), b.slice(12)); return JSON.parse(dec.decode(pt)); }
  catch (e) { return null; }
}
const idEmail = idt => { try { const p = JSON.parse(dec.decode(unb64u(idt.split(".")[1]))); return p.email_verified ? String(p.email).toLowerCase() : null; } catch (e) { return null; } };

async function googleToken(form) {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() });
  return { ok: r.ok, j: await r.json().catch(() => ({})) };
}

export async function handleAuth(request, env, clientId) {
  const url = new URL(request.url), path = url.pathname.replace(/\/$/, ""), secret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = url.origin + "/api/auth/callback";

  if (path === "/api/auth/config") return json(200, { enabled: !!secret });
  if (!secret) return path === "/api/auth/start" ? redirect("/?auth=off") : json(404, { error: "auth_off" });

  // 1) Send the browser to Google's sign-in page.
  if (path === "/api/auth/start") {
    const force = url.searchParams.get("force") === "1", hint = url.searchParams.get("hint") || "";
    const state = b64u(crypto.getRandomValues(new Uint8Array(18)));
    const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: SCOPE,
      access_type: "offline", include_granted_scopes: "true", state: state + "." + (force ? 1 : 0) });
    if (force) q.set("prompt", "consent");
    else if (!hint) q.set("prompt", "select_account");
    if (/^[^@\s]+@[^@\s]+$/.test(hint)) q.set("login_hint", hint);
    return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + q, [cookie(ST_COOKIE, state, 600, "Lax")]);
  }

  // 2) Google sends the browser back here with a one-time code.
  if (path === "/api/auth/callback") {
    const clearSt = cookie(ST_COOKIE, "", 0, "Lax");
    const [state, forced] = String(url.searchParams.get("state") || "").split(".");
    if (!state || state !== getCookie(request, ST_COOKIE)) return redirect("/?auth=fail", [clearSt]);
    if (url.searchParams.get("error")) return redirect("/?auth=cancel", [clearSt]);
    const code = url.searchParams.get("code"); if (!code) return redirect("/?auth=fail", [clearSt]);
    const { ok, j } = await googleToken({ code, client_id: clientId, client_secret: secret, redirect_uri: redirectUri, grant_type: "authorization_code" });
    if (!ok || !j.access_token) return redirect("/?auth=fail", [clearSt]);
    if (!String(j.scope || "").includes("https://www.googleapis.com/auth/drive.file")) return redirect("/?auth=noscope", [clearSt]);
    const email = j.id_token ? idEmail(j.id_token) : null;
    if (!j.refresh_token) {
      // Already said yes before, so Google didn't send a long-lived key. Ask once more with the consent screen.
      if (forced !== "1") return redirect("/api/auth/start?force=1" + (email ? "&hint=" + encodeURIComponent(email) : ""), [clearSt]);
      return redirect("/?auth=fail", [clearSt]);
    }
    const sealed = await seal(secret, { rt: j.refresh_token, email, t: Date.now() });
    return redirect("/?signedin=1", [clearSt, cookie(RT_COOKIE, sealed, RT_AGE, "Strict")]);
  }

  // 3) The app asks for a fresh access token (on load, and before the old one runs out).
  if (path === "/api/auth/token") {
    if (request.method !== "POST") return json(405, { error: "method" });
    const raw = getCookie(request, RT_COOKIE), data = raw ? await open(secret, raw) : null;
    if (!data || !data.rt) return json(401, { error: "signin" }, raw ? { "Set-Cookie": cookie(RT_COOKIE, "", 0, "Strict") } : {});
    const { ok, j } = await googleToken({ refresh_token: data.rt, client_id: clientId, client_secret: secret, grant_type: "refresh_token" });
    if (!ok || !j.access_token) {
      if (j.error === "invalid_grant") return json(401, { error: "signin" }, { "Set-Cookie": cookie(RT_COOKIE, "", 0, "Strict") });
      return json(503, { error: "google_unavailable" });
    }
    return json(200, { access_token: j.access_token, expires_in: j.expires_in || 3600, scope: j.scope || SCOPE, email: data.email || null });
  }

  // 4) Sign out: tell Google to cancel the key, and delete the cookie.
  if (path === "/api/auth/logout") {
    if (request.method !== "POST") return json(405, { error: "method" });
    const raw = getCookie(request, RT_COOKIE), data = raw ? await open(secret, raw) : null;
    if (data && data.rt) { try { await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(data.rt), { method: "POST" }); } catch (e) {} }
    return json(200, { ok: true }, { "Set-Cookie": cookie(RT_COOKIE, "", 0, "Strict") });
  }
  return json(404, { error: "not_found" });
}

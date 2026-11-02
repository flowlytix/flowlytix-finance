/* Flowlytix cookie banner for the apps (money.flowlytix.co, fit.flowlytix.co). KEEP IDENTICAL in flowlytix-finance/consent.js and
   flowlytix-fit/consent.js. Same choice, wording and cookie format as flowlytix.co (theme assets/consent.js):
   cookie flx_consent = "a<0|1>m<0|1>.<time>", 180 days, set for .flowlytix.co so one choice covers every Flowlytix site.
   Tracking tags wait in the page as <script type="text/plain" data-flx-c="analytics|marketing" [data-flx-src="url"]> and run only
   for the categories the visitor allows. Google consent mode is updated from the choice (the default "denied" is set in the page).
   Essential things never wait: sign-in, the app itself, and Flowlytix's anonymous step counts (no cookie, nothing personal).
   Load with <script src="/consent.js" defer data-product="Flowlytix Money"></script> (add data-site on a website, e.g.
   support.flowlytix.co: the wording then says "site" instead of "app"). Reopen from any element with
   data-ck-open, or window.flxCookieSettings(). */
(function () {
  if (window.flxConsentLoaded) return; window.flxConsentLoaded = true;
  var me = document.currentScript, product = (me && me.getAttribute("data-product")) || "Flowlytix", site = !!(me && me.hasAttribute("data-site"));
  var th = function () { return /^th/i.test(document.documentElement.lang || ""); };
  var T = function (en, tth) { return th() ? tth : en; };
  var done = {}, box = null;

  function read() { var m = document.cookie.match(/(?:^|; )flx_consent=([^;]+)/); if (!m) return null; var c = decodeURIComponent(m[1]); return { analytics: /a1/.test(c), marketing: /m1/.test(c) }; }
  function write(c) {
    var v = "a" + (c.analytics ? 1 : 0) + "m" + (c.marketing ? 1 : 0) + "." + Date.now();
    var dom = /(^|\.)flowlytix\.co$/.test(location.hostname) ? ";domain=.flowlytix.co" : "";
    document.cookie = "flx_consent=" + v + ";path=/;max-age=" + 180 * 86400 + ";SameSite=Lax" + dom + (location.protocol === "https:" ? ";Secure" : "");
  }
  function has(cat) { return !!document.querySelector('script[type="text/plain"][data-flx-c~="' + cat + '"]'); }
  /* run the waiting tags for the allowed categories, in page order, once each */
  function enable(c) {
    document.querySelectorAll('script[type="text/plain"][data-flx-c]').forEach(function (s) {
      if (s.dataset.flxRan) return;
      var ok = s.getAttribute("data-flx-c").split(" ").some(function (k) { return c[k]; });
      if (!ok) return;
      var n = document.createElement("script");
      for (var i = 0; i < s.attributes.length; i++) { var a = s.attributes[i]; if (a.name !== "type" && a.name.indexOf("data-flx-") !== 0) n.setAttribute(a.name, a.value); }
      if (s.dataset.flxSrc) { n.src = s.dataset.flxSrc; n.async = true; } else n.text = s.text;
      s.dataset.flxRan = "1";
      s.parentNode.insertBefore(n, s.nextSibling);
    });
  }
  function signal(c) {
    if (window.gtag) gtag("consent", "update", { analytics_storage: c.analytics ? "granted" : "denied", ad_storage: c.marketing ? "granted" : "denied", ad_user_data: c.marketing ? "granted" : "denied", ad_personalization: c.marketing ? "granted" : "denied" });
  }
  function decide(c) {
    var before = read();
    write(c); signal(c); enable(c); hide();
    /* taking consent back: tags already running can only be stopped by reloading the page */
    if (before && ((before.analytics && !c.analytics) || (before.marketing && !c.marketing))) location.reload();
  }

  var CSS = ".flxck{position:fixed;z-index:2147483000;left:16px;right:16px;bottom:16px;max-width:560px;margin:0 auto;background:#fff;color:#0D1B3E;border:1px solid #DCE3EE;border-radius:18px;box-shadow:0 12px 40px rgba(13,27,62,.18);font:15px/1.5 Anuphan,system-ui,sans-serif;padding:18px 18px 16px;max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box}" +
    ".flxck[hidden]{display:none}.flxck *{box-sizing:border-box}.flxck-t{font-weight:700;font-size:16.5px;margin:0 0 6px}.flxck-p{color:#56637E;margin:0}.flxck-p a{color:#1A7AFF;font-weight:600}" +
    ".flxck-o{display:grid;gap:8px;margin-top:12px}.flxck-o[hidden]{display:none}.flxck-o label{display:flex;gap:10px;align-items:flex-start;background:#F3F6FB;border-radius:12px;padding:10px 12px;cursor:pointer}" +
    ".flxck-o input{margin-top:4px;width:18px;height:18px;flex:none;accent-color:#1A7AFF}.flxck-o small{display:block;color:#56637E;font-size:13.5px}" +
    ".flxck-b{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;align-items:center}.flxck-b button{font:600 15px Anuphan,system-ui,sans-serif;border-radius:12px;padding:10px 16px;cursor:pointer;border:1px solid #1A7AFF;flex:1 1 130px}" +
    ".flxck-b .p{background:#1A7AFF;color:#fff}.flxck-b .s{background:#fff;color:#1A7AFF}.flxck-b .l{border:0;background:none;color:#56637E;text-decoration:underline;flex:0 0 auto;padding:10px 6px}.flxck-b [hidden]{display:none}" +
    "@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .flxck{background:#111D3F;color:#E8EEFB;border-color:#22325C}:root:not([data-theme=light]) .flxck-p,:root:not([data-theme=light]) .flxck-o small{color:#9DADCC}:root:not([data-theme=light]) .flxck-o label{background:#0E1936}:root:not([data-theme=light]) .flxck-b .s{background:#111D3F;color:#7DB2FF;border-color:#7DB2FF}:root:not([data-theme=light]) .flxck-p a{color:#7DB2FF}}" +
    ":root[data-theme=dark] .flxck{background:#111D3F;color:#E8EEFB;border-color:#22325C}:root[data-theme=dark] .flxck-p,:root[data-theme=dark] .flxck-o small{color:#9DADCC}:root[data-theme=dark] .flxck-o label{background:#0E1936}:root[data-theme=dark] .flxck-b .s{background:#111D3F;color:#7DB2FF;border-color:#7DB2FF}:root[data-theme=dark] .flxck-p a{color:#7DB2FF}";

  function build() {
    if (box) box.remove();
    if (!document.getElementById("flxckCss")) { var st = document.createElement("style"); st.id = "flxckCss"; st.textContent = CSS; document.head.appendChild(st); }
    var pp = "https://flowlytix.co/" + (th() ? "th/" : "") + "privacy-policy/";
    var ana = has("analytics"), mkt = has("marketing");
    box = document.createElement("div");
    box.className = "flxck"; box.id = "flxCk"; box.setAttribute("role", "dialog"); box.setAttribute("aria-labelledby", "flxckT"); box.hidden = true;
    box.innerHTML =
      '<p class="flxck-t" id="flxckT">' + T("Cookies on " + product, "คุกกี้บน " + product) + "</p>" +
      '<p class="flxck-p">' + T((site ? "We use essential cookies to make this site work." : "We use essential cookies to keep you signed in and make the app work.") + " With your permission, we'd also like to use " +
        (ana && mkt ? "analytics cookies to see how the " + (site ? "site" : "app") + " is used, and advertising cookies to measure our ads" : ana ? "analytics cookies to see how the " + (site ? "site" : "app") + " is used" : "advertising cookies to measure our ads") +
        "." + (site ? "" : " Your figures are never shared with either.") + " You can change your choice any time in Cookie settings. ",
        (site ? "เราใช้คุกกี้ที่จำเป็นเพื่อให้เว็บไซต์นี้ทำงานได้" : "เราใช้คุกกี้ที่จำเป็นเพื่อให้คุณอยู่ในระบบและให้แอปทำงานได้") + " หากคุณอนุญาต เราจะใช้" +
        (ana && mkt ? "คุกกี้วิเคราะห์เพื่อดูว่ามีการใช้" + (site ? "เว็บไซต์" : "แอป") + "อย่างไร และคุกกี้โฆษณาเพื่อวัดผลโฆษณาของเรา" : ana ? "คุกกี้วิเคราะห์เพื่อดูว่ามีการใช้" + (site ? "เว็บไซต์" : "แอป") + "อย่างไร" : "คุกกี้โฆษณาเพื่อวัดผลโฆษณาของเรา") +
        (site ? "" : " โดยไม่มีการส่งตัวเลขของคุณให้ใคร") + " คุณเปลี่ยนตัวเลือกได้ทุกเมื่อที่ การตั้งค่าคุกกี้ ") +
      '<a href="' + pp + '" target="_blank" rel="noopener">' + T("Privacy Policy", "นโยบายความเป็นส่วนตัว") + "</a></p>" +
      '<div class="flxck-o" id="flxckO" hidden>' +
      '<label><input type="checkbox" checked disabled><span><b>' + T("Essential", "จำเป็น") + "</b><small>" + (site ? T("Needed for the site to work. Always on.", "จำเป็นต่อการทำงานของเว็บไซต์ เปิดอยู่เสมอ") : T("Sign-in and the app itself. Always on.", "การเข้าสู่ระบบและตัวแอป เปิดอยู่เสมอ")) + "</small></span></label>" +
      (ana ? '<label><input type="checkbox" id="flxckA"><span><b>' + T("Analytics", "การวิเคราะห์") + "</b><small>" + T("Counts visits and shows which pages help (Google Analytics).", "นับการเข้าชมและดูว่าหน้าไหนมีประโยชน์ (Google Analytics)") + "</small></span></label>" : "") +
      (mkt ? '<label><input type="checkbox" id="flxckM"><span><b>' + T("Advertising", "โฆษณา") + "</b><small>" + T("Measures our ads (Meta, Google): page views, sign-ups and purchases only.", "วัดผลโฆษณาของเรา (Meta, Google): เฉพาะการเข้าชม การสมัคร และการซื้อ") + "</small></span></label>" : "") +
      "</div>" +
      '<div class="flxck-b"><button type="button" class="p" data-ck="all">' + T("Accept all", "ยอมรับทั้งหมด") + '</button><button type="button" class="s" data-ck="none">' + T("Reject all", "ปฏิเสธทั้งหมด") +
      '</button><button type="button" class="l" data-ck="choose" id="flxckC">' + T("Choose", "เลือกเอง") + '</button><button type="button" class="s" data-ck="save" id="flxckS" hidden>' + T("Save my choices", "บันทึกตัวเลือก") + "</button></div>";
    document.body.appendChild(box);
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ck]"); if (!b) return;
      var k = b.getAttribute("data-ck"), A = document.getElementById("flxckA"), M = document.getElementById("flxckM");
      if (k === "all") decide({ analytics: true, marketing: true });
      else if (k === "none") decide({ analytics: false, marketing: false });
      else if (k === "choose") detail(true);
      else if (k === "save") decide({ analytics: !!(A && A.checked), marketing: !!(M && M.checked) });
    });
  }
  function detail(on) {
    document.getElementById("flxckO").hidden = !on; document.getElementById("flxckS").hidden = !on; document.getElementById("flxckC").hidden = on;
  }
  function show(withDetail) {
    build();
    var c = read() || { analytics: false, marketing: false }, A = document.getElementById("flxckA"), M = document.getElementById("flxckM");
    if (A) A.checked = c.analytics; if (M) M.checked = c.marketing;
    detail(!!withDetail); box.hidden = false;
  }
  function hide() { if (box) box.hidden = true; }

  window.flxCookieSettings = function () { show(true); };
  document.addEventListener("click", function (e) { var l = e.target.closest && e.target.closest("[data-ck-open]"); if (l) { e.preventDefault(); show(true); } });

  function start() {
    var saved = read();
    if (saved) { signal(saved); enable(saved); }
    else if (has("analytics") || has("marketing")) show(false);
  }
  /* after the page's own scripts (deferred and module scripts run before DOMContentLoaded), so the app has set its language */
  var started = false; function once() { if (!started) { started = true; start(); } }
  if (document.readyState === "complete") once(); else { document.addEventListener("DOMContentLoaded", once); window.addEventListener("load", once); }
})();

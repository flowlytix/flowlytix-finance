// Google Analytics 4: added to the <head> of every HTML page here, so the tag lives in one place (not in index.html / pro.html).
// Change or remove the ID only here. It sends page visits, plus sign_up / start_trial / purchase from index.html (pxOnce); never anyone's figures.
export const GA4_ID = "G-NLH48XC1WE";
// Google Tag Manager container (owner's GTM-T26BBPLW), for tags the owner adds himself. GA4 is NOT set up through it on these
// pages (the gtag above already does it); a GA4 / Google tag for the same ID in GTM would count every visit twice.
// The app also pushes {event: "sign_up" | "start_trial" | "purchase"} to the dataLayer, for GTM triggers.
export const GTM_ID = "GTM-T26BBPLW";

// Cookie consent (owner, 2 Nov 2026: every Flowlytix site asks first; /consent.js, same banner and choice as flowlytix.co).
// Google consent mode starts as all denied; the tags themselves wait as type="text/plain" until consent.js runs them for the
// categories the visitor allowed: Google Analytics = analytics, GTM = analytics or advertising. gtag() and dataLayer exist from the
// start, so the app's events queue in the page and are sent only if the visitor says yes.
export const consentDefault =
  `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
  `gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});</script>`;

export const gaTag = id =>
  `<script type="text/plain" data-flx-c="analytics" data-flx-src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>` +
  `<script>gtag('js',new Date());gtag('config','${id}');</script>`;

export const gtmTag = id =>
  `<script type="text/plain" data-flx-c="analytics marketing">(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],` +
  `j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);` +
  `})(window,document,'script','dataLayer','${id}');</script>`;

const PRODUCT = host => /^survey\./.test(host) ? "Flowlytix" : "Flowlytix Money";
export const consentTag = host => `<script src="/consent.js" defer data-product="${PRODUCT(host || "")}"></script>`;

// Appended at the end of <head>, so it runs after the page's own head scripts
// (index.html takes the Stripe checkout id out of the address before any tracking sees it).
export function withAnalytics(res, id = GA4_ID, gtm = GTM_ID, host = "") {
  if (!/^G-[A-Z0-9]+$/.test(id || "") || res.status !== 200 || !/text\/html/i.test(res.headers.get("content-type") || "")) return res;
  return new HTMLRewriter().on("head", { element(e) { e.append(consentDefault + gaTag(id) + (/^GTM-[A-Z0-9]+$/.test(gtm || "") ? gtmTag(gtm) : "") + consentTag(host), { html: true }); } }).transform(res);
}

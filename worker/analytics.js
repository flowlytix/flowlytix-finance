// Google Analytics 4: added to the <head> of every HTML page here, so the tag lives in one place (not in index.html / pro.html).
// Change or remove the ID only here. It sends page visits, plus sign_up / start_trial / purchase from index.html (pxOnce); never anyone's figures.
export const GA4_ID = "G-NLH48XC1WE";

export const gaTag = id =>
  `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>` +
  `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`;

// Appended at the end of <head>, so it runs after the page's own head scripts
// (index.html takes the Stripe checkout id out of the address before any tracking sees it).
export function withAnalytics(res, id = GA4_ID) {
  if (!/^G-[A-Z0-9]+$/.test(id || "") || res.status !== 200 || !/text\/html/i.test(res.headers.get("content-type") || "")) return res;
  return new HTMLRewriter().on("head", { element(e) { e.append(gaTag(id), { html: true }); } }).transform(res);
}

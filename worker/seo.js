// Search and share tags for the public pages, in one place (like analytics.js). The worker adds them to the HTML on the way out:
// title, description, canonical, English/Thai alternates (?lang=th is the Thai address), share picture (og/ + Twitter card),
// structured data, and for / and /work a short readable summary inside #app, so search engines that don't run the app's
// JavaScript still see what Money is. The app replaces that summary as soon as it starts; it is the same for every visitor.
// Edit the wording here; add a page here AND in sitemap.xml.
export const SITE = "https://money.flowlytix.co";

const PAGES = {
  "/": {
    img: "money",
    en: { title: "Flowlytix Money · Salary planner, Thai tax and yearly bills",
      desc: "Free money planner for Thai salaries: give every baht of your pay a job, see your tax before it's due, cover yearly bills and track savings, gold and funds. Your figures stay in your own Google Sheet." },
    th: { title: "Flowlytix Money · วางแผนเงินเดือน ภาษี และบิลรายปี",
      desc: "แอปวางแผนการเงินฟรีสำหรับมนุษย์เงินเดือน: แบ่งเงินเดือนทุกบาทให้มีหน้าที่ รู้ภาษีก่อนถึงกำหนด เตรียมเงินสำหรับบิลรายปี และติดตามเงินออม ทองคำ และกองทุน ตัวเลขของคุณอยู่ใน Google Sheet ของคุณเอง" },
  },
  "/work": {
    img: "work",
    en: { title: "Work log · Log your OT and check your payslip · Flowlytix Money",
      desc: "Free OT and leave log for Thai workers: log OT ×1, ×1.5, ×2 and ×3 day by day, see what your OT should pay, and check it against your payslip." },
    th: { title: "Work log · บันทึกโอทีและตรวจสลิปเงินเดือน · Flowlytix Money",
      desc: "บันทึกโอที วันลา และวันขาดงานฟรีทีละวัน รู้ว่าโอที ×1, ×1.5, ×2 และ ×3 ควรได้เท่าไร แล้วตรวจกับสลิปเงินเดือน" },
  },
  "/pro": {
    img: "pro",
    en: { title: "Flowlytix Money Pro · See every month ahead",
      desc: "Plan every month for free. Pro shows every month ahead, so you know today whether next year's bills are covered, and the fastest way out of card and loan debt. ฿490 a year founding price, or ฿99 a month." },
    th: { title: "Flowlytix Money Pro · เห็นทุกเดือนล่วงหน้า",
      desc: "วางแผนทุกเดือนได้ฟรี Pro แสดงทุกเดือนล่วงหน้า รู้ตั้งแต่วันนี้ว่าบิลปีหน้ามีเงินพอไหม และวิธีปิดหนี้บัตรและสินเชื่อที่เร็วที่สุด ราคาผู้ร่วมก่อตั้ง ฿490 ต่อปี หรือ ฿99 ต่อเดือน" },
  },
  "/template": {
    img: null, ogImage: "/templates/preview-year-view.jpg",
    en: { title: "Free yearly bills template · Flowlytix",
      desc: "A free spreadsheet for Excel and Google Sheets: list your bills once and see, month by month, which months your bills are bigger than your pay. English and Thai." },
    th: { title: "เทมเพลตบิลทั้งปี ฟรี · Flowlytix",
      desc: "สเปรดชีตฟรีสำหรับ Excel และ Google Sheets: ใส่บิลครั้งเดียว แล้วเห็นทีละเดือนว่าเดือนไหนบิลมากกว่าเงินเดือน มีทั้งภาษาไทยและอังกฤษ" },
  },
};

// The readable summary inside #app for / and /work (what the landing says, as plain HTML)
const PRE = {
  "/": {
    en: `<h2>Plan your salary, your tax and your yearly bills in one place</h2>
<p>Flowlytix Money is a free money planner for people paid a monthly salary in Thailand. Give every baht of your pay a job, see your income tax before it's due, set money aside for yearly bills like car insurance and school fees, and watch your savings, gold and funds grow.</p>
<ul><li>Plan your payday: split your take-home into categories, month by month.</li><li>Bills ahead: see the next 12 months of bills and whether you've set enough aside.</li><li>Thai salary and tax: social security, provident fund, allowances and the tax you will pay this year.</li><li>Month-end check-in: what you really spent, and a suggested plan for next month.</li><li>Net worth: bank accounts, gold at today's price, funds at the latest official NAV, cards and loans.</li></ul>
<p>Your figures stay in your own Google Sheet. Money can only open the one Sheet it creates, and Flowlytix keeps no copy of your figures.</p>
<p><a href="/?lang=th">ภาษาไทย</a> · <a href="/pro">Money Pro</a> · <a href="/template">Free yearly bills template</a> · <a href="/work">Work log: OT and leave</a></p>`,
    th: `<h2>วางแผนเงินเดือน ภาษี และบิลรายปีไว้ในที่เดียว</h2>
<p>Flowlytix Money คือแอปวางแผนการเงินฟรีสำหรับคนที่ได้เงินเดือนในประเทศไทย แบ่งเงินเดือนทุกบาทให้มีหน้าที่ รู้ภาษีเงินได้ก่อนถึงกำหนด กันเงินไว้สำหรับบิลรายปี เช่น ประกันรถและค่าเทอม และติดตามเงินออม ทองคำ และกองทุนให้เติบโต</p>
<ul><li>วางแผนวันเงินเดือนออก: แบ่งเงินเดือนสุทธิเป็นหมวดหมู่ ทีละเดือน</li><li>บิลที่ต้องจ่ายข้างหน้า: เห็นบิล 12 เดือนข้างหน้า และรู้ว่ากันเงินไว้พอไหม</li><li>เงินเดือนและภาษี: ประกันสังคม กองทุนสำรองเลี้ยงชีพ ค่าลดหย่อน และภาษีที่ต้องจ่ายปีนี้</li><li>เช็กอินสิ้นเดือน: ใช้จริงไปเท่าไร และแผนแนะนำสำหรับเดือนหน้า</li><li>ความมั่งคั่งสุทธิ: บัญชีธนาคาร ทองคำราคาวันนี้ กองทุนตาม NAV ล่าสุด บัตรเครดิตและสินเชื่อ</li></ul>
<p>ตัวเลขของคุณอยู่ใน Google Sheet ของคุณเอง Money เปิดได้เฉพาะ Sheet ที่สร้างเอง และ Flowlytix ไม่เก็บสำเนาตัวเลขของคุณ</p>
<p><a href="/">English</a> · <a href="/pro?lang=th">Money Pro</a> · <a href="/template?lang=th">เทมเพลตบิลรายปีฟรี</a> · <a href="/work?lang=th">Work log: บันทึกโอทีและวันลา</a></p>`,
  },
  "/work": {
    en: `<h2>Work log: log your OT, leave and shifts, then check your payslip</h2>
<p>A free OT and leave log for people paid by the month or by the day in Thailand. Log OT at ×1, ×1.5, ×2 and ×3 day by day, mark day and night shifts, leave and days off, and see what your OT and allowances should pay for each pay period. Then check the numbers against your payslip.</p>
<ul><li>Your own OT period, for example the 16th to the 15th, paid on the 28th.</li><li>Paid twice a month or a daily wage: both work.</li><li>Expected pay: salary, allowances, OT, social security and about how much reaches your account.</li></ul>
<p><a href="/work?lang=th">ภาษาไทย</a> · <a href="/">Flowlytix Money</a></p>`,
    th: `<h2>Work log: บันทึกโอที วันลา และกะ แล้วตรวจกับสลิปเงินเดือน</h2>
<p>บันทึกโอทีและวันลาฟรี สำหรับคนที่ได้เงินเดือนรายเดือนหรือค่าแรงรายวันในประเทศไทย บันทึกโอที ×1, ×1.5, ×2 และ ×3 ทีละวัน ระบุกะเช้า กะดึก วันลา และวันหยุด แล้วดูว่าโอทีและเงินเพิ่มของแต่ละรอบควรได้เท่าไร จากนั้นตรวจกับสลิปเงินเดือน</p>
<ul><li>รอบโอทีของคุณเอง เช่น วันที่ 16 ถึง 15 จ่ายวันที่ 28</li><li>จ่ายเดือนละ 2 ครั้ง หรือค่าแรงรายวัน ก็ใช้ได้</li><li>ค่าจ้างที่คาดว่าจะได้: เงินเดือน เงินเพิ่ม โอที ประกันสังคม และยอดที่น่าจะเข้าบัญชี</li></ul>
<p><a href="/work">English</a> · <a href="/?lang=th">Flowlytix Money</a></p>`,
  },
};

const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pathOf = url => url.pathname.replace(/\/index\.html$/, "/").replace(/(.)\/$/, "$1") || "/";
export const seoLang = url => (url.searchParams.get("lang") === "th" ? "th" : "en");
const addr = (path, lang) => SITE + path + (lang === "th" ? "?lang=th" : "");

// Everything added at the end of <head> for one page in one language (pure, so the tests can check it)
export function seoTags(path, lang) {
  const P = PAGES[path]; if (!P) return "";
  const t = P[lang], img = P.ogImage ? SITE + P.ogImage : `${SITE}/og/${P.img}-${lang}.jpg`;
  let h = `<meta name="description" content="${esc(t.desc)}">` +
    `<link rel="canonical" href="${addr(path, lang)}">` +
    `<link rel="alternate" hreflang="en" href="${addr(path, "en")}"><link rel="alternate" hreflang="th" href="${addr(path, "th")}">` +
    `<link rel="alternate" hreflang="x-default" href="${addr(path, "en")}">` +
    `<meta property="og:type" content="website"><meta property="og:site_name" content="Flowlytix Money">` +
    `<meta property="og:title" content="${esc(t.title)}"><meta property="og:description" content="${esc(t.desc)}">` +
    `<meta property="og:url" content="${addr(path, lang)}"><meta property="og:image" content="${img}">` +
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="${P.ogImage ? 954 : 630}">` +
    `<meta property="og:locale" content="${lang === "th" ? "th_TH" : "en_US"}"><meta property="og:locale:alternate" content="${lang === "th" ? "en_US" : "th_TH"}">` +
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(t.title)}">` +
    `<meta name="twitter:description" content="${esc(t.desc)}"><meta name="twitter:image" content="${img}">`;
  if (path === "/") h += `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Flowlytix Money", url: SITE + "/",
    applicationCategory: "FinanceApplication", operatingSystem: "Web, iPhone, Android", inLanguage: ["en", "th"],
    description: PAGES["/"].en.desc, image: `${SITE}/og/money-en.jpg`,
    offers: [{ "@type": "Offer", price: "0", priceCurrency: "THB", name: "Free" },
      { "@type": "Offer", price: "490", priceCurrency: "THB", name: "Pro, founding price per year" }],
    publisher: { "@type": "Organization", name: "Flowlytix", url: "https://flowlytix.co", logo: `${SITE}/icons/money-512.png` },
  }).replace(/</g, "\\u003c")}</script>`;
  return h;
}
export const seoPre = (path, lang) => PRE[path]?.[lang] || "";
export const seoTitle = (path, lang) => PAGES[path]?.[lang]?.title || "";

// The page's own description / og / twitter / canonical tags are removed and ours added, so there's one of each
const DROP = 'meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], link[rel="alternate"][hreflang]';
export function withSeo(res, url) {
  const path = pathOf(url);
  if (!PAGES[path] || res.status !== 200 || !/text\/html/i.test(res.headers.get("content-type") || "")) return res;
  const lang = seoLang(url), pre = seoPre(path, lang);
  let rw = new HTMLRewriter()
    .on("html", { element(e) { e.setAttribute("lang", lang); } })
    .on("head > title", { element(e) { e.setInnerContent(seoTitle(path, lang)); } })
    .on(DROP, { element(e) { e.remove(); } })
    .on("head", { element(e) { e.append(seoTags(path, lang), { html: true }); } });
  if (pre) rw = rw.on("main#app", { element(e) { e.setInnerContent(`<div class="section seo-pre"><div class="panel pad">${pre}</div></div>`, { html: true }); } });
  return rw.transform(res);
}

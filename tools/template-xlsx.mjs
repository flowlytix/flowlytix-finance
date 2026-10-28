// Builds the free "Yearly bills" template: templates/flowlytix-yearly-bills.xlsx (money.flowlytix.co/templates/...).
// Run: node tools/template-xlsx.mjs   (no packages needed; writes the .xlsx by hand so it opens in Excel, Google Sheets
// and LibreOffice the same way).
//
// THE RULE: the template holds the inputs and shows the problem; Money solves it. Allowed: a bill list, income per month,
// and a year view that only ADDS UP (bills due per month vs income, the difference, red when bills > income).
// Never add set-aside / sinking-fund amounts, running balances, shortfall forecasts or "save this much a month" here.
//
// The Bills columns match Money's plan items (Item = name, Category = wallet, How often = freq, Amount, First due = due,
// End month = end), so "Import from my template" in the app can read them. Keep column order A–F if you change this file.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateRawSync, crc32 } from "node:zlib";

const OUT = new URL("../templates/flowlytix-yearly-bills.xlsx", import.meta.url);
const PRO_URL = "https://money.flowlytix.co/pro?utm_source=template&utm_medium=xlsx&utm_campaign=yearly-bills";
const START = [2027, 1]; // Year view starts Jan 2027 unless the person changes it

// Brand (same as Money): navy text, blue→teal gradient. Spreadsheets can't all show gradients, so header rows step the
// colour from blue to teal cell by cell, which looks the same everywhere.
const NAVY = "0D1B3E", BLUE = "1A7AFF", TEAL = "00C2A8", FONT = "Anuphan";

// "How often": bilingual choices. Money's own values are the English part before " / ".
export const FREQS = [["Monthly", "รายเดือน"], ["Quarterly", "รายไตรมาส"], ["Twice a year", "ปีละสองครั้ง"], ["Annual", "รายปี"], ["One-off", "ครั้งเดียว"]];
const STEP = { "Monthly": 1, "Quarterly": 3, "Twice a year": 6, "Annual": 12, "One-off": 0 };
// Money's default category names (the sample data in index.html), offered as examples for free typing.
const CATS_EN = "Food, Transport, Bills, Phone & internet, Sinking fund, Shopping, Credit card, Family";
const CATS_TH = "Food (อาหาร), Transport (การเดินทาง), Bills (บิล), Phone & internet, Sinking fund (กองทุนสะสม), Shopping, Family (ครอบครัว)";

// Sample rows. "(sample, delete me)" in the Item name is how the app's import knows to skip them.
export const SAMPLE_TAG = "(sample, delete me)";
const SAMPLES = [
  ["Condo rent", "Bills", "Monthly", 12000, [2027, 1]],
  ["Food", "Food", "Monthly", 9000, [2027, 1]],
  ["Health insurance", "Sinking fund", "Quarterly", 4500, [2027, 2]],
  ["Car insurance", "Sinking fund", "Annual", 12000, [2027, 3]],
  ["New Year trip", "Sinking fund", "One-off", 24000, [2027, 12]],
];
const SAMPLE_INCOME = 28000;
const FIRST = 6, LAST = 205; // Bills data rows (200 bills)

// ---------- small helpers ----------
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const col = n => { let s = ""; for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const serial = (y, m) => (Date.UTC(y, m - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000; // spreadsheet date number
const addMonth = ([y, m], k) => { const t = y * 12 + m - 1 + k; return [Math.floor(t / 12), t % 12 + 1]; };
const lerp = (a, b, t) => [0, 2, 4].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t).toString(16).padStart(2, "0")).join("").toUpperCase();

// ---------- styles (deduplicated) ----------
const fonts = [], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], borders = ['<border/>'], xfs = [];
const numFmts = { month: [164, "mmm yyyy"], diff: [165, "+#,##0;-#,##0;0"] };
const idx = (list, xml) => { let i = list.indexOf(xml); if (i < 0) { list.push(xml); i = list.length - 1; } return i; };
function font({ b, i, u, sz = 11, color = NAVY } = {}) {
  return idx(fonts, `<font>${b ? "<b/>" : ""}${i ? "<i/>" : ""}${u ? '<u/>' : ""}<sz val="${sz}"/><color rgb="FF${color}"/><name val="${FONT}"/><family val="2"/></font>`);
}
font(); // default font first
function style({ f = {}, fill, border, num, h, v = "center", wrap, indent } = {}) {
  const fi = fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
  const bi = border ? idx(borders, `<border><left/><right/><top/><bottom style="thin"><color rgb="FF${border}"/></bottom><diagonal/></border>`) : 0;
  const ni = num === "int" ? 3 : num ? numFmts[num][0] : 0;
  const al = `<alignment vertical="${v}"${h ? ` horizontal="${h}"` : ""}${wrap ? ' wrapText="1"' : ""}${indent ? ` indent="${indent}"` : ""}/>`;
  return idx(xfs, `<xf numFmtId="${ni}" fontId="${font(f)}" fillId="${fi}" borderId="${bi}" xfId="0" applyFont="1"${fi ? ' applyFill="1"' : ""}${bi ? ' applyBorder="1"' : ""}${ni ? ' applyNumberFormat="1"' : ""} applyAlignment="1">${al}</xf>`);
}
const S = {};
S.base = style();
S.title = style({ f: { b: 1, sz: 15 } });
S.h2 = style({ f: { b: 1, sz: 12 }, v: "top" });
S.h2wrap = style({ f: { b: 1, sz: 12 }, v: "top", wrap: 1 });
S.text = style({ wrap: 1, v: "top" });
S.note = style({ f: { sz: 10, color: "5B6B8C" } });
S.noteWrap = style({ f: { sz: 10, color: "5B6B8C" }, wrap: 1, v: "top" });
S.link = style({ f: { b: 1, u: 1, color: "1668E3" }, wrap: 1, v: "top" });
S.cell = style({ border: "E3E8F2" });
S.amount = style({ border: "E3E8F2", num: "int" });
S.month = style({ border: "E3E8F2", num: "month", h: "left", indent: 1 });
S.sample = style({ f: { i: 1, color: "7A879F" }, border: "E3E8F2", fill: "F5F7FB" });
S.sampleAmt = style({ f: { i: 1, color: "7A879F" }, border: "E3E8F2", fill: "F5F7FB", num: "int" });
S.sampleMonth = style({ f: { i: 1, color: "7A879F" }, border: "E3E8F2", fill: "F5F7FB", num: "month", h: "left", indent: 1 });
S.check = style({ f: { sz: 10, color: "9A5B00" }, border: "E3E8F2" });
S.helper = style({ f: { sz: 9, color: "9AA6BD" } });
S.input = style({ f: { b: 1, sz: 12 }, fill: "EAF3FF", num: "month", h: "center" });
S.total = style({ f: { b: 1 }, fill: "F0F4FA", num: "int" });
S.totalLabel = style({ f: { b: 1 }, fill: "F0F4FA" });
S.totalDiff = style({ f: { b: 1 }, fill: "F0F4FA", num: "diff" });
S.diff = style({ border: "E3E8F2", num: "diff" });
// header band / table header: one style per step of the blue→teal gradient
const bandStyles = (n, opts) => Array.from({ length: n }, (_, k) => style({ ...opts, fill: lerp(BLUE, TEAL, n > 1 ? k / (n - 1) : 0) }));
const stylesXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2">${Object.values(numFmts).map(([id, code]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`).join("")}</numFmts>
<fonts count="${fonts.length}">${fonts.join("")}</fonts>
<fills count="${fills.length}">${fills.join("")}</fills>
<borders count="${borders.length}">${borders.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="1"><dxf><font><b/><color rgb="FFB42318"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFDE2E2"/><bgColor rgb="FFFDE2E2"/></patternFill></fill></dxf></dxfs>
</styleSheet>`;

// ---------- sheets ----------
// A sheet is built as rows of cells: {r, c, v (value), f (formula), s (style), rich (runs)}.
function sheet(name) {
  const cells = new Map(), o = { name, cols: [], merges: [], heights: {}, links: [], extra: "", view: "" };
  o.set = (ref, cell) => { cells.set(ref, cell); return o; };
  o.xml = () => {
    const rows = {};
    for (const [ref, c] of cells) { const r = +ref.match(/\d+/)[0]; (rows[r] ||= []).push([ref, c]); }
    const colN = ref => ref.match(/[A-Z]+/)[0].split("").reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
    const data = Object.keys(rows).map(Number).sort((a, b) => a - b).map(r => {
      const h = o.heights[r] ? ` ht="${o.heights[r]}" customHeight="1"` : "";
      return `<row r="${r}"${h}>` + rows[r].sort((a, b) => colN(a[0]) - colN(b[0])).map(([ref, c]) => {
        const s = c.s !== undefined ? ` s="${c.s}"` : "";
        if (c.f !== undefined) {
          const t = typeof c.v === "string" ? ' t="str"' : "";
          return `<c r="${ref}"${s}${t}><f>${esc(c.f)}</f>${c.v !== undefined ? `<v>${esc(c.v)}</v>` : ""}</c>`;
        }
        if (c.rich) return `<c r="${ref}"${s} t="inlineStr"><is>${c.rich.map(([t, p]) => `<r><rPr>${p.b ? "<b/>" : ""}<sz val="${p.sz || 11}"/><color rgb="FF${p.color || NAVY}"/><rFont val="${FONT}"/></rPr><t xml:space="preserve">${esc(t)}</t></r>`).join("")}</is></c>`;
        if (typeof c.v === "number") return `<c r="${ref}"${s}><v>${c.v}</v></c>`;
        if (c.v === undefined || c.v === "") return `<c r="${ref}"${s}/>`;
        return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
      }).join("") + "</row>";
    }).join("");
    const cols = o.cols.length ? `<cols>${o.cols.map(([w, hidden], i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${hidden ? ' hidden="1"' : ""}/>`).join("")}</cols>` : "";
    const merges = o.merges.length ? `<mergeCells count="${o.merges.length}">${o.merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
    const links = o.links.length ? `<hyperlinks>${o.links.map((l, i) => `<hyperlink ref="${l[0]}" r:id="rId${i + 1}"/>`).join("")}</hyperlinks>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews>${o.view}</sheetViews><sheetFormatPr defaultRowHeight="18"/>${cols}<sheetData>${data}</sheetData>${o.protect || ""}${merges}${o.extra}${links}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  };
  o.rels = () => o.links.length ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${o.links.map((l, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(l[1])}" TargetMode="External"/>`).join("")}</Relationships>` : null;
  return o;
}
// FLOWLYTIX wordmark on a blue→teal band across `n` columns, row 1
function band(sh, n, subtitle) {
  const st = bandStyles(n, { f: { b: 1, color: "FFFFFF" } });
  st.forEach((s, k) => sh.set(col(k) + "1", { s }));
  sh.set("A1", { s: st[0], rich: [["FLOWLYTIX", { b: 1, sz: 16, color: "FFFFFF" }], ["  Money", { sz: 16, color: "FFFFFF" }], [subtitle ? "   ·   " + subtitle : "", { sz: 11, color: "FFFFFF" }]] });
  sh.heights[1] = 34;
}
const view = (opts = {}) => `<sheetView workbookViewId="0"${opts.tab ? ' tabSelected="1"' : ""}${opts.grid === false ? ' showGridLines="0"' : ""}>` +
  (opts.freeze ? `<pane ySplit="${opts.freeze - 1}" topLeftCell="A${opts.freeze}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${opts.freeze}" sqref="A${opts.freeze}"/>` : "") + "</sheetView>";

// ---- 1. Read me ----
const readme = sheet("Read me");
readme.view = view({ tab: true, grid: false });
readme.cols = [[3], [25], [25], [25], [25]];
band(readme, 5, "Yearly bills · บิลทั้งปี");
const R = [];
const p = (v, s = S.text, ht) => R.push([v, s, ht]);
p("Yearly bills: see every bill in the year, month by month", S.title, 26);
p("Free template from Flowlytix. Works in Excel, Google Sheets and Numbers.", S.note);
p("");
p("How to use it", S.h2, 22);
p("1.  Bills tab: one row per bill or regular cost (rent, food, insurance, school fees, car tax, a trip). The 5 grey rows are samples: delete them or type over them.", S.text, 36);
p("2.  How often: pick from the list (Monthly, Quarterly, Twice a year, Annual, One-off). First due month = the month of the next payment, e.g. Mar 2027 (for Monthly you can leave it empty). End month only if it stops, e.g. the last loan payment.", S.text, 52);
p("3.  Category: type your own words, or use Flowlytix Money's: " + CATS_EN + ".", S.text, 36);
p("4.  Income tab: your take-home pay for each month (what reaches your bank account).", S.text, 22);
p("5.  Year view: choose the start month. You see the bills due each month next to your income. A red row = that month's bills are more than your income.", S.text, 36);
p("Tip: add regular costs like food and transport too, so the totals compare fairly with your pay.", S.note, 20);
p("");
p("Want to know how much to set aside each month so every bill is covered? Try Flowlytix Money, Pro free for 30 days, no card needed.", S.h2wrap, 40);
p("→  money.flowlytix.co/pro", S.link, 22);
p("This file stays on your computer. Flowlytix never sees what you type in it.", S.note, 20);
p("");
p("วิธีใช้", S.h2, 22);
p("1.  แท็บ Bills: ใส่บิลหรือค่าใช้จ่ายประจำแถวละ 1 รายการ (ค่าเช่า ค่าอาหาร ประกัน ค่าเทอม ภาษีรถ ทริปเที่ยว) แถวสีเทา 5 แถวเป็นตัวอย่าง ลบทิ้งหรือพิมพ์ทับได้เลย", S.text, 36);
p("2.  ความถี่ (How often): เลือกจากรายการ (รายเดือน รายไตรมาส ปีละสองครั้ง รายปี ครั้งเดียว) เดือนที่ครบกำหนดครั้งแรก = เดือนที่ต้องจ่ายงวดถัดไป เช่น Mar 2027 (รายเดือนเว้นว่างได้) เดือนสิ้นสุดใส่เฉพาะรายการที่จะหมด เช่น งวดสุดท้ายของเงินกู้", S.text, 52);
p("3.  หมวด (Category): พิมพ์คำของคุณเอง หรือใช้หมวดของ Flowlytix Money: " + CATS_TH, S.text, 36);
p("4.  แท็บ Income: รายได้สุทธิแต่ละเดือน (เงินที่เข้าบัญชีจริง)", S.text, 22);
p("5.  แท็บ Year view: เลือกเดือนเริ่มต้น แล้วดูบิลที่ต้องจ่ายแต่ละเดือนเทียบกับรายได้ แถวสีแดง = เดือนนั้นบิลมากกว่ารายได้", S.text, 36);
p("เคล็ดลับ: ใส่ค่าใช้จ่ายประจำอย่างค่าอาหารและค่าเดินทางด้วย ยอดรวมจะเทียบกับรายได้ได้ตรงขึ้น", S.note, 20);
p("");
p("อยากรู้ว่าแต่ละเดือนต้องกันเงินไว้เท่าไร ให้มีพอจ่ายทุกบิล? ลองใช้ Flowlytix Money ใช้ Pro ฟรี 30 วัน ไม่ต้องใช้บัตร", S.h2wrap, 40);
p("→  money.flowlytix.co/pro", S.link, 22);
p("ไฟล์นี้อยู่ในเครื่องของคุณเท่านั้น Flowlytix ไม่เห็นข้อมูลที่คุณกรอก", S.note, 20);
R.forEach(([v, s, ht], i) => { const r = i + 3; readme.set("B" + r, { v, s }); readme.merges.push(`B${r}:E${r}`); if (ht) readme.heights[r] = ht; if (s === S.link) readme.links.push(["B" + r, PRO_URL]); });

// ---- 2. Bills ----
const bills = sheet("Bills");
bills.view = view({ freeze: FIRST });
bills.cols = [[34], [22], [24], [14], [17], [17], [30], [8, 1], [8, 1], [8, 1], [8, 1], [8, 1]];
band(bills, 7, "Bills · รายการบิล");
bills.set("A2", { v: "One row per bill or regular cost. Grey rows are samples: delete them or type over them.", s: S.note });
bills.set("A3", { v: "ใส่แถวละ 1 รายการ แถวสีเทาเป็นตัวอย่าง ลบหรือพิมพ์ทับได้", s: S.note });
bills.set("A4", { v: "Category examples (Money's own) · ตัวอย่างหมวด: " + CATS_EN, s: S.note });
const HEAD = ["Item\nรายการ", "Category\nหมวด", "How often\nความถี่", "Amount (฿)\nจำนวนเงิน", "First due month\nเดือนแรกที่จ่าย", "End month (optional)\nเดือนสิ้นสุด (ถ้ามี)", "Check\nตรวจ"];
bandStyles(7, { f: { b: 1, color: "FFFFFF" }, wrap: 1 }).forEach((s, k) => bills.set(col(k) + "5", { v: HEAD[k], s }));
bills.heights[5] = 36;
["step", "first", "end", "amount", "every"].forEach((h, k) => bills.set(col(7 + k) + "5", { v: h, s: S.helper }));

// Hidden helper columns H–L turn each row into numbers the Year view can add up (month index = year*12 + month-1):
// H step (1 Monthly, 3, 6, 12, 0 One-off, -1 unknown) · I first due · J last month · K amount if the row is complete · L every N months
const has = (c, words) => "OR(" + words.map(w => `ISNUMBER(SEARCH("${w}",${c}))`).join(",") + ")";
const stepF = r => `IF(C${r}="",-1,IF(${has("C" + r, ["Monthly", "รายเดือน"])},1,IF(${has("C" + r, ["Quarterly", "ไตรมาส"])},3,IF(${has("C" + r, ["Twice", "สองครั้ง", "2 ครั้ง"])},6,IF(${has("C" + r, ["Annual", "Yearly", "รายปี"])},12,IF(${has("C" + r, ["One-off", "Once", "ครั้งเดียว"])},0,-1))))))`;
const firstF = r => `IF(ISNUMBER(E${r}),YEAR(E${r})*12+MONTH(E${r})-1,IF(AND(E${r}="",H${r}=1),0,-1))`;
const endF = r => `IF(H${r}=0,I${r},IF(ISNUMBER(F${r}),YEAR(F${r})*12+MONTH(F${r})-1,999999))`;
const amtF = r => `IF(AND(ISNUMBER(D${r}),H${r}>=0,I${r}>=0),D${r},0)`;
const everyF = r => `MAX(H${r},1)`;
// The Check column only checks what was typed (an input check, not advice).
const checkF = r => `IF(COUNTA(A${r}:F${r})=0,"",IF(A${r}="","⚠ Item? / ชื่อรายการ",IF(NOT(ISNUMBER(D${r})),"⚠ Amount? / จำนวนเงิน",IF(H${r}<0,"⚠ How often? / ความถี่",IF(I${r}<0,"⚠ First due month? / เดือนแรก",IF(J${r}<I${r},"⚠ End before first / สิ้นสุดก่อนเริ่ม","✓"))))))`;
// cached values, so previews (phone, email) show the right numbers before a spreadsheet recalculates
const rowCalc = row => {
  if (!row) return { H: -1, I: -1, J: 999999, K: 0, L: 1, G: "" };
  const [, , freq, amt, due] = row, H = STEP[freq], I = due[0] * 12 + due[1] - 1, J = H === 0 ? I : 999999;
  return { H, I, J, K: amt, L: Math.max(H, 1), G: "✓" };
};
const freqLabel = f => FREQS.find(x => x[0] === f).join(" / ");
for (let r = FIRST; r <= LAST; r++) {
  const sm = SAMPLES[r - FIRST], c = rowCalc(sm);
  if (sm) {
    bills.set("A" + r, { v: `${sm[0]} ${SAMPLE_TAG}`, s: S.sample }).set("B" + r, { v: sm[1], s: S.sample }).set("C" + r, { v: freqLabel(sm[2]), s: S.sample })
      .set("D" + r, { v: sm[3], s: S.sampleAmt }).set("E" + r, { v: serial(...sm[4]), s: S.sampleMonth }).set("F" + r, { s: S.sampleMonth });
  } else {
    bills.set("A" + r, { s: S.cell }).set("B" + r, { s: S.cell }).set("C" + r, { s: S.cell }).set("D" + r, { s: S.amount }).set("E" + r, { s: S.month }).set("F" + r, { s: S.month });
  }
  bills.set("G" + r, { f: checkF(r), v: c.G, s: S.check });
  bills.set("H" + r, { f: stepF(r), v: c.H, s: S.helper }).set("I" + r, { f: firstF(r), v: c.I, s: S.helper }).set("J" + r, { f: endF(r), v: c.J, s: S.helper })
    .set("K" + r, { f: amtF(r), v: c.K, s: S.helper }).set("L" + r, { f: everyF(r), v: c.L, s: S.helper });
}
const dv = (sqref, attrs, f1, f2, title, msg) => `<dataValidation ${attrs} allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="${esc(title)}" error="${esc(msg)}" sqref="${sqref}"><formula1>${esc(f1)}</formula1>${f2 ? `<formula2>${esc(f2)}</formula2>` : ""}</dataValidation>`;
bills.extra = `<dataValidations count="3">` +
  dv(`C${FIRST}:C${LAST}`, 'type="list"', `"${FREQS.map(f => f.join(" / ")).join(",")}"`, null, "How often / ความถี่", "Pick one from the list. · เลือกจากรายการ") +
  dv(`D${FIRST}:D${LAST}`, 'type="decimal" operator="greaterThanOrEqual"', "0", null, "Amount / จำนวนเงิน", "Type a number in baht, e.g. 12000. · พิมพ์ตัวเลข เช่น 12000") +
  dv(`E${FIRST}:F${LAST}`, 'type="date" operator="between"', String(serial(2000, 1)), String(serial(2100, 12)), "Month / เดือน", "Type a month like Mar 2027 or 1/3/2027. · พิมพ์เดือน เช่น Mar 2027") +
  `</dataValidations>`;

// ---- 3. Income ----
const income = sheet("Income");
income.view = view({ freeze: 6 });
income.cols = [[16], [22], [60]];
band(income, 3, "Income · รายได้");
income.set("A2", { v: "Your take-home pay for each month (what reaches your bank account). Grey = sample, type yours over it.", s: S.note });
income.set("A3", { v: "รายได้สุทธิแต่ละเดือน (เงินที่เข้าบัญชีจริง) สีเทา = ตัวอย่าง พิมพ์ทับได้เลย", s: S.note });
income.set("A4", { v: "Months follow the start month on the Year view tab. · เดือนเรียงตามเดือนเริ่มต้นในแท็บ Year view", s: S.note });
bandStyles(2, { f: { b: 1, color: "FFFFFF" }, wrap: 1 }).forEach((s, k) => income.set(col(k) + "5", { v: ["Month\nเดือน", "Take-home pay (฿)\nรายได้สุทธิ"][k], s }));
income.heights[5] = 36;

// ---- 4. Year view ----
const year = sheet("Year view");
year.view = view({ grid: false });
year.cols = [[16], [18], [18], [22], [4], [40]];
band(year, 4, "Year view · ภาพรวมทั้งปี");
year.set("A3", { v: "Start month · เดือนเริ่มต้น", s: S.h2 });
year.set("C3", { v: serial(...START), s: S.input });
year.set("D3", { v: "← change it · เปลี่ยนได้", s: S.note });
bandStyles(4, { f: { b: 1, color: "FFFFFF" }, wrap: 1 }).forEach((s, k) => year.set(col(k) + "5", { v: ["Month\nเดือน", "Bills due (฿)\nบิลที่ต้องจ่าย", "Income (฿)\nรายได้", "Difference (฿)\nรายได้ − บิล"][k], s }));
year.heights[5] = 36;
const START_REF = "'Year view'!$C$3";
const due = idx => SAMPLES.reduce((t, [, , f, a, d]) => { const i = d[0] * 12 + d[1] - 1, st = STEP[f]; const last = st === 0 ? i : 999999;
  return t + (i <= idx && idx <= last && (idx - i) % Math.max(st, 1) === 0 ? a : 0); }, 0);
const rng = c => `Bills!$${c}$${FIRST}:$${c}$${LAST}`;
let totB = 0, totI = 0;
for (let k = 0; k < 12; k++) {
  const r = 6 + k, [y, m] = addMonth(START, k), mi = y * 12 + m - 1, mSer = serial(y, m), b = due(mi);
  totB += b; totI += SAMPLE_INCOME;
  income.set("A" + r, { f: `DATE(YEAR(${START_REF}),MONTH(${START_REF})+${k},1)`, v: mSer, s: S.month });
  income.set("B" + r, { v: SAMPLE_INCOME, s: S.sampleAmt });
  year.set("A" + r, { f: `DATE(YEAR($C$3),MONTH($C$3)+${k},1)`, v: mSer, s: S.month });
  const mIdx = `(YEAR(A${r})*12+MONTH(A${r})-1)`;
  year.set("B" + r, { f: `SUMPRODUCT(${rng("K")}*(${rng("I")}<=${mIdx})*(${rng("J")}>=${mIdx})*(MOD(${mIdx}-${rng("I")},${rng("L")})=0))`, v: b, s: S.amount });
  year.set("C" + r, { f: `IF(Income!B${r}="","",Income!B${r})`, v: SAMPLE_INCOME, s: S.amount });
  year.set("D" + r, { f: `IF(C${r}="","",C${r}-B${r})`, v: SAMPLE_INCOME - b, s: S.diff });
}
year.set("A18", { v: "Year total · รวมทั้งปี", s: S.totalLabel });
year.set("B18", { f: "SUM(B6:B17)", v: totB, s: S.total });
year.set("C18", { f: "SUM(C6:C17)", v: totI, s: S.total });
year.set("D18", { f: "SUM(D6:D17)", v: totI - totB, s: S.totalDiff });
year.set("A20", { v: "Red row = that month's bills are more than your income. · แถวสีแดง = เดือนนั้นบิลมากกว่ารายได้", s: S.note });
year.set("A22", { v: "Want to know how much to set aside each month so every bill is covered? Try Flowlytix Money, Pro free for 30 days, no card needed.", s: S.h2wrap });
year.set("A23", { v: "อยากรู้ว่าแต่ละเดือนต้องกันเงินไว้เท่าไร ให้มีพอจ่ายทุกบิล? ลองใช้ Flowlytix Money ใช้ Pro ฟรี 30 วัน ไม่ต้องใช้บัตร", s: S.h2wrap });
year.merges.push("A22:D22", "A23:D23"); year.heights[22] = year.heights[23] = 40;
year.set("A24", { v: "→  money.flowlytix.co/pro", s: S.link });
year.links.push(["A24", PRO_URL]); year.merges.push("A24:D24");
year.extra = `<conditionalFormatting sqref="A6:D17"><cfRule type="expression" dxfId="0" priority="1"><formula>AND(ISNUMBER($C6),$B6&gt;$C6)</formula></cfRule></conditionalFormatting>`;

// ---------- workbook + zip ----------
const SHEETS = [readme, bills, income, year];
const files = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${SHEETS.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Flowlytix yearly bills</dc:title><dc:creator>Flowlytix</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-10-28T00:00:00Z</dcterms:created></cp:coreProperties>`,
  "docProps/app.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Flowlytix</Application></Properties>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${SHEETS.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${SHEETS.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${SHEETS.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
};
SHEETS.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = s.xml(); const r = s.rels(); if (r) files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = r; });
files["xl/styles.xml"] = stylesXml(); // after the sheets, which add their styles

function zip(entries) {
  const local = [], central = []; let off = 0;
  const T = (0 << 11) | (0 << 5) | 0, D = ((2026 - 1980) << 9) | (10 << 5) | 28; // fixed date: the same input gives the same file
  for (const [name, text] of entries) {
    const nm = Buffer.from(name), raw = Buffer.from(text), data = deflateRawSync(raw, { level: 9 }), crc = crc32(raw);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(T, 10); h.writeUInt16LE(D, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(T, 12); c.writeUInt16LE(D, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    local.push(h, nm, data); central.push(c, nm); off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10);
  e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...local, cd, e]);
}
mkdirSync(new URL("../templates/", import.meta.url), { recursive: true });
writeFileSync(OUT, zip(Object.entries(files)));
console.log("Wrote", OUT.pathname);

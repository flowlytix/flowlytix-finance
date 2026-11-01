// Blog post /blog/salary-tax-take-home: the calculator's tax maths (between the "blog calculator: tax maths" markers),
// checked against the figures the post prints and against the app's own tax steps in index.html.
// Run: node tests/blog-tax.test.mjs
import { readFileSync } from "node:fs";
const page = readFileSync(new URL("../blog/salary-tax-take-home.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const a = page.indexOf("/* ---- blog calculator: tax maths"), b = page.indexOf("/* ---- end blog calculator: tax maths");
if (a < 0 || b < 0) { console.log("FAIL calculator block not found"); process.exit(1); }
const C = new Function(page.slice(a, b) + "\nreturn {taxOn,salaryTax,TAX_STEPS};")();
const out = []; const t = (n, f) => { let ok = false; try { ok = f(); } catch (e) { n += " (" + e.message + ")"; } out.push((ok ? "PASS " : "FAIL ") + n); };
const R = n => Math.round(n);
t("same tax steps as the app", () => { const m = app.match(/const BRACKETS=(\[.*?\]\]);/); return m && JSON.stringify(eval(m[1])) === JSON.stringify(C.TAX_STEPS); });
t("same expense and personal allowance as the app", () => /expenseRate:\.5,expenseMax:100000,personal:60000/.test(app));
for (const [sal, year, month, home] of [[50000, 20450, 1704, 47421], [80000, 72900, 6075, 73050], [100000, 122375, 10198, 88927]]) {
  t(`฿${sal}: table says ฿${year} a year, ฿${month} a month, ฿${home} take-home`, () => { const r = C.salaryTax(sal, 0, true); return R(r.taxYear) === year && R(r.taxMonth) === month && R(r.takeHome) === home && r.ssoM === 875; });
  t(`฿${sal}: the post shows these exact numbers in both languages`, () => [year, month, home].every(n => page.split("฿" + n.toLocaleString("en-US")).length - 1 >= 2)); }
t("bonus example: ฿50,000 + ฿150,000 bonus = ฿39,425, about ฿19,000 more", () => { const r = C.salaryTax(50000, 150000, true); return R(r.taxYear) === 39425 && R(r.bonusTax) === 18975 && page.includes("39,425"); });
t("social security: 5% up to ฿875; off = none", () => C.salaryTax(15000, 0, true).ssoM === 750 && C.salaryTax(15000, 0, false).ssoM === 0);
t("low salary pays no tax", () => C.salaryTax(20000, 0, true).taxYear === 0);
t("expenses capped at ฿100,000", () => C.salaryTax(30000, 0, true).expenses === 100000 && C.salaryTax(10000, 0, true).expenses === 60000);
t("empty or odd input doesn't break", () => { const r = C.salaryTax("", NaN, true); return r.taxYear === 0 && r.takeHome === 0; });
t("no SSF suggested (its tax deduction ended in 2024)", () => !/SSF/.test(page));
t("never sends anything: no fetch / sendBeacon / XHR in the page", () => !/fetch\(|sendBeacon|XMLHttpRequest/.test(page));
console.log(out.join("\n")); console.log(out.filter(x => x.startsWith("PASS")).length + "/" + out.length);
if (out.some(x => x.startsWith("FAIL"))) process.exit(1);

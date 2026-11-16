// Month-end › Import spending: reads another app's export (Money Lover, MeowJot, a bank…) IN THE BROWSER.
// Loads the template file reader and the "spending import: reading the file" block from index.html on their own and checks them
// against made-up exports (no real person's data): a Money Lover style file, an app with a Type column, a bank-style
// Withdrawal/Deposit file, Thai headers and month-first dates.
// Run: node tests/spend-import.test.mjs
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const blk = (s, e) => { const a = html.indexOf(s), b = html.indexOf(e); if (a < 0 || b < 0) { console.log("FAIL block not found: " + s); process.exit(1); } return html.slice(a, b); };
const code = blk("/* ---------- template import: reading the file", "/* ---------- end template import: reading the file")
  + blk("/* ---------- spending import: reading the file", "/* ---------- end spending import: reading the file");
const L2 = (en) => en;
const M = new Function("L2", code + "\nreturn {spHeader,spDate,spMonthFirst,spRows,spParse,spGuess,impReadCsv};")(L2);
const out = []; const t = async (n, f) => { let ok = false; try { ok = await f(); } catch (e) { ok = false; n += " (" + e.message + ")"; } out.push((ok ? "PASS " : "FAIL ") + n); };
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const enc = s => new TextEncoder().encode(s).buffer;

// dates
await t("date: day first by default (Thai way)", () => eq(["19/10/2026", "05/10/2026", "5/10/26", "2026-10-19", "2026/10/19 08:30", "19 Oct 2026", "Oct 19, 2026", "19 ต.ค. 2569", "19 ตุลาคม 69"].map(d => M.spDate(d)),
  ["2026-10-19", "2026-10-05", "2026-10-05", "2026-10-19", "2026-10-19", "2026-10-19", "2026-10-19", "2026-10-19", "2026-10-19"]));
await t("date: spreadsheet number", () => M.spDate(46314) === "2026-10-19" && M.spDate(46314.5) === "2026-10-19");
await t("date: month first when the file needs it", () => M.spMonthFirst(["10/19/2026", "10/05/2026"]) === true && M.spDate("10/05/2026", true) === "2026-10-05" && M.spMonthFirst(["19/10/2026", "05/10/2026"]) === false);
await t("date: nonsense -> null", () => M.spDate("banana") === null && M.spDate("31/02/2026") === null && M.spDate("") === null);

// a Money Lover style export: negative = spent, "Exclude from report" ticks transfers, card starting balances
const ML = `Id,Date,Category,Amount,Currency,Wallet,Note,With,Event,Exclude from report,Members
1,19/10/2026,Food & Beverage,-180.00,THB,Food,,,,,
2,13/10/2026,Fuel,-1000.00,THB,Transport,,,,,
3,07/10/2026,Outgoing transfer,-5000,THB,Salary,Send to Card,,,✅,
4,07/10/2026,Credit Pay-in,5000,THB,Card,Received from Salary,,,✅,
5,02/10/2026,Outgoing transfer,-160.04,THB,Food,Adjust Balance,,,,
6,01/10/2026,Salary,50000,THB,Salary,,,,,
7,24/09/2026,Other Expense,-47689,THB,Card,Last statement balance,,,,
8,25/09/2026,Food & Beverage,-60,THB,Food,,,,,
9,25/09/2026,Food & Beverage,-60,THB,Food,,,,,`;
const p = await M.spParse(enc(ML), "export.csv");
await t("Money Lover: header found, every row read", () => p && p.rows.length === 9 && p.head.col.date === 1 && p.head.col.cat === 2 && p.head.col.amount === 3 && p.head.col.skip === 9);
const by = Object.fromEntries(p.rows.map(r => [r.id, r]));
await t("Money Lover: spending is positive", () => by[0].amt === 180 && by[0].skip === "" && by[0].cat === "Food & Beverage" && by[0].date === "2026-10-19");
await t("Money Lover: ticked transfers left out", () => by[2].skip === "excluded" && by[3].skip !== "");
await t("Money Lover: money in left out", () => by[5].skip === "in");
await t("Money Lover: balance fixes and starting balances left out", () => by[4].skip === "adjust" && by[6].skip === "adjust");
await t("Money Lover: two identical spends stay two", () => by[7].amt === 60 && by[8].amt === 60 && by[7].skip === "" && by[8].skip === "");

// an app with a Type column and positive amounts
const TY = `Date,Type,Category,Amount,Note
2026-10-03,Expense,Food,120,lunch
2026-10-03,Income,Salary,30000,
2026-10-04,Transfer,Saving,2000,`;
const q = await M.spParse(enc(TY), "x.csv");
await t("Type column: expense / income / transfer", () => eq(q.rows.map(r => [r.amt, r.skip]), [[120, ""], [30000, "in"], [2000, "excluded"]]));

// a bank-style file: Withdrawal / Deposit columns, no category, a title row above the header
const BK = `My bank statement,,,
Date,Description,Withdrawal,Deposit
10/19/2026,7-11,85.00,
10/20/2026,Salary,,30000`;
const k = await M.spParse(enc(BK), "bank.csv");
await t("bank: header below a title, month-first dates, withdrawal = spent", () => k && k.rows.length === 2 && k.rows[0].date === "2026-10-19" && k.rows[0].amt === 85 && k.rows[0].cat === "(no category)" && k.rows[0].note === "7-11" && k.rows[1].skip === "in");

// Thai headers, all amounts positive (all spending)
const TH = `วันที่,หมวดหมู่,จำนวนเงิน,บันทึก
19/10/2569,อาหาร,"1,250",ข้าว
20/10/2569,เดินทาง,45,`;
const th = await M.spParse(enc(TH), "th.csv");
await t("Thai headers, Buddhist year, commas in amounts", () => th && eq(th.rows.map(r => [r.date, r.cat, r.amt, r.skip]), [["2026-10-19", "อาหาร", 1250, ""], ["2026-10-20", "เดินทาง", 45, ""]]));

await t("no date or amount column -> not found", async () => (await M.spParse(enc("Name,Value\nx,1"), "a.csv")) === null);

// first guesses for matching
const names = ["Food", "Transport", "Shopping", "Home loan", "Bills", "Gifts & Donations", "Credit card"];
await t("guess: same name wins", () => M.spGuess("gifts & donations", names) === "Gifts & Donations");
await t("guess: keywords", () => eq(["Food & Beverage", "Fuel", "Toll fee", "Internet Bill", "Codominium", "Houseware", "อาหาร"].map(c => M.spGuess(c, names)), ["Food", "Transport", "Transport", "Bills", "Home loan", "Shopping", "Food"]));
await t("guess: transfers -> not spending", () => M.spGuess("Outgoing transfer", names) === "__skip" && M.spGuess("Credit Pay-in", names) === "__skip");
await t("guess: unknown -> not matched", () => M.spGuess("Lottery", names) === "");

out.forEach(l => console.log(l)); const f = out.filter(l => l.startsWith("FAIL")).length;
console.log(`\n${out.length - f}/${out.length} passed`); process.exit(f ? 1 : 0);

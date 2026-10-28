// "Import from my template" (index.html, Setup): reads the filled-in yearly bills template IN THE BROWSER.
// This loads the file-reading block from index.html on its own (between the two "template import: reading the file" markers)
// and checks it against the real template, a copy re-saved by a spreadsheet app (LibreOffice, like Excel / Google Sheets do), and CSV.
// Run: node tests/import.test.mjs
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const a = html.indexOf("/* ---------- template import: reading the file"), b = html.indexOf("/* ---------- end template import: reading the file");
if (a < 0 || b < 0) { console.log("FAIL import block not found in index.html"); process.exit(1); }
const L2 = (en) => en;
const M = new Function("L2", html.slice(a, b) + "\nreturn {impFreq,impMonth,impAmount,impReadCsv,impRows,impParse,impCheck,impGroupGuess};")(L2);
const out = []; const t = async (n, f) => { let ok = false; try { ok = await f(); } catch (e) { ok = false; n += " (" + e.message + ")"; } out.push((ok ? "PASS " : "FAIL ") + n); };
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);

// how often: the template's bilingual choices, English or Thai alone, and nothing else
await t("how often: bilingual, English, Thai", () => eq(["Annual / รายปี", "annual", "รายปี", "Twice a year / ปีละสองครั้ง", "ปีละ 2 ครั้ง", "One-off / ครั้งเดียว", "Monthly", "Quarterly / รายไตรมาส", "yearly"].map(M.impFreq),
  ["Annual", "Annual", "Annual", "Twice a year", "Twice a year", "One-off", "Monthly", "Quarterly", "Annual"]));
await t("how often: unknown -> null, empty -> ''", () => M.impFreq("every 2 months") === null && M.impFreq("Weekly") === null && M.impFreq("") === "" && M.impFreq(undefined) === "");
// months
await t("month: spreadsheet date number", () => M.impMonth(46447) === "2027-03" && M.impMonth("46447") === "2027-03");
await t("month: written forms", () => eq(["Mar 2027", "march 2027", "Mar-27", "2027-03", "2027-03-01", "3/2027", "1/3/2027", "13/03/2027", "03/13/2027", "2027 Mar"].map(M.impMonth), Array(10).fill("2027-03")));
await t("month: Thai names and Buddhist years", () => eq(["มี.ค. 2570", "มีนาคม 2570", "มีนาคม 70", "มี.ค. 2027", "ธ.ค. 2570"].map(M.impMonth), ["2027-03", "2027-03", "2027-03", "2027-03", "2027-12"]));
await t("month: not a month -> null, empty -> ''", () => M.impMonth("banana") === null && M.impMonth("2027-13") === null && M.impMonth("13/2027") === null && M.impMonth(5) === null && M.impMonth("") === "" && M.impMonth(null) === "");
// amounts
await t("amount: numbers, commas, ฿ and บาท", () => M.impAmount(12000) === 12000 && M.impAmount("12,000") === 12000 && M.impAmount("฿1,500 บาท") === 1500 && M.impAmount("abc") === null && M.impAmount("") === "");
// CSV
await t("csv: quotes, commas inside, Thai, BOM", () => eq(M.impReadCsv('﻿Item,Category\r\n"Rent, condo",บิล\r\n"Say ""hi""",x\n'), [["Item", "Category"], ["Rent, condo", "บิล"], ['Say "hi"', "x"]]));
await t("csv: semicolons (Excel in some languages)", () => eq(M.impReadCsv("Item;Amount\nRent;12000"), [["Item", "Amount"], ["Rent", "12000"]]));

const ctx = (over = {}) => ({ nowM: "2026-10", wallets: ["Bills", "Food", "Sinking fund", "Family"], items: [{ name: "Car insurance", wallet: "Sinking fund", freq: "Annual", amount: 12000, due: "2027-03", end: "" }], ...over });
const enc = s => new TextEncoder().encode(s).buffer;

// the template exactly as downloaded: only the 5 samples, all skipped
const tpl = readFileSync(new URL("../templates/flowlytix-yearly-bills.xlsx", import.meta.url));
await t("template as downloaded: 5 sample rows found and skipped, nothing to add", async () => { const rows = await M.impParse(tpl.buffer.slice(tpl.byteOffset, tpl.byteOffset + tpl.byteLength), "flowlytix-yearly-bills.xlsx");
  const c = M.impCheck(rows, ctx()); return rows.length === 5 && c.every(x => x.status === "sample"); });

// filled in, then saved by a spreadsheet app (shared strings, its own layout)
const fx = readFileSync(new URL("./fixtures/template-filled-libreoffice.xlsx", import.meta.url));
const filled = M.impCheck(await M.impParse(fx.buffer.slice(fx.byteOffset, fx.byteOffset + fx.byteLength), "my bills.xlsx"), ctx());
const row = n => filled.find(x => x.name === n);
await t("saved by a spreadsheet app: samples still skipped", () => filled.filter(x => x.status === "sample").length === 5);
await t("annual bill with a date cell -> ready", () => { const x = row("Home insurance"); return x.status === "ok" && x.freq === "Annual" && x.amount === 6000 && x.due === "2027-04" && x.wallet === "Bills" && !x.isNew; });
await t("category typed in lower case joins the existing one", () => { const x = row("School fees"); return x.status === "ok" && x.wallet === "Family" && !x.isNew && x.due === "2027-01" && x.freq === "Twice a year"; });
await t("unknown how often -> needs fixing, says what to use", () => { const x = row("Gym"); return x.status === "err" && /isn't a choice: use Monthly, Quarterly/.test(x.msgs.join()); });
await t("missing amount -> needs fixing", () => { const x = row("Netflix"); return x.status === "err" && x.msgs.some(m => m === "Amount is missing"); });
await t("Thai-only how often, '8,500', end month -> ready, new category", () => { const x = row("Car loan"); return x.status === "ok" && x.freq === "Monthly" && x.amount === 8500 && x.due === "2026-11" && x.end === "2027-06" && x.isNew && x.wallet === "Car"; });
await t("bad month -> plain message", () => { const x = row("Wedding gift"); return x.status === "err" && /isn't a month: write it like Mar 2027/.test(x.msgs.join()); });
await t("one-off in the past -> needs fixing", () => { const x = row("Old trip"); return x.status === "err" && x.msgs.includes("This one-off month has already passed"); });

// checking rules
const R = (o) => ({ line: 9, name: "Rent", cat: "Bills", freqRaw: "Monthly", amountRaw: 12000, dueRaw: "", endRaw: "", ...o });
await t("exact duplicate of a plan item -> already in your plan", () => M.impCheck([R({ name: "car insurance", cat: "sinking fund", freqRaw: "Annual / รายปี", amountRaw: "12,000", dueRaw: "Mar 2027" })], ctx())[0].status === "dup");
await t("same name, different amount -> added (only exact duplicates are skipped)", () => M.impCheck([R({ name: "Car insurance", cat: "Sinking fund", freqRaw: "Annual", amountRaw: 13000, dueRaw: "Mar 2027" })], ctx())[0].status === "ok");
await t("the same bill twice in the file -> second one skipped", () => eq(M.impCheck([R(), R({ line: 10 })], ctx()).map(x => x.status), ["ok", "dup"]));
await t("Monthly needs no first month; others do", () => eq(M.impCheck([R(), R({ name: "Tax", freqRaw: "Annual" })], ctx()).map(x => x.status), ["ok", "err"]));
await t("end before first -> needs fixing", () => M.impCheck([R({ dueRaw: "Jun 2027", endRaw: "Jan 2027" })], ctx())[0].msgs.includes("End month is before the first due month"));
await t("missing name / category -> needs fixing", () => { const [x] = M.impCheck([R({ name: "", cat: "" })], ctx()); return x.status === "err" && x.msgs.includes("Item name is missing") && x.msgs.includes("Category is missing"); });
await t("new category spelt two ways -> one category", () => { const c = M.impCheck([R({ cat: "Pets" }), R({ name: "Vet", cat: "pets" })], ctx()); return c[0].wallet === "Pets" && c[1].wallet === "Pets" && c[0].isNew && c[1].isNew; });
await t("sample tag in English or Thai -> skipped", () => eq(M.impCheck([R({ name: "Food (sample, delete me)" }), R({ name: "ค่าเช่า (ตัวอย่าง)" })], ctx()).map(x => x.status), ["sample", "sample"]));
await t("CSV file end to end", async () => { const rows = await M.impParse(enc("Item,Category,How often,Amount (฿),First due month,End month\nCar tax,Car,รายปี,\"2,400\",ก.ค. 2570,\n"), "bills.csv");
  const [x] = M.impCheck(rows, ctx()); return x.status === "ok" && x.freq === "Annual" && x.amount === 2400 && x.due === "2027-07"; });
await t("a file without the Item header -> not read", async () => (await M.impParse(enc("a,b\n1,2"), "x.csv")) === null);
await t("group for a new category: same name, close match, else Bills", () => { const G = ["Living", "Bills", "Sinking fund", "Transport", "Family", "Saving", "Investment"];
  return M.impGroupGuess("Sinking fund", G) === "Sinking fund" && M.impGroupGuess("Car", G) === "Transport" && M.impGroupGuess("Emergency savings", G) === "Saving" && M.impGroupGuess("Pets", G) === "Bills" && M.impGroupGuess("Pets", ["Other"]) === "Other" && M.impGroupGuess("Pets", []) === "Bills"; });

console.log(out.join("\n"));
console.log(out.filter(x => x.startsWith("PASS")).length + "/" + out.length);
if (out.some(x => x.startsWith("FAIL"))) process.exitCode = 1;

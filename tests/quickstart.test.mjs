// "Plan my year in 2 minutes" (index.html): the plan builder on its own (between the two "quick start: plan builder" markers).
// Run: node tests/quickstart.test.mjs
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const a = html.indexOf("/* ---------- quick start: plan builder"), b = html.indexOf("/* ---------- end quick start: plan builder");
if (a < 0 || b < 0) { console.log("FAIL quick start block not found in index.html"); process.exit(1); }
const Q = new Function(html.slice(a, b) + "\nreturn {QS_MONTHLY,QS_YEARLY,qsFresh,qsStart,qsDue,qsBuild,qsSummary};")();
const out = []; const t = (n, f) => { let ok = false; try { ok = f(); } catch (e) { n += " (" + e.message + ")"; } out.push((ok ? "PASS " : "FAIL ") + n); };
const fresh = () => Q.qsFresh();

t("start month follows the payday (paid 25, today 29 Oct -> Nov)", () => Q.qsStart("2026-10-29", 25) === "2026-11" && Q.qsStart("2026-10-10", 25) === "2026-10" && Q.qsStart("2026-10-29", 1) === "2026-10");
t("next due month from the start", () => Q.qsDue("2026-11", 5) === "2027-05" && Q.qsDue("2026-11", 12) === "2026-12" && Q.qsDue("2026-11", 11) === "2026-11");
{ const q = fresh(); q.pay = "30,000"; q.payday = "25";
  const P = Q.qsBuild(q, "2026-10-29", "en"), C = P.config;
  t("config: pay cycle, start month, take-home for 24 months, starter groups", () => C.cycle.day === 25 && C.cycle.label === "end" && C.startMonth === "2026-11" && Object.keys(C.income).length === 24 && C.income["2026-11"].salary === 30000 && C.groups.join() === "Living,Bills,Sinking fund,Transport,Family,Saving");
  t("only ticked monthly items are created (food, transport, phone, utilities)", () => Object.keys(P.items).sort().join() === "q_food,q_phone,q_transport,q_utilities");
  t("monthly item: Monthly, set aside its amount every month, untouched = assumed", () => { const f = P.items.q_food; return f.freq === "Monthly" && f.amount === 8000 && f.wallet === "Food" && f.reserve["2026-11"] === 8000 && f.reserve["2028-10"] === 8000 && f.assumed === true; });
  t("categories made only for what's used, in the right groups", () => C.wallets.map(w => w.name + ":" + w.group).join() === "Food:Living,Transport:Transport,Phone & internet:Bills,Utilities:Bills"); }
{ const q = fresh(); q.pay = 30000; q.payday = 25;
  q.m.food.amt = 6500; q.m.food.t = true; q.m.saving.on = true; q.m.carloan.on = true; // car loan left at 0 -> not created
  q.y.carins.on = true; q.y.carins.mons = [3]; q.y.carins.tm = [true]; q.y.prb.on = true; q.y.cartax.on = true;
  q.y.school.on = true; q.y.condo.on = true; q.y.gifts.on = true; q.y.gifts.amt = 5000;
  const P = Q.qsBuild(q, "2026-10-29", "en"), I = P.items;
  t("changed amount -> not assumed; untouched -> assumed", () => I.q_food.amount === 6500 && I.q_food.assumed === false && I.q_transport.assumed === true);
  t("Saving is a Keep item; car loan at 0 isn't created", () => I.q_saving.freq === "Keep (no payout)" && !I.q_carloan);
  t("car insurance: due next March, amount ÷ 5 months until due, then ÷ 12", () => { const c = I.q_carins; return c.freq === "Annual" && c.due === "2027-03" && c.reserve["2026-11"] === 3000 && c.reserve["2027-03"] === 3000 && c.reserve["2027-04"] === 1250 && c.wallet === "Sinking fund"; });
  t("compulsory insurance and car tax follow the car insurance month", () => I.q_prb.due === "2027-03" && I.q_cartax.due === "2027-03" && I.q_prb.reserve["2026-11"] === 130 && I.q_cartax.reserve["2026-11"] === 360);
  t("picked month = month not a guess; amount untouched = assumed amount", () => I.q_carins.assumed === true && I.q_carins.assumedWhat === "amount");
  t("school fees: two items, May and October", () => I.q_school_1.due === "2027-05" && I.q_school_2.due === "2027-10" && I.q_school_1.name === "School fees (term 1)" && I.q_school_1.reserve["2026-11"] === 4286 && I.q_school_2.reserve["2026-11"] === 2500);
  t("condo fee Jan, gifts Dec (this coming December = 2 months)", () => I.q_condo.due === "2027-01" && I.q_condo.reserve["2026-11"] === 3200 && I.q_gifts.due === "2026-12" && I.q_gifts.reserve["2026-11"] === 2500 && I.q_gifts.reserve["2027-01"] === 417);
  t("set-asides cover each bill by its due month", () => Object.values(I).filter(x => x.freq === "Annual").every(x => { let s = 0; for (const [m, v] of Object.entries(x.reserve)) if (m <= x.due) s += v; return s >= x.amount && s - x.amount < 12; }));
  const S = Q.qsSummary(P);
  t("summary: 12 months, money left after that month's bills", () => S.rows.length === 12 && S.rows[0].m === "2026-11" && S.rows[0].left === 30000 - S.monthly && S.rows.find(r => r.m === "2027-05").left === 30000 - S.monthly - 30000 && S.short >= 1);
  t("summary: pocket plan = each yearly bill's set-aside this month", () => S.pockets.length === 7 && S.pocketNow === 3000 + 130 + 360 + 4286 + 2500 + 3200 + 2500 && S.pockets[0].due <= S.pockets.at(-1).due); }
{ const q = fresh(); q.y.life.on = true; // month never chosen
  const P = Q.qsBuild(q, "2026-10-29", "th");
  t("no month chosen -> 12 months from now, saved as a guess (both)", () => P.items.q_life.due === "2027-09" && P.items.q_life.assumed && P.items.q_life.assumedWhat === "both");
  t("Thai names when signed up in Thai", () => P.items.q_food.name === "ค่าอาหาร" && P.items.q_life.name === "ประกันชีวิต / สุขภาพ");
  t("no take-home typed -> no income written", () => Object.keys(P.config.income).length === 0);
  t("payday 30/31 -> calendar months, this month", () => { const q2 = fresh(); q2.payday = 31; const C = Q.qsBuild(q2, "2026-10-29", "en").config; return C.cycle.day === 1 && C.startMonth === "2026-10"; }); }
{ // no data mixing: two builds never share objects, and nothing from the answers leaks in other than the plan
  const q = fresh(), P1 = Q.qsBuild(q, "2026-10-29", "en"), P2 = Q.qsBuild(q, "2026-10-29", "en");
  P1.items.q_food.reserve["2026-10"] = 1; P1.config.wallets.push({ name: "X" });
  t("no data mixing: each build is a fresh copy", () => P2.items.q_food.reserve["2026-10"] === 8000 && !P2.config.wallets.some(w => w.name === "X") && q.m.food.amt === 8000);
  t("plan holds only config + items (no transactions, no wealth, no email)", () => Object.keys(P1).join() === "config,items" && !JSON.stringify(P1).includes("@")); }
console.log(out.join("\n")); console.log(out.filter(x => x.startsWith("PASS")).length + "/" + out.length);
if (out.some(x => x.startsWith("FAIL"))) process.exit(1);

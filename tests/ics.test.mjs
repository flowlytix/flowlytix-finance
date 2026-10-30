// "Add to my calendar" (index.html): the .ics builder on its own (between the two "calendar files: builder" markers).
// Run: node tests/ics.test.mjs
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const a = html.indexOf("/* ---------- calendar files: builder"), b = html.indexOf("/* ---------- end calendar files: builder");
if (a < 0 || b < 0) { console.log("FAIL calendar block not found in index.html"); process.exit(1); }
const C = new Function(html.slice(a, b) + "\nreturn {icsEsc,icsFold,icsMonthDay,icsBuild,icsAddDays,icsNextDay};")();
const out = []; const t = (n, f) => { let ok = false; try { ok = f(); } catch (e) { n += " (" + e.message + ")"; } out.push((ok ? "PASS " : "FAIL ") + n); };
const STAMP = "20261030T000000Z";
const ics = C.icsBuild([
  { uid: "checkin", date: "2026-11-24", time: "20:00", rrule: "FREQ=MONTHLY;" + C.icsMonthDay(24), title: "Money: month-end check-in", desc: "Type what's left, then save; done", url: "https://money.flowlytix.co/?tab=monthend", alarm: "-PT0M" },
  { uid: "bill-q_carins", date: "2027-02-22", rrule: "FREQ=YEARLY", title: "ประกันรถยนต์ ฿15,000 ครบกำหนดในอีก 1 สัปดาห์ ".repeat(3), alarm: "PT9H" }], STAMP);
const lines = ics.split("\r\n");
t("calendar wrapper, Bangkok time zone, CRLF line ends", () => lines[0] === "BEGIN:VCALENDAR" && ics.includes("TZID:Asia/Bangkok") && ics.includes("TZOFFSETTO:+0700") && ics.endsWith("END:VCALENDAR\r\n") && !/[^\r]\n/.test(ics));
t("check-in: 20:00 Bangkok, every month on the period's last day, with a link", () => ics.includes("DTSTART;TZID=Asia/Bangkok:20261124T200000") && ics.includes("RRULE:FREQ=MONTHLY;BYMONTHDAY=24") && ics.includes("URL:https://money.flowlytix.co/?tab=monthend"));
t("fixed UID per reminder, so adding it again updates it", () => ics.includes("UID:checkin@money.flowlytix.co") && ics.includes("UID:bill-q_carins@money.flowlytix.co"));
t("yearly bill: all-day, a week before, repeats yearly, alarm at 9:00", () => ics.includes("DTSTART;VALUE=DATE:20270222") && ics.includes("RRULE:FREQ=YEARLY") && ics.includes("TRIGGER:PT9H"));
t("text escaped (comma, semicolon)", () => ics.includes("DESCRIPTION:Type what's left\\, then save\; done"));
t("long Thai lines folded at 75 bytes, without breaking letters", () => { const enc = new TextEncoder(); return lines.every(l => enc.encode(l).length <= 75) && ics.replace(/\r\n /g, "").includes("ประกันรถยนต์ ฿15\\,000"); });
t("monthly day: 1–28 as is, 29/30 fall back in short months, 31 = last day", () => C.icsMonthDay(15) === "BYMONTHDAY=15" && C.icsMonthDay(30) === "BYMONTHDAY=28,29,30;BYSETPOS=-1" && C.icsMonthDay(29) === "BYMONTHDAY=28,29;BYSETPOS=-1" && C.icsMonthDay(31) === "BYMONTHDAY=-1");
t("next card due date from today", () => C.icsNextDay("2026-10-30", 25) === "2026-11-25" && C.icsNextDay("2026-10-30", 30) === "2026-10-30" && C.icsNextDay("2026-11-05", 31) === "2026-11-30" && C.icsNextDay("2026-12-28", 5) === "2027-01-05");
t("a week before the 1st of a month", () => C.icsAddDays("2027-03-01", -7) === "2027-02-22" && C.icsAddDays("2026-12-25", -7) === "2026-12-18");
t("no money data beyond the reminder's own title", () => !/@gmail|sheet|token/i.test(ics));
console.log(out.join("\n")); console.log(out.filter(x => x.startsWith("PASS")).length + "/" + out.length);
if (out.some(x => x.startsWith("FAIL"))) process.exit(1);

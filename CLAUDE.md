# Flowlytix Money (money.flowlytix.co)

Personal money-planning web app, live with paying customers. Owner: Sompob (flowlytix@gmail.com). The owner is
not a developer: explain changes in plain words, and give click-by-click steps for anything he must do in a dashboard.

## How it's built and deployed
- `index.html` is the whole app (one file: HTML, CSS, JS). `pro.html` + `pro-img/` is the sales page at /pro.
- `worker/` is the only server code (Cloudflare Workers): `index.js` (plan check, Stripe checkout/portal, pricing,
  feedback, security headers, finance.flowlytix.co redirect), `auth.js` ("stay signed in" cookie), `headers.js`,
  `analytics.js` (Google Analytics tag + Google Tag Manager container added to every page's `<head>`; `GA4_ID` and
  `GTM_ID` live only there; GA4 is not set up again inside GTM, or visits count twice),
  `gold.js` (`/api/gold`: Thai gold price from the Gold Traders Association page classic.goldtraders.or.th, 96.5% bar and
  ornament buy/sell, cached 10 min for everyone, public, no sign-in; 502 if the page changes rather than a wrong number),
  `funds.js` (`/api/funds/nav`: official fund NAVs from the SEC Thailand Open API for tracked funds; receives fund codes only),
  `survey.js` (survey.flowlytix.co: `survey.html`, POST `/api/survey` into the D1 database `SURVEY_DB`; owner-only
  `/api/survey/results` shown in the app under Setup › Survey results, also at money.flowlytix.co/survey-results).
- `signups.js` = **anonymous sign-up log** (when new people sign up and which channel, never who). The app sends POST
  `/api/signup-log` once per NEW Sheet (`suLog` in `gdFindOrCreate`, right after the CompleteRegistration/`sign_up` line; guard
  `fx_su:<sheetId>`; fetch keepalive, fire-and-forget). Signed-in only (Google token, like /api/licence); `LEAD_LIMIT` rate limit with
  hashed keys. Table `signups` in `SURVEY_DB` (made on first use): created_at, product, utm_source/medium/campaign/content,
  referrer_domain, has_fbclid, lang, device, owner. The email is READ only to set owner = 1 (owner accounts + PRO_EMAILS) and never
  stored. **Never store** email, name, Google ID, Sheet ID, IP, user agent or any figure. First touch: every page (index, pro,
  template) saves the UTM tags + referrer DOMAIN + has_fbclid (never its value) in `localStorage.fx_first_touch` on the first visit
  (a later visit with UTMs replaces one without), so it survives the Google redirect. Owner view: Setup › New sign-ups (`suPanel`,
  GET `/api/signup-log/stats`, owner accounts only; owner/test rows hidden unless ticked), also at money.flowlytix.co/admin/signups.
- Hosting: Cloudflare Worker `flowlytix-money`. **Every push to `main` deploys automatically within ~1 minute.**
  Merge to main only when the change is tested; the site has real customers.
- `api/` and `vercel.json` are the old Vercel version, kept briefly as backup. Don't edit them.
- `.assetsignore` keeps code, tests and config from being served publicly. Add new non-public folders there.
- `templates/flowlytix-yearly-bills.xlsx` = the free "Yearly bills" template (money.flowlytix.co/templates/...), built by
  `node tools/template-xlsx.mjs` (no packages; rebuild after editing the script, commit both). Tabs: Read me (EN/TH + Money/Pro
  link), Bills (Item, Category, How often, Amount, First due month, End month = Money's plan item fields; bilingual dropdown
  "Annual / รายปี"; samples tagged "(sample, delete me)"), Income, Year view. **The template shows the problem, Money solves it:**
  it only adds up (bills due per month vs income, red when bills > income). Never add set-aside, running balances, shortfall
  forecasts or "save X a month" to it.
- `template.html` = money.flowlytix.co/template (EN/TH, /pro style): what the template is, pictures of it (`templates/preview-*.jpg`,
  rendered from the real file with sample figures only), and the form: email + a SEPARATE, unticked "news and tips" box (Thai
  PDPA), hidden bot field `website_url`. POST `/api/template/lead` (`worker/leads.js`, table `template_leads` in `SURVEY_DB`, made on
  first use; one row per email, latest tick wins, `news_text` = wording version) → download button. Rate limit: `LEAD_LIMIT`
  binding, 5/min per connection and per email. On success, once per browser: Meta `Lead` + GA4 `generate_lead`, never the
  email. If our server fails the file is still given. `IMPORT_LIVE` in template.html switches the next step to the app's import.
  Owners: Setup › Template sign-ups (`leadsPanel`, `/api/template/leads`, CSV with a news_ok yes/no column, Delete with the
  two-tap `armed` confirm → `/api/template/leads/delete`, for deletion requests). Only email news to rows with news = yes.
- Import from my template (Setup, `importPanel`; welcome screen tick `#onbImp`; `/?import=template` from the template page →
  `goImport` opens Setup there): the .xlsx/.csv is read IN THE BROWSER (`impUnzip` with the browser's DecompressionStream, no
  library; `impParse` → `impCheck`), never sent to our server. Columns found by header (EN/TH), else A–F. Reads the bilingual
  "Annual / รายปี", English or Thai alone, spreadsheet dates, "Mar 2027", 1/3/2027 (day first), มี.ค. 2570. Preview first:
  ready / needs fixing (plain reason) / already in your plan (exact duplicate: name, category, how often, amount, months) /
  sample rows skipped ("(sample, delete me)"). New categories: the person picks the group (`impGroupGuess` default). Add =
  same as + Add item (set-aside empty, so Bills ahead shows what isn't covered); never changes or deletes anything. Free plan, no paywall.

## Support
- Help centre: **support.flowlytix.co** (repo `flowlytix/flowlytix-support`: tickets, status page and incidents, help articles).
  The ? menu's "Contact support" opens `https://support.flowlytix.co/ticket?product=money&lang=<en|th>`.
- Public support email: **support@flowlytix.co** (`SUPPORT` in index.html; pro.html footer). Cloudflare Email Routing
  forwards it to flowlytix@gmail.com. `OWNERS_UI` / `OWNER_EMAILS` stay on the Gmail address (they are logins, not contact).
- The survey has a `support` product (feedback on the help centre and tickets). support.flowlytix.co links to it with
  `?product=support&from=support` or `&from=ticket:FLX-...` after a ticket, so Survey results show which ticket it was about.

## Settings (Cloudflare › flowlytix-money › Settings › Runtime variables and secrets — never in code)
`PAYWALL` (on/off) · `PRO_EMAILS` (free Pro, comma-separated) · `STRIPE_PRICE_ID` (founding ฿490/year, first
`FOUNDING_LIMIT`=100 members) · `STRIPE_PRICE_REGULAR` (฿890/year after that) · `STRIPE_PRICE_MONTHLY` (฿99/month, offered
next to yearly; empty = yearly only) · `STRIPE_PRICE_LEGACY` (old prices people still pay, e.g. the first ฿199 founding price,
comma-separated: they stay Pro and count as founding places) · `TRIAL_DAYS` (default 30, 0 = off) ·
secrets `STRIPE_SECRET_KEY`, `GOOGLE_CLIENT_SECRET`, `SEC_API_KEY` (fund prices). Owner accounts flowlytix@gmail.com and aronsodacan@gmail.com
are always Pro. Never ask for or print secret values.

## Product rules
- Users' money data lives only in their browser and their own Google Sheet (Drive `drive.file` scope). The server
  never receives figures. Keep it that way; the privacy policy on flowlytix.co promises it.
- Signed-out landing (`gdGate`, `body.landing` hides the sidebar, header and FABs; light pastel design by default, navy in dark mode): brand, tagline, feature chips, three ways in
  (Start free with Google + trial line, Explore with sample data, free Excel template → /template), the 1-minute intro video
  (`videos/0-intro-en|th.mp4`, landscape, in `VIDEOS` but not in the How to use grid; recorded with scratchpad stage.html +
  synthesized music), contact (support ticket + support@) and legal links.
- Welcome screen (`renderOnboarding`, a Google account with no Flowlytix sheet): says "Signed in as <email>" with
  "Use another Google account" (`onbSwitch`: sign out, then Google's account chooser), so a wrong account isn't mistaken for lost data.
  Typing a payday after the 1st moves "First month to plan" to the budget month today is in (payday 28 on 28 Oct → Nov), unless
  the person picked a month (`onbStart` `data-touched`), so the first month never starts before the salary that pays for it.
  `#onbWhen` (`onbWhenText`) says it plainly as they type: first month + dates, which salary pays for it, no need to plan earlier
  months, and that Salary & Tax fills Jan–(payslip month − 1) from the monthly salary for the yearly tax.
- Sync between devices: every change saves itself ~2.5 s later (`gdChanged` → `gdPush`; only Month-end has a Save button).
  Coming back to the tab/app, focus, and every 2 min while visible, `gdCheckRemote` reads `_data!A1` (`updatedAt`) and loads a
  newer copy (never while someone is typing). `gdPush` checks it first too, so a stale device never writes over a newer copy:
  it loads it, or shows "Two versions found" if this device also has unsaved changes.
- Free: plan any month; balances/shortfalls only this month + 2. Pro: every month ahead, card & loan pay-off,
  next month's plan. 30-day no-card trial once per Google account.
- Tracked funds (Net worth): value = units × NAV, like gold. Filled in only for months up to the current month; later
  months are never touched. Free: 2 tracked funds update; Pro: all funds + Fund growth chart. Plan: `docs/plan-fund-prices.md`.
- Gold (Net worth): value = weight × buy-back price. This month's price fills itself from `/api/gold` (bar buy-back, `goldRefresh`,
  on the Net worth page, at most every 10 min) while empty or still automatic (`config.goldAuto[m]`, shown teal); a typed price wins.
  Earlier months keep their last price. Empty "Invested so far" carries the last cost forward (shown as the placeholder).
- Bank accounts filled from the check-in (Net worth, Cash & bank / Savings): `a.cats` = categories kept in that account;
  month-end balance = what they have left after the month-end check-in. Only checked-in months up to this month; a number
  the person types always wins (flag `cauto`). Linking first replaces only the latest checked-in month. An account with the
  same name as a category follows it automatically (`catsOf`); `a.catsOff` = the person switched it off.
- Cards and loans in Net worth = what's owed AFTER that month's payments (month end; this month = latest typed). A month not
  typed is estimated (`estOwed`, flag `auto`, shown est.): last month + interest + card spending − that month's payments; later
  est. months follow (`writeEst`). Pay-off plans start from the latest balance. `oweModelV2` re-estimated old data once (`config.oweV`).
- Month-end › Credit card payments has an optional "Owe now" column = the card's Net worth balance for that month,
  through the same `data-wa` input as the Net worth table (card found with `cardAccForCat`). Empty shows the estimate.
- Month-end › Credit card payments has a New spending box per card (`config.cardNew[m][acc]`, optional, typed from the card app,
  wins). Empty = worked out: owe now − owed last month + paid this month (`cardSpend`; 0% installment parts count only by their
  monthly payment; shown as the placeholder, or "optional" until there are two months of balances). The alert splits what's
  owed into old debt carried over + new spending. Month-end section titles are bold with a gradient bar (`#app[data-tab=monthend]`).
  Under it, `cardMinLines`: next month's card set-aside vs minimum payment (`cardMinCheck`, `minPct` default 10% per card +
  installments), interest note when not paid in full. Overspent = card spending − left unspent (`leftUnspent`, same as the story).
  The result sits at the top under the story as the "Overspending alert" / "Cards on track" card (`cardOverTop`, `.alertc`).
  Both show in To do this month. A category checked in at month end uses its actual cash out everywhere (`walletFlows`).
- Suggested plan for next month (Month-end, `suggestFor`, Apply = `meApply`): average of the last 3 checked-in months that have
  ended and had money out (a running month or ฿0 is left out). Cards and loans (`isPayCat`: card category, or name/group with
  loan/mortgage/ผ่อน…, or a loan account of the same name) are never suggested below the plan ("kept").
- Kept after card bills (Overview row under Cumulative kept, and a Month-end KPI next to Total money you have): cumulative
  kept − what's still owed on cards (`cardDebtAt`/`cardOwedAt`: Net worth balance up to this month WITHOUT 0% installment parts,
  which count only by their monthly payment; later months: + usual card spending (`cardSpendAvg`, average of up to 3 recent
  checked-in months; off with `config.cardFc=false`, "My plan already covers it") − the plan's card payments less the installment part). The
  installment left is shown as a note. Shown only when a card has a balance. Cumulative kept itself = Total money you have (cash basis).
- Overview monthly table, per category: set aside, ↳ spent, ↳ moved in / out (`moveRow`, any category, only when there is a
  move), ↳ balance (`balRow`, only build-up categories `isBuildCat`: Saving/Investment groups, keep, sinking/emergency, goals,
  non-monthly items; hidden when always 0; bold = checked in, grey = plan).
  "Show details / Hide details" button above the table hides all ↳ lines (`ovDetail`, `bp_ovdet` per device, on by default).
- New monthly items (+ Add item, quick-add) start in the month being planned (`newItemFrom`: `selMonth`/`nowM` when after the
  budget start → `it.due`), so they never put Cash out into months that are over. Clearing a Cash out box = back to automatic; 0 = none.
- Bills ahead (Plan top + Dashboard): next 12 months of all Cash out vs what each category will have set aside; one note
  each time a category's shortfall starts or grows, with how much more to set aside a month. Free sees this month + 2.
- Goals (Dashboard + Plan, `goalsCard`): a goal is a plan item with `goal:true`, One-off, amount = target, due = by when
  (+ New goal → quick-add `goal`: new category in the Saving group or an existing one; `goalSpread` spreads the set-aside evenly
  from `goalStart()` to the due month). Progress = the item's balance so far (`goalStats`); Behind → "Fix my plan" re-spreads.
  Item editor has "Show in Goals" for One-off items. "Can I afford it?" from a goal passes `goalId` so `afHave` counts the goal's
  own money before payout; goal categories aren't default afford wallets. Free 2 goals (`GOAL_FREE`), Pro `goals_unlimited`.
- Where your money goes (Plan + Dashboard, `allocCard`): each group's plan set-aside as % of take-home; optional guideline
  `config.allocRule` (`ALLOC_RULES`: jars6 55/10/10/10/10/5, r503020) matched per CATEGORY (`allocCatBucket`: `config.allocMap[rule]["c:"+name]`, else a
  keyword guess from the category name (`allocGuessKw`: shop/travel → wants/play, saving → save…), else the old group choice, else
  `allocGuess` from the group), so "Shopping" in a "Living" group counts as a want; "Match your categories to the guideline". PVD (taken from the payslip before take-home) is its own row and counts as saving (jars: Financial freedom;
  50/30/20: Saving), base = take-home + PVD; `config.allocPvd=false` shows % without it. Saving & investing is shown with and
  without PVD. Free. Rule of thumb, not advice.
- Can I afford it? (tab `afford`, `renderAfford`, settings in `config.afford`): a big purchase checked against the plan.
  The person picks the categories that hold money for it (`a.wallets`; default Saving group / build-up categories, never
  Emergency fund; optional money with no job yet). Checks: cash by the month, monthly fit (median of up to 3 planned months),
  debt payments ÷ gross income (banks often 40–50%), emergency cushion (3+ months), true cost; verdict, suggestions,
  side by side, Add to my plan. Free: verdict + cash check; Pro (`afford_full`): the rest. Estimates, not advice.
- Sections fold: tap a section title (`foldSections`). `FOLD_START` = folded at first, `FOLD_NEVER` = a page's main
  table, never folded. A folded section shows its key number or warning (`foldSummary`); a warning opens it. Choices are
  remembered per device (`bp_fold`). Tours unfold everything.
- "This month" (`nowM`) = the budget month today falls in (`syncNow()` → `budgetMonthOf(today)`, run on every load and render), so
  with a pay cycle on the 25th (months named by their end) Nov starts on 25 Oct. Fund month-end NAVs use the period end (`periodOf(m).to`).
  Month-end opens on last month while it isn't checked in (`meDue`). A month still running shows a "still running" note
  (`.me-early`, with a button to check in last month) and its card Paid boxes start empty (plan as placeholder), so saving early
  never records card payments that weren't made.
  Typed but unsaved Month-end boxes survive re-draws (Owe now, New spending, min % save at once): `meDraft`, restored in
  `render` by `meDraftRestore`, cleared for that month on Save month-end.
- Pay cycle: salary is paid after the month is worked (`cycle.paid` "same"), so the "Salary for a month is paid" choice only
  shows for anyone already on "advance". Months are always named by the month they end (`cycle.label` "end": paid 28 Oct → Nov-26);
  the "Name each budget month by" choice only shows for anyone already on "start". The note says it plainly: "Your Oct salary, paid around 25 Oct, is your money for
  Nov-26: 25 Oct – 24 Nov" (payslip goes in its own month in Salary & Tax; planned in the next budget month with day > 1).
- Salary & Tax month table: blue (`cur`) = the payslip that pays for this budget month (`payMonthFor(nowM)`, tag "for Nov-26" or
  "this month"); soft gold (`xpay`, tag "extra pay") = a month with back-pay, bonus or freelance income.
- Payslip lines (Salary & Tax actuals, quick-add payslip): "Bonus, OT & allowances" (`extra`, taxable); "Unpaid leave / late"
  (`leave`, lowers gross and taxable pay); "Other deductions" (`od`: company loan, cooperative, uniform…; lowers take-home only;
  usual amount `p.odM` in Step 1 is the forecast). `income(m).od` shows in Overview › Other deductions.
- Salary & Tax opens with numbered steps (`stepBadge`, gradient `.stepb`): Start here · Step 1 salary, PVD and pay cycle
  (`payCycleFields`, same settings as Setup) → Step 2 allowances told HR → Step 3 every payday, type the payslip.
- Guided tours: `TOURS` (main, monthend) + `PAGE_TOURS` (`p_<tab>`, from the ? menu). When a page gets a new section, add
  a tour step (selector + English) and its Thai in I18N_TH; How to use (`renderGuide`) lists every page and feature.
- "To do this month" (Dashboard, `monthTodo`): steps that tick themselves off (last month's check-in, payslip, plan the
  take-home, bills covered, this month's check-in and balances from 6 days before month end, plan next month). Other pages
  show the next step as one line (`todoBar`). Phones: 4 tabs + More (`TAB_CORE`, `TAB_MORE`).
- Survey: one Flowlytix-wide survey (`?product=money&from=<page>&plan=&lang=`). Links in the app (? menu, sample banner,
  rating card, one-time ask after 2 check-ins or a trial that ended, and the sidebar buttons `sideHelp`: survey + support ticket,
  computer only) show only when `SURVEY_LIVE` is true. No money data.
- Reviews & rating: survey Q9 = optional review + name to show + consent. The owner approves or hides reviews in Setup ›
  Survey results; only approved + consented ones are public (`/api/survey/public`, CORS open, name and text only). The public
  rating = average satisfaction of verified signed-in users (ticket from `/api/survey/ticket` in the app's survey links;
  owners don't count; latest answer per person), shown only from 10 ratings (`MIN_RATINGS`): app sidebar / Dashboard,
  /pro (Money only), and the flowlytix.co box in `docs/wordpress-reviews-widget.html` (`?product=all`: every product,
  each review labelled with its product).
- Work log (tab `work`, `renderWork`, free): `config.work = {set:{type month|day, amt, hours, cut, pay}, log:{date:{ot:{"1","1.5","2","3"}, lv, half,
  note}}, paid:{P}}`. A pay period is named by its payslip month P (paid on `pay`; OT period ends on `cut`, e.g. 16–15 paid 28 →
  `wkPeriod`). Hourly = salary ÷ 30 ÷ hours (or wage ÷ hours); expected OT = Σ hours × rate × hourly; unpaid/absent days × daily rate.
  "Check with your payslip": OT typed vs expected; leave vs Salary & Tax `actual.leave`; "Add expected OT…" writes `salary[y].fc[P].other`.
  Amounts in 2 decimals (`wkB`). Entry: landing card `ldWork` → `bp_intent=work` → Welcome note → lands on Work log. Sample data has a few days.
  The line under the period bar (`.wk-flow`) says it plainly: "Nov payslip (paid 28 Nov) → Salary & Tax Nov row → planned in Dec-26"
  (`budgetMonthOf(payDate)`): the OT period (cut) only decides which payslip; the payslip month and budget month follow Money's pay cycle.
- Work log door **money.flowlytix.co/work** (worker serves index.html; `WORK_DOOR`): own landing (`gdGateWork`), sample opens on Work log,
  Welcome = a short Work log form (paid by month/day, salary or wage, OT period end, payday) → `config.workOnly=true`, `cycle.day` = payday.
  Work-only (`body.workonly`, `WORK_TABS`: Work log, Salary & Tax, How to use, Setup; no quick-add, no To-do bar, page tour instead of the
  main tour). Same data and Sheet as Money. "Try full Money" (`workFull`, upsell card on the Work log, Setup › Menu) switches it off and
  adds the starter categories if there are none; Setup › Menu switches back (`workOnly`). Nothing is deleted either way.
  "Work log" stays English in both languages (it's the name); English month names in the Work log are fine.
  Marked **Beta** (`.beta-tag`: menu, phone More sheet, page title, /work landing) until the owner says it is officially live.
  Paid twice a month (`set.split`, `pay2`; e.g. 1–15 paid 20th, 16–end paid 5th next month): the period is the month worked P,
  `wkPeriod(P).rounds` = 2 rounds, both = P's pay. Each round has its own payslip box and "Add to Salary & Tax" (`wkToSal` data-r):
  `config.work.pushed[P][r]`, and fc[P] = the sum of rounds pushed (one month total). Cycle day = round 1 payday, so P is planned in
  `wkPlanM(P)` (P+1). The main Money app stays monthly; never add half-month budgets.
  Daily wage (`type day`): pay = (days worked on `set.days` (Mon=0, default Mon–Sat) + paid leave/public holidays `WK_PAIDLV`) × wage + OT
  (`wkSumR`); payslip boxes = OT on the slip (`config.work.paid`, like monthly) + optional wages line (`config.work.wage`) vs days × wage; pushing writes fc.sal, fc.other (OT), fc.sso (5%, max 875)
  and creates the Salary & Tax year if missing. Phone: quick OT 1.5× buttons (`wkQuick`), non-work days greyed (`.wk-d.off`).
  OT hours are typed like a timesheet (`wkHrs`): 2.3 = 2.30 = 2 h 30 min, 2.45 = 2 h 45 min, 2.4 = 2 h 40 min (one digit = tens of
  minutes, except .5 = half an hour, so 1.5 = 1 h 30 min); a live "= 2 h 30 min" shows under each box (`.wk-hm`);
  stored as decimal hours, shown back as 2.30 (`wkHD`) and 2:30 on the calendar (`wkHM`).
  Work days (`set.days`, chips in Pay settings, both pay types; default Mon–Fri monthly, Mon–Sat daily); other days greyed.
  Summary: one OT line (per-rate rows only with 2+ rates), then "Expected by <period end>" (`wkFc`): the OT 1.5× hours per work day
  so far × work days left without leave/OT typed; holiday OT (1×, 2×, 3×) is never projected. Leave check: a Salary & Tax
  "Unpaid leave / late" amount with no unpaid days logged is an info note (late time isn't logged), never a red warning.
  Allowances (night shift, meal, travel, attendance…) are NOT in the Work log on purpose (owner decision: every company pays them
  differently). It counts only OT, leave and days worked by Thai law, and says so (`.wk-excl`); the payslip check compares OT (and
  wages) line by line, so allowances never enter it. `wkFullLink`: Work log only → "See your whole pay… in Money"
  (`workFull`, with the trial days); full Money → Open Salary & Tax (`wkGoSal`).
- Video tutorials: `videos/<id>-en|th.mp4` + `.jpg`, listed in `VIDEOS` (How to use grid, and the ? menu on matching
  pages). Recorded from the sample data at 780×1560; re-record when those screens change.
- Tax allowances (`ALLOW_PRESETS`, kinds): donations are worked out last (`donDed`): "Donation" (`don`, 1×) and "Donation ×2" (`don2`:
  education, sports, social development, public hospital) together up to 10% of income after expenses and all other allowances;
  political party donation (`party`) up to ฿10,000. Old "Donation" rows of kind `other` become `don` in `normalize`.
- Wide tables keep their sideways scroll across redraws and page switches (`scrollMem`, keyed by page + table header, not by
  position on the page); with nothing remembered a table opens on its current-month (`th.cur`) column (`scrollRestore`).
- Amounts everywhere (`fmt`, `baht`): whole baht as 1,234, anything with satang keeps 2 decimals (100.50, never rounded to 101).
  Amount boxes get thousand separators when drawn or left, never while typing (`fmtIn`, `SEP_SEL` = `input.num` / inputmode
  decimal, not type=number); every input is read with `num()`, which drops the commas. Never parse an amount box another way.
- Bilingual EN/TH. Static English text is translated by the `I18N_TH` dictionary (exact-string pairs, patterns
  `{฿} {n} {month}`); new dynamic text uses `L2(english, thai)`. Every new user-facing string needs Thai.
- Every section title gets a "?" tip: add an entry to `TIPS` (English + Thai).
- Must work on phones (390px wide, no sideways scrolling) and in dark mode.
- Brand: FLOWLYTIX (navy) + "Money" (blue→teal gradient); colours #1A7AFF, #00C2A8, #0D1B3E.

## Tests (run before pushing)
- `node tests/worker.test.mjs` and `node tests/auth.test.mjs` — server logic with a simulated Google/Stripe; all must pass.
- `node tests/import.test.mjs` — the template import's file reading (the block between the "template import: reading the file"
  markers in index.html) against the real template, `tests/fixtures/template-filled-libreoffice.xlsx` (re-saved by a spreadsheet app) and CSV.
- For app changes, also open the app with "Try it with sample data first" and check the changed pages in EN and TH,
  on desktop and at phone width.

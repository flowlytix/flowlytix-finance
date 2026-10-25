# Flowlytix Money (money.flowlytix.co)

Personal money-planning web app, live with paying customers. Owner: Sompob (flowlytix@gmail.com). The owner is
not a developer: explain changes in plain words, and give click-by-click steps for anything he must do in a dashboard.

## How it's built and deployed
- `index.html` is the whole app (one file: HTML, CSS, JS). `pro.html` + `pro-img/` is the sales page at /pro.
- `worker/` is the only server code (Cloudflare Workers): `index.js` (plan check, Stripe checkout/portal, pricing,
  feedback, security headers, finance.flowlytix.co redirect), `auth.js` ("stay signed in" cookie), `headers.js`,
  `analytics.js` (Google Analytics tag + Google Tag Manager container added to every page's `<head>`; `GA4_ID` and
  `GTM_ID` live only there; GA4 is not set up again inside GTM, or visits count twice),
  `funds.js` (`/api/funds/nav`: official fund NAVs from the SEC Thailand Open API for tracked funds; receives fund codes only),
  `survey.js` (survey.flowlytix.co: `survey.html`, POST `/api/survey` into the D1 database `SURVEY_DB`; owner-only
  `/api/survey/results` shown in the app under Setup › Survey results, also at money.flowlytix.co/survey-results).
- Hosting: Cloudflare Worker `flowlytix-money`. **Every push to `main` deploys automatically within ~1 minute.**
  Merge to main only when the change is tested; the site has real customers.
- `api/` and `vercel.json` are the old Vercel version, kept briefly as backup. Don't edit them.
- `.assetsignore` keeps code, tests and config from being served publicly. Add new non-public folders there.

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
- Sync between devices: every change saves itself ~2.5 s later (`gdChanged` → `gdPush`; only Month-end has a Save button).
  Coming back to the tab/app, focus, and every 2 min while visible, `gdCheckRemote` reads `_data!A1` (`updatedAt`) and loads a
  newer copy (never while someone is typing). `gdPush` checks it first too, so a stale device never writes over a newer copy:
  it loads it, or shows "Two versions found" if this device also has unsaved changes.
- Free: plan any month; balances/shortfalls only this month + 2. Pro: every month ahead, card & loan pay-off,
  next month's plan. 30-day no-card trial once per Google account.
- Tracked funds (Net worth): value = units × NAV, like gold. Filled in only for months up to the current month; later
  months are never touched. Free: 2 tracked funds update; Pro: all funds + Fund growth chart. Plan: `docs/plan-fund-prices.md`.
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
- Kept after card bills (Overview row under Cumulative kept, and a Month-end KPI next to Total money you have): cumulative
  kept − what's still owed on cards (`cardDebtAt`/`cardOwedAt`: Net worth balance up to this month WITHOUT 0% installment parts,
  which count only by their monthly payment; later months: + usual card spending (`cardSpendAvg`, average of up to 3 recent
  checked-in months; off with `config.cardFc=false`, "My plan already covers it") − the plan's card payments less the installment part). The
  installment left is shown as a note. Shown only when a card has a balance. Cumulative kept itself = Total money you have (cash basis).
- Bills ahead (Plan top + Dashboard): next 12 months of all Cash out vs what each category will have set aside; one note
  each time a category's shortfall starts or grows, with how much more to set aside a month. Free sees this month + 2.
- Goals (Dashboard + Plan, `goalsCard`): a goal is a plan item with `goal:true`, One-off, amount = target, due = by when
  (+ New goal → quick-add `goal`: new category in the Saving group or an existing one; `goalSpread` spreads the set-aside evenly
  from `goalStart()` to the due month). Progress = the item's balance so far (`goalStats`); Behind → "Fix my plan" re-spreads.
  Item editor has "Show in Goals" for One-off items. "Can I afford it?" from a goal passes `goalId` so `afHave` counts the goal's
  own money before payout; goal categories aren't default afford wallets. Free 2 goals (`GOAL_FREE`), Pro `goals_unlimited`.
- Where your money goes (Plan + Dashboard, `allocCard`): each group's plan set-aside as % of take-home; optional guideline
  `config.allocRule` (`ALLOC_RULES`: jars6 55/10/10/10/10/5, r503020) with group → bucket matching (`config.allocMap`, guessed by
  `allocGuess`). PVD (taken from the payslip before take-home) is its own row and counts as saving (jars: Financial freedom;
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
- Video tutorials: `videos/<id>-en|th.mp4` + `.jpg`, listed in `VIDEOS` (How to use grid, and the ? menu on matching
  pages). Recorded from the sample data at 780×1560; re-record when those screens change.
- Bilingual EN/TH. Static English text is translated by the `I18N_TH` dictionary (exact-string pairs, patterns
  `{฿} {n} {month}`); new dynamic text uses `L2(english, thai)`. Every new user-facing string needs Thai.
- Every section title gets a "?" tip: add an entry to `TIPS` (English + Thai).
- Must work on phones (390px wide, no sideways scrolling) and in dark mode.
- Brand: FLOWLYTIX (navy) + "Money" (blue→teal gradient); colours #1A7AFF, #00C2A8, #0D1B3E.

## Tests (run before pushing)
- `node tests/worker.test.mjs` and `node tests/auth.test.mjs` — server logic with a simulated Google/Stripe; all must pass.
- For app changes, also open the app with "Try it with sample data first" and check the changed pages in EN and TH,
  on desktop and at phone width.

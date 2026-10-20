# Flowlytix Money (money.flowlytix.co)

Personal money-planning web app, live with paying customers. Owner: Sompob (flowlytix@gmail.com). The owner is
not a developer: explain changes in plain words, and give click-by-click steps for anything he must do in a dashboard.

## How it's built and deployed
- `index.html` is the whole app (one file: HTML, CSS, JS). `pro.html` + `pro-img/` is the sales page at /pro.
- `worker/` is the only server code (Cloudflare Workers): `index.js` (plan check, Stripe checkout/portal, pricing,
  feedback, security headers, finance.flowlytix.co redirect), `auth.js` ("stay signed in" cookie), `headers.js`,
  `analytics.js` (Google Analytics tag added to every page's `<head>`; the ID `GA4_ID` lives only there),
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

## Settings (Cloudflare › flowlytix-money › Settings › Runtime variables and secrets — never in code)
`PAYWALL` (on/off) · `PRO_EMAILS` (free Pro, comma-separated) · `STRIPE_PRICE_ID` (founding ฿199, first
`FOUNDING_LIMIT`=100 members) · `STRIPE_PRICE_REGULAR` (฿299 after that) · `TRIAL_DAYS` (default 7, 0 = off) ·
secrets `STRIPE_SECRET_KEY`, `GOOGLE_CLIENT_SECRET`, `SEC_API_KEY` (fund prices). Owner accounts flowlytix@gmail.com and aronsodacan@gmail.com
are always Pro. Never ask for or print secret values.

## Product rules
- Users' money data lives only in their browser and their own Google Sheet (Drive `drive.file` scope). The server
  never receives figures. Keep it that way; the privacy policy on flowlytix.co promises it.
- Free: plan any month; balances/shortfalls only this month + 2. Pro: every month ahead, card & loan pay-off,
  next month's plan. 7-day no-card trial once per Google account.
- Tracked funds (Net worth): value = units × NAV, like gold. Filled in only for months up to the current month; later
  months are never touched. Free: 2 tracked funds update; Pro: all funds + Fund growth chart. Plan: `docs/plan-fund-prices.md`.
- Bank accounts filled from the check-in (Net worth, Cash & bank / Savings): `a.cats` = categories kept in that account;
  month-end balance = what they have left after the month-end check-in. Only checked-in months up to this month; a number
  the person types always wins (flag `cauto`). Linking first replaces only the latest checked-in month. An account with the
  same name as a category follows it automatically (`catsOf`); `a.catsOff` = the person switched it off.
- Month-end › Credit card payments has an optional "Owe now" column: the card's balance in Net worth for that month,
  through the same `data-wa` input as the Net worth table (card found with `cardAccForCat`). Empty keeps the estimate.
- Bills ahead (Plan top + Dashboard): next 12 months of all Cash out vs what each category will have set aside; one note
  each time a category's shortfall starts or grows, with how much more to set aside a month. Free sees this month + 2.
- Sections fold: tap a section title (`foldSections`). `FOLD_START` = folded at first, `FOLD_NEVER` = a page's main
  table, never folded. A folded section shows its key number or warning (`foldSummary`); a warning opens it. Choices are
  remembered per device (`bp_fold`). Tours unfold everything.
- "To do this month" (Dashboard, `monthTodo`): steps that tick themselves off (last month's check-in, payslip, plan the
  take-home, bills covered, this month's check-in and balances from 6 days before month end, plan next month). Other pages
  show the next step as one line (`todoBar`). Phones: 4 tabs + More (`TAB_CORE`, `TAB_MORE`).
- Survey: one Flowlytix-wide survey (`?product=money&from=<page>&plan=&lang=`). Links in the app (? menu, sample banner,
  rating card, one-time ask after 2 check-ins or a trial that ended) show only when `SURVEY_LIVE` is true. No money data.
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

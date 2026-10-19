# Plan: funds that update themselves (Flowlytix Money)

Status: **approved 19 Oct 2026.** Owner's rule: values are filled in only up to the current month (in October, November is never touched).
Replaces the separate Flowlytix Funds app (paused 19 Oct 2026). SEC Open API findings: flowlytix-funds `docs/sec-api.md`.

## What the user gets
1. **Link an account to a fund.** On a Net worth account of type *Investments* or *Retirement (PVD/RMF/SSF)*, a
   "Track a fund" button: search the fund code (e.g. K-USA-A(A)), then type the units held and the amount invested.
2. **Value updates itself.** Each time the app opens, it fetches the latest official NAV (SEC Thailand) for the funds
   the person tracks. Value = units × NAV, shown with the NAV date. Month-end values fill in automatically, the same way
   gold does today (weight × buy-back price), so the person no longer types them.
3. **Buying more.** "Add a purchase": amount in ฿ + date → extra units from that day's NAV, and "invested so far" goes up
   by the amount. Units can also be edited directly (the number in the fund app is always right).
4. **My funds** section in Net worth: each tracked fund's value, profit ฿ and %, NAV and its date; a growth chart of value
   vs invested over time, per fund and in total.
5. Fits what Money already has: Investment performance table, net worth, Dashboard KPIs and the RMF/SSF/Thai ESG tax room.

## Free and Pro (owner-approved)
- **Free:** up to 2 tracked funds with automatic daily value. Further funds can still be typed by hand as today.
- **Pro:** unlimited tracked funds + the growth chart. New entries in `FEATURES`: `fund_tracking_unlimited`, `fund_growth`.
  Locked parts are blurred with "See Pro", never hidden. Sample mode shows everything.

Provident funds (PVD) are never tracked: they hold several funds and have no public SEC price. Accounts named like a
PVD (PVD / provident / สำรองเลี้ยงชีพ) get no "Track a fund" link; Retirement accounts say "Track an RMF or SSF fund".

## How it works
**Privacy stays the same.** The server only ever receives fund *codes*. Units, amounts and values stay in the browser
and the person's Google Sheet, as today.

Server (`worker/`, new file `worker/funds.js`):
- `GET /api/funds/list` – the fund list for search: code, name EN/TH, fund company, SEC ids. Public SEC data,
  cached at Cloudflare for a day.
- `GET /api/funds/nav?ids=…` – latest NAV and date for up to 20 funds. One SEC call per fund (last 10 days, keep the newest),
  shared by every user through Cloudflare's cache, refreshed once a day after 20:00 Bangkok time.
- `GET /api/funds/history?id=…&from=YYYY-MM` – month-end NAVs for the growth chart and for filling past month-ends.
- The SEC key is a Cloudflare secret (`SEC_API_KEY`) on the flowlytix-money Worker. The Free Workers plan allows
  50 outside calls per request, so calls are batched (≤20 funds per request).

Fund list: the SEC needs ~75 calls (~2 minutes) to list every fund, too many for one Worker request. A small script
(`tools/fund-list.mjs`) builds `fund-list.json` (~2,200 codes); a weekly GitHub Action runs it and commits the file, which
deploys like any other change. Needs the SEC key as a GitHub secret too.

App (`index.html`):
- Account gets an optional `fund: {proj, cls, code}`. Units per month stored like gold weight (`wealth[y].fu[m][id]`,
  carries forward); month-end value auto-filled with an `fauto` flag (like `gauto`), never over a value the person typed.
- Current month shows today's value "as of NAV date"; past months use that month's last NAV.
- If the server can't reach the SEC, the app keeps the last value and says "price from …"; nothing breaks.
- Every new string in English and Thai (`I18N_TH` / `L2`), a "?" tip for the new section, works at 390px and in dark mode.
- Sample data: the sample investor gets 2–3 tracked funds with built-in prices (no network calls).

Tests: `tests/worker.test.mjs` gets cases for the three new routes with a simulated SEC (caching, batching, bad ids,
SEC down); app checked with "Try it with sample data" in EN/TH, desktop and phone, before anything goes live.

Note: `/v2/fund/general-info/profiles` answers only when the request sends `Content-Type: application/json`
(other addresses don't need it). fund-list.json keeps open funds (fund_status Registered or IPO): ~5,000 share classes,
~92 KB compressed. Code shown = fund_class_name, or proj_abbr_name for single-class funds ("main").

## Steps for the owner (click-by-click when we get there)
1. Done: fund list built from the Fund Profile API.
2. Cloudflare › flowlytix-money › Settings › Variables and secrets: add Secret `SEC_API_KEY`.
3. GitHub › flowlytix-finance › Settings › Secrets and variables › Actions: add `SEC_API_KEY` (for the weekly fund list).
4. Try it on the branch preview, then approve going live.

## Order of work
1. Server routes + fund list script + tests (on branch `claude/relaxed-goodall-rt5jhz`, preview only).
2. Track-a-fund on accounts, automatic values, add-a-purchase.
3. My funds section + growth chart (Pro) + sample data + Thai.
4. Owner tries the preview; merge to main.

# Flowlytix Money

Plan your salary, check in at month end, and see every month ahead: budget, salary & tax,
net worth, and credit card and loan pay-off. Live at **https://money.flowlytix.co**.

- `index.html` (the app) and `pro.html` + `pro-img/` (the sales page at /pro) are static files.
- Users' data lives in their own Google Drive/Sheet. Nothing is stored on a server.
- `worker/auth.js`: "stay signed in". Keeps the Google refresh token only in an encrypted HttpOnly cookie
  in the user's browser (`/api/auth/start|callback|token|logout`). On when `GOOGLE_CLIENT_SECRET` is set.
- `worker/index.js` is the main server code: `/api/licence`, `/api/checkout`, `/api/portal`
  (checks the Google sign-in, asks Stripe whether the user has Pro). It stores nothing.

## Hosting: Cloudflare Workers
- Config: `wrangler.jsonc`. `.assetsignore` keeps code and config files from being served.
- Security headers: `_headers`.
- Dashboard settings: `PAYWALL` (on/off), `PRO_EMAILS` (comma-separated), `STRIPE_PRICE_ID` (founding price),
  `STRIPE_PRICE_REGULAR` (price after the first `FOUNDING_LIMIT` members, default 100), `TRIAL_DAYS` (default 7, 0 = off),
  and the secrets `STRIPE_SECRET_KEY` and `GOOGLE_CLIENT_SECRET`.
- Google OAuth client needs the redirect URI `https://money.flowlytix.co/api/auth/callback`.
- `api/` and `vercel.json` are the old Vercel version, kept until the move is finished.

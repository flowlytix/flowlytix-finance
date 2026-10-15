# Flowlytix Money

Plan your salary, check in at month end, and see every month ahead: budget, salary & tax,
net worth, and credit card and loan pay-off. Live at **https://money.flowlytix.co**.

- `index.html` (the app) and `pro.html` + `pro-img/` (the sales page at /pro) are static files.
- Users' data lives in their own Google Drive/Sheet. Nothing is stored on a server.
- `worker/index.js` is the only server code: `/api/licence`, `/api/checkout`, `/api/portal`
  (checks the Google sign-in, asks Stripe whether the user has Pro). It stores nothing.

## Hosting: Cloudflare Workers
- Config: `wrangler.jsonc`. `.assetsignore` keeps code and config files from being served.
- Security headers: `_headers`.
- Dashboard settings: `PAYWALL` (on/off), `PRO_EMAILS` (comma-separated), `STRIPE_PRICE_ID`,
  and the secret `STRIPE_SECRET_KEY`.
- `api/` and `vercel.json` are the old Vercel version, kept until the move is finished.

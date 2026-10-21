// Security headers for every page. Generated from the same list as _headers; keep them in sync.
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com https://connect.facebook.net https://*.googletagmanager.com https://tagmanager.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://tagmanager.google.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com https://accounts.google.com https://www.facebook.com https://*.google-analytics.com https://*.googletagmanager.com https://tagmanager.google.com https://www.google.com; connect-src 'self' https://www.googleapis.com https://sheets.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://www.facebook.com https://connect.facebook.net https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.google.com; frame-src https://accounts.google.com https://*.googletagmanager.com; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()"
};

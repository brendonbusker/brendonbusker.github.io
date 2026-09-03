# Security policy

The public site is static and does not accept visitor input. The private CMS is a single-administrator Cloudflare Worker application. Please report suspected vulnerabilities privately to the repository owner rather than opening a public issue.

Never include credentials, session cookies, Cloudflare secrets, Turnstile secrets, or the GitHub publishing token in a report. Rotate an exposed secret immediately using `wrangler secret put`.

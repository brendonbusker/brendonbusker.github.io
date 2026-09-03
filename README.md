# Brendon Busker — personal site and publishing CMS

This repository contains two deliberately different products:

- `apps/site`: a warm, editorial Astro website that is statically generated and hosted by GitHub Pages. Its homepage, notes, projects, résumé, RSS feed, sitemap, and permanent post URLs continue to work even if Cloudflare is unavailable.
- `apps/admin`: a private React/Fluent publishing suite served from the same Cloudflare Worker origin as its API. D1 holds private drafts, sessions, and bounded security logs. Publishing validates content and writes only allowlisted files to this repository through GitHub's API.
- `packages/shared`: Zod schemas and security-safe content, URL, slug, session, Markdown, and repository-path utilities used at trust boundaries.

The public `/admin/` page contains no CMS or credentials. It is a small gateway that uses `location.replace()` to open the same-origin Cloudflare application, allowing `HttpOnly`, `Secure`, `SameSite=Strict`, `__Host-` session cookies.

## Repository map

```text
apps/
  site/                 Astro public site and published content
    src/content/        Published notes and projects
    src/data/           Published homepage and résumé data
    public/             Stable résumé PDF and published media
  admin/                React CMS, Worker, Wrangler config, D1 migrations
packages/shared/        Runtime schemas and security utilities
scripts/                Interactive secret initialization
.github/workflows/      Pages and manual Cloudflare deployments
tests/e2e/              Playwright public-site and CMS browser tests
```

## Local development

Requirements: Node.js 22.12+, pnpm 11+, and a free Cloudflare account for Worker integration.

```bash
pnpm install
pnpm --filter @brendon/site dev
pnpm --filter @brendon/admin dev
```

The public site uses `http://127.0.0.1:4321`; the CMS UI uses `http://127.0.0.1:5173`. To run the Worker locally, copy `apps/admin/.dev.vars.example` to `apps/admin/.dev.vars`, replace the safe placeholders locally, apply the local database migration, and start Wrangler:

```bash
pnpm --filter @brendon/admin db:migrate:local
pnpm --filter @brendon/admin worker:dev
```

The Vite server proxies `/api` to `http://127.0.0.1:8787`. `.dev.vars`, `.env`, production secrets, build output, and source maps are ignored by Git.

## Editing and publishing

The CMS sections are Home, Posts, Projects, Résumé, Site, and Settings.

- Posts use a Word-inspired Tiptap editor with semantic headings, text emphasis, lists, quotes, code, links, images, tables, undo/redo, `Ctrl/Cmd+S`, debounced autosave, preview, and publish status.
- Project records support ordering, publication state, icons, accent color, story fields, features, technology, URLs, and published media paths. Clicking a public project opens an accessible history-aware dialog at `/projects/?project=slug`.
- The résumé editor manages structured experience, education, certifications, skill groups, links, and selected work. The HTML résumé and stable PDF are separate, so either can be updated without parsing the other.
- Homepage fields and harmless site settings publish to validated JSON.

Drafts stay in D1. Publishing validates the complete payload, derives the repository destination server-side, commits with a human-readable message, and reports that GitHub Pages deployment is in progress. The Worker cannot write `.github/workflows/` or accept an arbitrary repository path.

## Initial GitHub setup

1. Create or rename the repository to `brendonbusker/brendonbusker.github.io`, with the default branch `main`. The public URL is already configured from the GitHub profile and project links in the supplied résumé.
2. Confirm the repository default branch is `main`.
3. Push this repository to `main`.
4. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
5. Run the “Deploy public site to GitHub Pages” workflow or push a public-site/content change.
6. Confirm `https://brendonbusker.github.io`, `/notes/`, `/projects/`, `/resume/`, `/rss.xml`, and `/admin/` load.

The Pages workflow has only `contents: read`, `pages: write`, and `id-token: write`. The public build never receives the CMS GitHub token.

## Fine-grained GitHub publishing token

Create a fine-grained personal access token in GitHub under **Settings → Developer settings → Personal access tokens → Fine-grained tokens**:

1. Choose the account that owns `brendonbusker.github.io` as resource owner.
2. Set repository access to **Only select repositories**, then select only `brendonbusker.github.io`.
3. Under repository permissions, set **Contents: Read and write**.
4. Leave Administration, Actions, Workflows, Issues, Pull requests, and every other permission at **No access**.
5. Choose a practical expiration and record a rotation reminder.
6. Do not add the token to `.env`, `.dev.vars` in source control, GitHub Actions, D1, or frontend configuration. Store it directly in Cloudflare:

```bash
cd apps/admin
pnpm exec wrangler secret put GITHUB_TOKEN
```

To rotate it, create the replacement token, run the same `wrangler secret put GITHUB_TOKEN` command, verify a CMS publish, then revoke the old token.

## Cloudflare setup and deployment

All commands below run from `apps/admin` unless shown otherwise.

1. Authenticate your local machine:

   ```bash
   pnpm exec wrangler login
   ```

2. Create D1:

   ```bash
   pnpm exec wrangler d1 create personal-site-cms
   ```

   Copy the returned database ID into `d1_databases[0].database_id` in `wrangler.jsonc`.

3. Replace `REPLACE_WITH_WORKERS_SUBDOMAIN` with the workers.dev subdomain shown by Cloudflare. Keep the two rate-limit bindings at 5 attempts/minute per protected IP fingerprint and 25 verification attempts/minute globally. These run before Turnstile, D1 session work, or PBKDF2 verification.

4. Apply the remote migration:

   ```bash
   pnpm db:migrate:remote
   ```

5. In the Cloudflare dashboard, create a Turnstile widget in **Managed** mode, restricted to the final admin hostname. Put its public site key in `wrangler.jsonc`, then store its secret:

   ```bash
   pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
   ```

6. Store the repository-scoped GitHub token as described above.

7. From the repository root, initialize the administrator credentials. The script hides the 20+ character password, confirms it, generates a random salt and pepper, derives a PBKDF2-HMAC-SHA-256 verifier, and pipes only secrets to Wrangler. Plaintext is never printed or written:

   ```bash
   pnpm setup:admin-password
   pnpm setup:session-secret
   ```

   On Windows, `pnpm setup:admin-password -- --generate` can instead create a
   random 32-character password and place the one-time plaintext value on the
   clipboard. Save it immediately in a password manager; only the derived
   verifier, salt, and pepper are stored in Cloudflare.

8. Deploy:

   ```bash
   pnpm --filter @brendon/admin run deploy
   ```

9. Update `adminUrl` in `apps/site/src/data/site.json` and `ADMIN_ORIGIN` in `apps/admin/wrangler.jsonc` to the exact deployed HTTPS origin. Redeploy both applications.

10. Visit `https://brendonbusker.github.io/admin/`, sign in, save a test draft, preview it, publish it, and confirm the GitHub Pages workflow creates the dated page and updates the homepage/archive.

For optional GitHub-initiated Worker deployments, add `CLOUDFLARE_API_TOKEN` with Workers Scripts and D1 edit permission, plus `CLOUDFLARE_ACCOUNT_ID`, as GitHub Actions repository secrets. The admin workflow is manual-only so a normal content push cannot unexpectedly deploy the Worker.

## Secrets and rotation

Production secrets are `ADMIN_USERNAME`, `ADMIN_PASSWORD_VERIFIER`, `ADMIN_PASSWORD_SALT`, `ADMIN_PASSWORD_PEPPER`, `SESSION_SECRET`, `IP_HASH_SECRET`, `GITHUB_TOKEN`, and `TURNSTILE_SECRET_KEY`. List secret names with `wrangler secret list`; Cloudflare does not reveal values.

- Change the password by rerunning `pnpm setup:admin-password`. Existing sessions should also be removed from D1 or the session secret rotated.
- Rotate session/privacy secrets with `pnpm setup:session-secret`, then clear the `sessions` table to invalidate all cookies.
- Rotate the GitHub token as described above.
- Rotate the Turnstile secret with `wrangler secret put TURNSTILE_SECRET_KEY` after replacing it in Cloudflare.

## Backups and recovery

Published content and each résumé PDF version live in Git history. Restore an earlier normal content file with a new revert commit; do not rewrite the public branch. Private drafts live in D1 and should be exported periodically with Wrangler's D1 export facilities. Session and security-event records are disposable and must not be restored across secret rotation.

## Validation

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

The unit suite covers schemas, URL protocol rejection, slugging, Markdown sanitization/serialization behavior, password-verifier derivation, session expiration, CSRF comparison, and repository path allowlisting. Worker tests cover public configuration, missing sessions, origin rejection, limiter ordering, and generic authentication errors. Playwright covers public routes, PDF links, mobile navigation, keyboard project dialogs, escape/focus restoration, browser history/deep links, login presentation, the CMS shell, and editor access.

## Security checklist

- [x] No plaintext password, password verifier, Turnstile secret, session secret, or GitHub token is committed or bundled.
- [x] Password verification is server-side PBKDF2-HMAC-SHA-256 with per-install salt and pepper after abuse checks.
- [x] Per-IP and global Cloudflare rate limiters execute before Turnstile and password verification.
- [x] Turnstile requires server-side verification and an admin-hostname-restricted widget.
- [x] Sessions use a random 256-bit token; only its SHA-256 hash is in D1.
- [x] The cookie is `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, with no Domain.
- [x] Idle and absolute expiry are enforced server-side; logout deletes the session immediately.
- [x] Mutations require exact Origin and a session-bound CSRF token; permissive CORS is absent.
- [x] External URL protocols, slugs, dates, payload size, schemas, Markdown, image types/signatures, PDF signature, and repository paths are validated.
- [x] The Worker constructs destinations and explicitly rejects traversal and `.github/workflows/`.
- [x] Strong CSP, clickjacking, MIME-sniffing, referrer, permissions, and HSTS headers are set on the CMS.
- [x] Security logs exclude secrets and raw IPs, cap retention, and use a keyed IP fingerprint.
- [x] Admin production source maps are disabled; security does not rely on source secrecy.
- [x] Public pages are static and remain available during Worker or free-tier exhaustion.
- [ ] Cloudflare/D1, Turnstile, real origins, repository owner, and secrets require the owner setup above before production login/publishing can pass.
- [ ] The least-privilege token scope and final Turnstile hostname must be confirmed in their provider dashboards after creation.

## Current limitations and sensible next steps

- GitHub's Contents API gives safe optimistic updates for each normal content file. A future media-heavy editor could use the Git Data API to group several already-validated images and content into one atomic commit.
- The browser should downscale screenshots before upload; the Worker independently enforces signatures and size. Cloudflare Image Resizing is intentionally not required because it can introduce paid usage.
- The initial résumé reflects the provided PDF and should be reviewed in the CMS because that PDF is known to be out of date.
- TOTP can be added behind the existing authentication boundary later; password + Turnstile + layered throttling is the launch configuration.
- Tags and note search can be added when the archive is large enough to justify them; the year-grouped static archive already scales without client JavaScript.
- A custom domain can move the CMS to `admin.example.com` without changing the same-origin session model.

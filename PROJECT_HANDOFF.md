# Personal Homepage / Private CMS — Agent Handoff

Last updated: September 7, 2026  
Repository: `brendonbusker/brendonbusker.github.io`  
Primary branch: `main`

## Read this first

This is the operational handoff for future Codex/Astra work in this repository. The original product and architecture specification remains [`kickoff.txt`](./kickoff.txt); use that for product intent and acceptance criteria. Use this file for the current implementation, production environment, recent decisions, and safe working procedure.

At the beginning of every development task:

1. Run `git status -sb` and `git fetch origin`.
2. Compare local `main` with `origin/main` before editing.
3. Preserve all remote CMS commits. The production admin writes published content directly to `main`, so the user may have published content since the last agent turn.
4. If local work must be integrated after new CMS commits, commit the scoped local work and use a non-destructive rebase onto `origin/main`. Never reset away user content.
5. Read the relevant implementation before proposing a replacement. This is a working production system, not a greenfield scaffold.

## Product state

The site and CMS are implemented and live:

- Public site: <https://brendonbusker.github.io>
- Private CMS: <https://personal-site-admin.brendonbusker.workers.dev>
- Public `/admin/` gateway redirects to the Cloudflare CMS.
- GitHub Pages deploys the Astro site from `main`.
- The Cloudflare Worker serves the React admin and its same-origin API.

The public site is intentionally static and remains available if Cloudflare is unavailable. Cloudflare is the private authoring/publishing backend, not a runtime dependency for public pages.

## Architecture

### `apps/site`

- Astro + TypeScript static public site.
- Editorial design using Newsreader + Inter, custom CSS, and minimal JavaScript.
- Routes: `/`, `/blog/`, dated blog posts, `/projects/`, `/resume/`, `/admin/`, RSS, sitemap, and a designed 404.
- Legacy `/notes/` routes remain for compatibility, while visible language is branded as “Blog.”
- Both archives share `BlogArchive.astro` with browser-side search over published titles, excerpts, and sanitized article text. Search ignores case/accents/punctuation, requires every query word to match, keeps chronological order, hides empty year groups, and supports shareable `?q=` URLs. Only published text enters the static index; the Worker is not involved. Without JavaScript, the full archive stays readable and the inactive search form stays hidden.
- Project details use accessible dialogs with query-string deep links, Escape handling, focus restoration, scroll locking, and browser-history behavior.

Published sources:

- `apps/site/src/content/posts/*.md` — blog posts and sanitized rich HTML/Markdown bodies.
- `apps/site/src/content/projects/*.md` — individual projects.
- `apps/site/src/data/site.json` — homepage identity, introductions, metadata, links, location, and timezone.
- `apps/site/src/data/resume.json` — structured web résumé.
- `apps/site/src/data/appearance.json` — public theme policy.
- `apps/site/src/data/projects-page.json` — editable Projects page eyebrow, headline, and description.
- `apps/site/src/data/blog-page.json` — editable Blog archive eyebrow, headline, and description, shared by `/blog/` and legacy `/notes/`.
- `apps/site/public/uploads/` — published project and post images.
- `apps/site/public/resume/Brendon-Busker-Resume.pdf` — stable downloadable résumé PDF.
- `apps/site/public/og-v2.svg` and `og-v2.png` — editable source and 1200×630 social preview matching the current landing page.

### `apps/admin`

- React 19 + Vite + Fluent UI.
- Microsoft 365/Word-inspired private publishing interface.
- Sections: Home, Blog, Projects, Résumé, Site, and Settings.
- Tiptap/ProseMirror blog editor with debounced D1 autosave, formatting ribbon, clipboard/font/paragraph/insert controls, tables, uploaded image previews, resizing, and image layouts including inline, full, left/right wrap, behind, and front.
- Published blog entries can be reopened, edited, republished, or deleted with confirmation and optimistic SHA checks.
- Blog Insert Image accepts animated GIFs. GIF uploads preserve their original bytes, frames, timing, loop settings, and resolution rather than going through the static WebP/canvas optimizer. The existing 6 MB upload limit applies. The Worker validates GIF signatures/basic structure and uses an allowlisted, generated `.gif` destination. Public posts render them with ordinary `<img>` elements. Editor/Preview use trusted local blob URLs until the GitHub Pages image deployment is available; reopening uses the published image URL.
- Project screenshots persist after reopening. The first screenshot is the public modal cover; screenshots can be reordered or removed before publishing.
- Projects includes a separate “Edit page introduction” screen for its page-level copy.
- Blog also has an “Edit page introduction” button above its post search. It loads current published copy, previews the three fields, and publishes with the loaded GitHub SHA. Its initial JSON preserves the previously hard-coded archive copy. Returning to the post editor keeps the selected post and its edits.
- Site editor loads the latest published homepage data rather than stale seed data.
- Résumé now has a PDF generator using the current editor snapshot (including unsaved edits) with a preview, download, and explicit Publish PDF action. The template now matches the user-approved root `resume.pdf`: one Letter page for the reference content, Standard 14 Times fonts, centered contact line, ruled headings, hyphen bullets, and Skills → Experience → Projects → Education → Certifications. It omits the website headline, summary and role descriptions. Project technologies, GitHub URL and accomplishments are optional backward-compatible schema fields with CMS editors, along with contact/certification editing and education dates. Longer edits paginate normally. Font metrics are bundled under `src/fonts`, with kerning disabled to match the original; PDF text remains selectable. It includes only contacts marked public. Edits after generation invalidate the downloadable/publishable snapshot until regenerated. pdfmake and bundled fonts load only on Generate; no external résumé service or font request is used. Publishing uses the existing protected PDF endpoint and status banner; the public web résumé remains independently published. `resume-pdf.ts` contains the template and nonblocking content checks. Worker CSP permits `blob:` frames for the PDF preview. Current data produces two readable pages; extraction/links/private-contact omission and both page renders were verified. Blank optional URLs now safely pass their schema union; malformed URLs return validation errors instead of throwing inside the protocol refinement.

### `apps/admin/worker`

- Hono Cloudflare Worker.
- Serves admin assets and same-origin protected APIs.
- D1 stores drafts, sessions, and bounded security events.
- GitHub Contents API publishes only schema-validated, server-allowlisted paths.
- Uses expected GitHub SHAs for safe optimistic updates.
- Media signatures, sizes, extensions, paths, URLs, Markdown/HTML, origins, CSRF, sessions, and login abuse controls are validated server-side.

### `packages/shared`

- Zod schemas, shared types, sanitization, authentication helpers, and repository-path security rules.
- Any new publishable singleton or file destination must be added to both its schema/publish handling and the repository-path allowlist. A missing allowlist entry previously caused appearance settings to fail to load and publish, so always add a regression test for new paths.

## Publishing model

The admin now tracks its latest browser-local publication in a global banner, including media/PDF uploads and post deletion. `/api/deployment/:version` is session-protected, validates a full commit SHA, reads public Pages workflow metadata without widening the publishing token permissions, and checks the static `/deployment.json` artifact marker. It only reports Live when the deployed commit equals or descends from the published commit, using the existing Contents permission for comparisons. This handles Pages concurrency cancellation when a later build contains the change. Reads are cached for 30 seconds; the browser polls every 30 seconds for ten minutes, stops on live/failure, expired sessions, or persistent status errors, and offers Check again. The last publication is stored in localStorage and rechecked after refresh. No D1 migration or new secrets are required. The marker is generated at site build time from GitHub Actions' `GITHUB_SHA`; local builds use null. Existing published content is unchanged.

Publication status checks retry temporary network/time-out/server errors automatically after 5, 15, and 30 seconds, showing Rechecking status instead of a raw browser error. After repeated failures they offer Check again; an expired session requires sign-in. Each check times out after 20 seconds and is cancelled when the banner is dismissed or replaced. Publishing requests themselves are never retried automatically.

Blog publication timestamps now include the time and numeric UTC offset (for example, `2026-09-07T23:59:59-05:00`). The Worker captures its request time on first publication using the current published site timezone; `CST`, `CDT`, and `CT` settings resolve to `America/Chicago` with daylight-saving support. New-post dates/times are automatic. Reopened published posts expose an editable date/time field; ordinary edits retain the original publication time. Older date-only drafts cannot erase a saved timestamp.

Public sorting and RSS use the actual timestamp. Blog URLs and archive years use the stored local date, never the UTC date, so adding/changing only a time preserves the dated URL. Date-only legacy content remains supported without displaying an invented time. Timestamp strings in Markdown must be quoted so YAML preserves the numeric offset. The two existing posts were backfilled from their first CMS publish commits: `4ae4a2c` (first post, September 3 at 11:23:36 Central) and `767428c` (TikTok post, September 3 at 14:57:30 Central). Their bodies, slugs, and dates were preserved.

1. The CMS loads the current published file and its GitHub SHA.
2. Private drafts autosave to D1 where applicable.
3. Publish validates the complete payload and derives the repository path server-side.
4. The Worker commits the content or media to `main` using the scoped GitHub token.
5. The GitHub Pages workflow rebuilds the static site.
6. A successful CMS response means the commit was created; public visibility follows after the Pages deployment completes.

Never make public page views fetch the Worker or D1.

## Themes

There are 13 public/admin palettes:

`Light`, `Dark`, `Midnight`, `Hacker`, `Dracula`, `Nord`, `Solarized`, `Ocean Depths`, `Sakura`, `Espresso`, `Synthwave`, `Amber CRT`, and `Blueprint`.

Private admin theme selection is browser-local. Public theme policy is published from Admin → Settings and supports:

- Default public theme, including Match System.
- Enabling/disabling visitor selection.
- Any subset or all themes.
- Résumé policy: Always Light, Match visitor selection, or Use public default.
- Visitor choice persisted locally in that browser.

Do not hard-code mutable CMS theme settings in tests. Tests should read `appearance.json` because the user changes it through production.

## Security and credentials

The Cloudflare account, D1 database, rate limiters, Turnstile widget, Worker variables, production secrets, and repository-scoped GitHub token are already configured. Wrangler authentication has been usable on this machine.

Do not ask the user to recreate Cloudflare setup unless a real command proves authorization or configuration has expired. Never print, retrieve, commit, or expose secret values.

Production secret names include:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_VERIFIER`
- `ADMIN_PASSWORD_SALT`
- `ADMIN_PASSWORD_PEPPER`
- `SESSION_SECRET`
- `IP_HASH_SECRET`
- `GITHUB_TOKEN`
- `TURNSTILE_SECRET_KEY`

The username/password are not needed for normal code changes. The user holds the working login credentials.

## Development and validation

From the repository root:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Local URLs:

- Public Astro site: `http://127.0.0.1:4321`
- Admin Vite UI: `http://127.0.0.1:5173`
- Local Worker/API: `http://127.0.0.1:8787`

Current automated coverage includes shared schemas/security, Worker security boundaries and serialization, public routes, all public palettes, theme persistence and résumé policy, mobile navigation, project dialogs/deep links, admin login presentation, published content loading/editing, rich editor image behavior, post deletion, Projects page copy publishing, and public theme publishing.

`pnpm lint` is a required check using the ESLint 9 flat configuration in `eslint.config.mjs`. It covers JavaScript, TypeScript, React hooks/Fast Refresh, Astro components and their scripts, and tests. Generated output is ignored; warnings fail the command. Both deployment workflows run lint before building/deploying. `eslint-plugin-astro` stays on the ESLint 9-compatible 1.x line; newer major versions require ESLint 10. Type checking remains a separate check.

## Deployment

Public site/content:

```bash
git push origin main
```

This triggers `.github/workflows/pages.yml`. Wait for both build and deploy jobs, then verify the live page and any changed asset/metadata URL.

Admin/Worker changes:

```bash
pnpm --filter @brendon/admin run deploy
```

This builds the React admin and deploys the Worker with Wrangler. Admin code does not deploy merely because the public Pages workflow ran.

After deployment:

- Confirm the Worker version was created successfully.
- Confirm the admin HTML references the new asset bundle when frontend code changed.
- Confirm GitHub Pages completed successfully for public/content changes.
- Fetch the affected live URL with cache-busting query parameters and verify the actual output.

## Recent decisions and completed improvements

- Rebranded public/admin “Notes” language to “Blog,” while retaining legacy route compatibility.
- Reworked the editor to avoid typing rollback and stale draft overwrites.
- Added a substantially Word-like toolbar and visible, persistent, resizable images with text-layout controls.
- Added deletion for published posts.
- Made project screenshots function as public modal cover images.
- Added Shiny Hunt Tracker and Ultimate IV Calculator project content and live links.
- Added 13 admin themes, then extended them to the public site with CMS-controlled availability/default/résumé policy.
- Added editable Projects page introduction fields stored independently from individual projects.
- Fixed singleton appearance publishing by adding `appearance.json` to the repository allowlist.
- Replaced the stale social-sharing image with versioned `/og-v2.png`, modeled on the current Midnight landing page. When testing Discord/iMessage caches, use a harmless query string such as `?preview=2`; the metadata itself points to the versioned image.

## Content preservation rules

- Treat all published copy, posts, project descriptions, screenshots, dates, links, résumé edits, and theme settings as user-owned content.
- Do not replace current content with seed data or text remembered from an older screenshot.
- On September 10, 2026, the user explicitly overrode the earlier outdated-source note: match `resume.pdf` in both content and layout. Résumé fields were synchronized to that reference (including phone, skills and project bullets). Preserve all subsequent CMS edits; do not reimport the reference automatically. The web résumé and PDF remain independently published.
- Before committing, fetch again. The user may publish from the CMS while an agent is working.
- If remote `main` advanced, preserve those commits and rebase scoped code work safely.
- Never use `git reset --hard`, discard unrelated modifications, or rewrite public history.

## Design guardrails

Public site:

- Editorial, personal, restrained, and human—not a SaaS dashboard or generic developer template.
- Preserve the strong serif/sans hierarchy, generous whitespace, subtle rules, and deliberate project-card exception.
- Avoid glassmorphism, generic gradients, card grids everywhere, excessive pills, decorative animation, and corporate filler copy.
- Every public theme must remain readable across Home, Blog, articles, Projects/dialogs, and Résumé.

Admin:

- Microsoft 365/Word-inspired productivity application.
- Predictable editing behavior matters more than visual novelty.
- Published previews should reflect the current public design/data rather than stale mock content.
- Destructive actions require explicit confirmation and must clearly distinguish deleting a draft from deleting published content.

## Sensible future work

These are not necessarily current bugs; confirm priority with the user before implementing:

- Generate unique social previews for individual blog posts and projects.
- Add an admin-controlled default Open Graph asset if desired.
- Consider PDF version history/restoration in the CMS if needed; generation, download, and stable-URL publishing are implemented.
- Add tags if the growing blog archive needs topic filters; text search is now implemented.
- Consider TOTP later; current password + Turnstile + layered throttling is the configured launch security model.

## Suggested first prompt for the new Astra task

```text
Continue development of my production personal website and private CMS in this repository. First read PROJECT_HANDOFF.md, then use kickoff.txt as the original product specification and README.md for setup details. Inspect the current repository and production state before making changes. Always fetch origin/main before editing and again before committing because the production CMS writes my published content directly to main; preserve every CMS commit and never replace current content with seed data. The public site is live on GitHub Pages and the private admin/API are live on Cloudflare. Work autonomously, implement requested changes end to end, run proportional type/build/unit/browser checks, deploy the affected service when appropriate, and verify the live result. Ask only when a missing choice would materially change the product.
```

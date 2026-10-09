# Personal Homepage / Private CMS — Agent Handoff

Last updated: October 9, 2026 (explicit recipe cover photos)

Repository: `brendonbusker/brendonbusker.github.io`

Production branch: `main`

Development handoff branch: `linux-migration` (do not deploy during migration)

## Recipes development — October 4, 2026

Recipes was released from `c95340d1d0632cb11d576dd2d0dcf3b4b64af2e4` to `main` on October 4 with user approval. GitHub Pages deployment succeeded and its live `/deployment.json` matched that commit. The production recipe migration and private CMS deployment also succeeded; Worker version is `19f72985-c264-4e5f-b8d3-33b90cebd369`. The public `/recipes/` gallery supports multiple Breakfast/Lunch/Dinner/Snack labels, optional prep/cook minutes and servings, alphabetical browsing, combined full-text search and meal filters, shareable filter URLs, and a no-JavaScript fallback. Individual `/recipes/<slug>/` pages render rich recipe content and have a print layout. The initial release used the first body image as the gallery cover; explicit covers replace that behavior in the October 9 change below. No sample recipes are published or committed as user content.

Admin → Recipes reuses the complete Blog editor with recipe-specific metadata. Photos, original animated GIFs, clipboard image/text paste, rich formatting, previews, drafts, publishing, reopening, and confirmed deletion use the existing protected API model. Draft saves are drained before publishing or changing documents/sections; failed saves retain edits. Published recipe slugs stay fixed when titles change. `recipeSchema`, repository path allowlists, and Worker serialization cover the new content and media paths. Public recipe content remains static and independent of Cloudflare.

Recipe libraries load their Markdown and actual blob SHAs in one bounded GitHub GraphQL request, supporting hundreds of entries without one Worker subrequest per recipe. New recipe creation checks IDs and URLs against an immutable branch snapshot, then uses `createCommitOnBranch` with that expected head. A concurrent publication or an uncertain response requires reopening/retrying explicitly; the Worker never retries writes automatically. Updates keep the existing per-file Contents API SHA check. These GraphQL operations use the same repository Contents token permission.

**Production migration complete:** `apps/admin/migrations/0002_recipe_drafts.sql` was applied before deploying the updated Worker. It rebuilt the draft table to permit recipes and all existing application content types while retaining existing draft records and their indexes. The database had zero drafts before and after migration; the migration record and updated constraint were verified. No new secrets or D1 database were created. Future remote migrations and deployments still require a release request.

The manual admin deployment workflow applies pending remote D1 migrations before deploying, using its existing Cloudflare secrets, and stops if migration fails. Pushing `main` does not dispatch this workflow. The connected GitHub account published this release; terminal Git credentials remain absent. The user completed Wrangler OAuth login on Linux and the private CMS was deployed through the CLI. Production HTML, entry JavaScript, editor JavaScript and CSS matched the local build; `/api/session` returned unauthenticated and `/api/published/recipes` required authentication. Authenticated recipe publishing was tested with mocks, not by creating production test content.

The new browser tests use mocked CMS APIs and an isolated copied Astro project with temporary content fixtures, including a collection with over one hundred recipes. The copied project has separate content/build caches and is removed after building; test fixtures never enter the real content directory. The resulting test output lives under ignored `tmp/`. The bootstrap identified an existing Projects introduction load/edit race in `tests/e2e/admin.spec.ts`; it is unrelated to Recipes and remains a separate follow-up.

Final Linux verification: `pnpm lint`, `pnpm typecheck`, all 79 unit tests, all 51 browser tests (`--workers=2`), and production site/admin builds passed. The local D1 database applied both migrations successfully before the authorized production release described above. The normal site build contains 16 pages and only the empty Recipes index, with no QA fixtures. Existing published content/media and the dependency lockfile remain unchanged. No required private project-file transfers were found; `.dev.vars` remains absent and is only needed for optional real local Worker integration. API tests use mocks.

### Recipe draft save failure — October 4, 2026

The first reported recipe save failure was caused by an expired admin session. Read-only production checks confirmed both D1 migrations were applied, the recipe constraint was correct, there were no stored drafts or active sessions, and an `expired_session` event coincided with the failure. The frontend discarded the API's 401 explanation and showed only “Couldn't save.” The session lifetime and authentication requirements remain unchanged.

The correction keeps the current editor mounted while showing an in-place sign-in dialog. Dismissing that dialog leaves the document available for copying and editing, with a persistent sign-in reminder; protected writes remain blocked until sign-in succeeds. Successful sign-in refreshes CSRF without reloading the document or replaying publication. Blog/Recipes show the actual draft save error and an explicit Retry save action. An already-open tab running the old bundle must have its unsaved content copied somewhere safe before refreshing to load the correction; it cannot gain this recovery flow without reloading.

SQLite-backed Worker tests reproduce recipe saving, updating and reopening with the real migrations, and distinguish schema errors, CSRF rejection and expired sessions. Production validation must continue to avoid creating test recipes or reading private draft content or credentials.

The same recovery handles an expired CSRF token (including opening another admin tab); other 403 responses retain their original errors. Invalid login responses keep the editor open, pending sign-in cannot be dismissed, and late failures from an old session cannot invalidate the new login. Draft writes remain serialized, without automatic mutation retries. Verification passed: 86 unit tests, the 51 existing browser cases (with focused reruns after updating the expired-session expectation and ending development hot reloads), two new browser recovery cases, lint, TypeScript checks and the admin production build. The new browser cases verify failed/cancelled sign-in, preserved recipe fields and selected document, no draft rehydration or automatic publication, renewed CSRF on explicit save/publish, malformed login responses, and pending-dialog dismissal protection. Desktop/mobile recovery screenshots were inspected.

That save-recovery correction was released as `c0476d4db6720a98dc1193f1bdebca3893699c5d` on October 4, with Worker version `9cd36161-84d4-4423-a29d-89ba62163f78`. The live HTML, entry/editor/save-status JavaScript and CSS matched the local build, and recipe APIs continued to require authentication.

### Recipe cover photos — October 9, 2026

The recipe editor has a separate Cover photo control for uploading a finished-dish photo or deliberately selecting an existing recipe image. The selected cover has a gallery-shaped preview, editable alternative text, replacement and removal controls. It is independent of the Word-style document body. Only the explicit cover appears on the public gallery card; recipes without a cover use the text layout even when their instructions contain images. Recipe detail pages and search still use the original body. Existing recipe files are not automatically assigned a cover or rewritten.

The optional `coverImage: { src, alt }` field flows through the shared schema, D1's existing JSON payload, and a single-line JSON object in Markdown frontmatter. Older recipe files remain valid. No database migration, dependency change, or new secret is needed. Cover uploads reuse the protected recipe media route, image optimization/GIF preservation, serialized upload queue, publication/navigation guards and temporary local previews; only permanent `/uploads/...` paths are stored. The chooser normalizes public-site image URLs to those paths and excludes external images, preserving the existing admin CSP. Removing a cover removes its metadata on publication, not the uploaded media or any inline image.

This work started from `3dc9e90`, including the user's October 9 recipe publications and uploaded photos. Preserve those CMS commits and fetch `origin/main` again before release. Production testing must not create sample recipes or choose a cover on the user's behalf.

Validation passed: all 91 unit tests, all 56 browser tests (`--workers=2`), lint, workspace typechecks and site/admin production builds. New checks cover separate cover uploads with no inline images, draft/publish/reopen/removal, unchanged recipe body, GIF preservation, cancelled/failed replacements, delayed upload selection/removal races, navigation locks, safe metadata round-trips and explicit-only public covers. Desktop/mobile controls and gallery screenshots were inspected. The normal site build contains 18 pages and both real recipes; existing published recipe files and photos remain unchanged. The user approved release to `main` and the private CMS on October 9; deployment verification will be recorded after both services finish.

## Read this first

This is the operational handoff for future Codex/Astra work in this repository. The original product and architecture specification remains [`kickoff.txt`](./kickoff.txt); use that for product intent and acceptance criteria. Use this file for the current implementation, production environment, recent decisions, and safe working procedure.

At the beginning of every development task:

1. Run `git status -sb` and `git fetch origin`.
2. Compare local `main` with `origin/main` before editing.
3. Preserve all remote CMS commits. The production admin writes published content directly to `main`, so the user may have published content since the last agent turn.
4. Fetch again before committing. Integrate new CMS commits without discarding content. On the shared `linux-migration` branch, merge `origin/main`; only rebase unpublished development commits. Never force-push or rewrite CMS history.
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
- Home reads the protected `/api/dashboard` endpoint instead of placeholder copy. It selects the newest published post by timestamp, counts published projects, and shows separate web résumé/PDF update dates from each file's latest commit on `main`. Greeting and date use the current clock and configured site timezone. Returning Home or returning to the browser tab reloads data; failed reads show Unavailable with Retry instead of seed values. Git history supplies dates without changing résumé content or requiring a schema migration.
- Tiptap/ProseMirror blog editor with debounced D1 autosave, formatting ribbon, clipboard/font/paragraph/insert controls, tables, uploaded image previews, resizing, and image layouts including inline, full, left/right wrap, behind, and front.
- Published blog entries can be reopened, edited, republished, or deleted with confirmation and optimistic SHA checks.
- Blog supports clipboard image files through Ctrl/Cmd+V and the ribbon Paste button using the same upload flow as Insert Image. It accepts JPEG, PNG, WebP, AVIF and GIF, consumes duplicate clipboard HTML, prompts for alt text, and serializes multi-image/separate paste uploads. Transaction mappings retain the insertion position during typing; a changed document revision or removed insertion location prevents late insertion into the wrong post. Upload progress appears above the editor and blocks Publish until uploads complete. Failed uploads retain text and can be retried by pasting/selecting again. Clipboard APIs cannot restore animation if the source browser only supplies a flattened PNG; original GIF bytes are preferred when available.
- Blog Insert Image accepts animated GIFs. GIF uploads preserve their original bytes, frames, timing, loop settings, and resolution rather than going through the static WebP/canvas optimizer. The existing 6 MB upload limit applies. The Worker validates GIF signatures/basic structure and uses an allowlisted, generated `.gif` destination. Public posts render them with ordinary `<img>` elements. Editor/Preview use trusted local blob URLs until the GitHub Pages image deployment is available; reopening uses the published image URL.
- Project screenshots persist after reopening. The first screenshot is the public modal cover; screenshots can be reordered or removed before publishing.
- Project Publish explicitly sets `published: true`, including for new projects and previously hidden drafts. The ambiguous Published checkbox was removed; existing visible projects have a separate confirmed Hide from website action. Both actions drain pending autosaves and lock the editor during publication, preserving edits on failure. On September 25, Windows Macro Studio's existing content was made visible by changing only its `published` flag; earlier CMS commits had successfully uploaded it with `published: false`.
- Projects includes a separate “Edit page introduction” screen for its page-level copy.
- Blog also has an “Edit page introduction” button above its post search. It loads current published copy, previews the three fields, and publishes with the loaded GitHub SHA. Its initial JSON preserves the previously hard-coded archive copy. Returning to the post editor keeps the selected post and its edits.
- Site editor loads the latest published homepage data rather than stale seed data.
- Résumé now has a PDF generator using the current editor snapshot (including unsaved edits) with a preview, download, and explicit Publish PDF action. The template now matches the user-approved root `resume.pdf`: one Letter page for the reference content, Standard 14 Times fonts, centered contact line, ruled headings, hyphen bullets, and Skills → Experience → Projects → Education → Certifications. It omits the website headline, summary and role descriptions. Project technologies, GitHub URL and accomplishments are optional backward-compatible schema fields with CMS editors, along with contact/certification editing and education dates. Longer edits paginate normally. Font metrics are bundled under `src/fonts`, with kerning disabled to match the original; PDF text remains selectable. It includes only contacts marked public. Edits after generation invalidate the downloadable/publishable snapshot until regenerated. pdfmake and bundled fonts load only on Generate; no external résumé service or font request is used. Publishing uses the existing protected PDF endpoint and status banner; the public web résumé remains independently published. `resume-pdf.ts` contains the template and nonblocking content checks. Worker CSP permits `blob:` frames for the PDF preview. The user-approved reference fits on one page; longer content can paginate. Text extraction, links and private-contact omission were verified. Blank optional URLs now safely pass their schema union; malformed URLs return validation errors instead of throwing inside the protocol refinement.

- Résumé publishing requires a successfully loaded current SHA in both the editor and Worker. Load failures disable editing/publishing and offer Retry. Publishing locks the form, drains pending autosaves in order, and pauses keyboard saves until the write and draft cleanup complete; failures retain edits and unlock the form. The draft hook now serializes writes to prevent older requests overwriting newer saves. Skills and project technologies preserve typing punctuation and keep commas inside parentheses within one item. Web preview includes public contacts, experience descriptions/locations, education dates/locations, certifications and projects. Résumé field rows align at the top so helper text cannot stretch neighboring inputs.
- Résumé experience entries have an “I currently work here” checkbox. Current roles show a disabled “Present” end field; unchecking enables an end date. Toggling back and forth preserves the stored end date. Drafts, web previews, publishing and generated PDFs use the same `current` flag.

### `apps/admin/worker`

- Hono Cloudflare Worker.
- Serves admin assets and same-origin protected APIs.
- D1 stores drafts, sessions, and bounded security events.
- GitHub Contents API and atomic recipe-creation commits publish only schema-validated, server-allowlisted paths.
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
- If remote `main` advanced, preserve those commits. Merge into an already-pushed development branch; rebase only unpublished scoped work.
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

## Linux migration snapshot — October 4, 2026

The Windows checkout was clean before this documentation update. A fresh `git fetch origin` found local `main` and `origin/main` at `e6ef08a09aaf7cb7c3124ab7d2cf9c1ca0bb770f` (September 25 project-publishing fix), with no newer CMS commits at audit time. There were no other local branches, unpushed commits, stashes, nonignored untracked files, or additional worktrees. All application changes from the conversation are already in that history; there is no unfinished local implementation to rescue. The migration commit updates this handoff only.

Read-only production checks on October 4 returned HTTP 200 for both services. The public `/deployment.json` reported exactly `e6ef08a09aaf7cb7c3124ab7d2cf9c1ca0bb770f`; the admin HTML referenced `/assets/index-Dte-sc-n.js`. These checks confirm the served version and availability, not a fresh authenticated publishing smoke test. No production writes, secret changes, database migrations, or deployments are part of this migration.

The project-upload problem was fixed in `e6ef08a`: prior CMS commits had uploaded Windows Macro Studio successfully but left `published: false`. Publish now explicitly makes projects visible, while Hide is a separate confirmed action. Do not undo the CMS commits or recreate that project from a seed.

Migration validation on Windows: `pnpm lint` passed; `pnpm test` passed all 61 tests across 13 files; `pnpm exec playwright test --list` discovered 38 browser tests across 13 files. The Windows sandbox initially blocked the test runner's filesystem access; rerunning outside that sandbox passed. Browser tests were enumerated, not executed, and a full build/typecheck/browser run was not repeated for this documentation-only change. Run the complete validation sequence below on Linux before feature work.

Other preserved milestones include dashboard freshness (`ec4a590`), clipboard image uploads (`d609a47`), and résumé editing/publishing hardening (`f9a9e8f`). Search, timestamps, GIF support, editable blog introduction, ESLint, PDF generation and the reported résumé form fixes are implemented, not pending feature requests.

### Preserve work without deploying

`linux-migration` starts from the freshly fetched production history and holds this handoff. Push this branch, not `main`. The Pages workflow's automatic trigger is limited to selected paths on `main`; the admin workflow is manual-only. Do not dispatch either workflow or run the admin `deploy` script during migration. Manual workflow dispatch can deploy even when an automatic branch trigger would not apply.

On Linux, preserve new CMS publications with this sequence before editing and again before committing (resolve any conflicts deliberately, keeping current published content):

```bash
git status -sb
git fetch origin
git merge --ff-only origin/linux-migration
git merge origin/main
# Make and validate scoped changes; fetch/merge again before committing.
git add <explicit-files>
git commit -m "Describe the change"
git push origin linux-migration
```

Run merges with a clean worktree; if local and remote development branches diverge, inspect their commits and merge rather than reset. A later release can merge reviewed development work into current `main`, then deploy only the affected service. Moving machines does not authorize such a release.

## Known limitations and unfinished work

The following are separate follow-up areas from the earlier source inspection:

1. **Prioritize project load-failure handling.** `ProjectEditor.tsx` initially uses seed projects, reports a failed published-project fetch, then clears `syncing`. Unlike the résumé editor, it does not retain a successful-load requirement before publishing. Replace that fallback with a read-only error/retry state so a failed read cannot encourage publishing stale data. The separate project introduction editor already requires its loaded source SHA.
2. **Prioritize project draft recovery and navigation.** The project selector is based on repository projects, not a full D1 draft listing. New unpublished drafts lack a discoverable library after leaving the editor. Audit switching projects with a pending autosave; the shared hook cancels pending timers when its scope changes. Add focused reproduction tests before changing behavior.
3. **Clarify project Delete.** Its current action deletes the D1 draft, not the published Markdown file. Use Hide from website to remove public visibility. Improve the label/confirmation instead of implying published deletion.
4. **Check project previews and renaming.** The preview uses stored screenshot paths directly; `/uploads/...` resolves against the admin origin rather than the public site. Verify/fix this in the editor. Changing the title also regenerates the slug; assess preservation of existing project deep links before allowing renames to alter URLs.
5. **Project introduction load/edit race.** Its fields accept input during initial loading and a late response can replace an early edit. The Linux baseline exposed this in the existing admin browser test. It remains outside the Recipes changes.

The shared Blog/Recipes editor now uses autosave draining and edit locks during publication, and guards delayed clipboard cuts against document/selection changes. Linux bootstrap is complete with Node 24.13.0, pnpm 11.19.0, frozen dependencies and Playwright Chromium. The existing Linux libraries support local builds and browser tests; no production credential setup was run. The password setup script's `--generate` clipboard mode still supports Windows only.

Uploads are separate immediate GitHub commits: an image uploaded while composing an unpublished draft can already become public. Private D1 drafts do not make uploaded media private. Original animated GIFs remain animated; a clipboard that supplies only a flattened PNG cannot preserve the missing frames.

Future product options, after editing reliability and Linux validation: per-post/project social preview images; a CMS-controlled default Open Graph image; PDF history/restoration; topic tags when useful; optional TOTP. These are suggestions, not approved work. Preserve the original résumé layout rather than adding a professional summary or invented achievements. Web résumé Publish and Publish PDF are independent actions.

## Linux setup and validation

Use Git, Node.js **24.x** (Windows audit runtime: 24.13.0), and **pnpm 11.19.0**, pinned in `package.json`. Install Node through your preferred Linux version manager, then install the pinned pnpm. Current Astro requires Node >=22.12; Wrangler requires Node >=22. The deployment workflows currently select Node 22. Do not upgrade dependencies merely to migrate operating systems.

```bash
npm install --global pnpm@11.19.0
git clone --branch linux-migration https://github.com/brendonbusker/brendonbusker.github.io.git
cd brendonbusker.github.io
git fetch origin
git merge origin/main
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
```

Playwright's OS dependency installation may require sudo on supported Debian/Ubuntu distributions. Use the distribution's equivalent dependencies elsewhere. Reinstall packages rather than copying Windows `node_modules`, pnpm stores, Chromium, or compiled Worker binaries. Linux's case-sensitive paths should be checked by the fresh build and tests.

Run the full baseline once on the new machine:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Playwright starts the public site and admin UI itself and uses mocked CMS APIs; these tests do not require production login credentials. Use `pnpm test:e2e --workers=2` if resources are limited. For interactive frontend work, use separate terminals:

```bash
pnpm --filter @brendon/site dev:foreground --host 127.0.0.1
pnpm --filter @brendon/admin dev
```

The explicit foreground script prevents Astro's background-server behavior from confusing terminal/test lifecycle. URLs remain 4321 (site), 5173 (admin UI), and 8787 (optional local Worker). Preview routes, mobile layouts, project dialogs, blog search, all theme policies, résumé inputs/newlines and PDF generation. Mock publishing for browser tests; do not create public test posts merely to validate the migration.

For optional real local Worker integration:

```bash
cp apps/admin/.dev.vars.example apps/admin/.dev.vars
# Configure isolated local credentials/settings privately before proceeding.
pnpm --filter @brendon/admin build
pnpm --filter @brendon/admin db:migrate:local
pnpm --filter @brendon/admin worker:dev
```

The tracked Wrangler config points to the production repository and `main`. A local D1 database does **not** prevent the local Worker from making real GitHub publishing requests. Use an isolated test repository/token with local overrides for `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `PUBLIC_SITE_URL`, the local `ADMIN_ORIGIN`, and test Turnstile configuration. Keep values only in ignored local configuration. Never use a production publishing token just to enable a mock-based test suite. Do not run `db:migrate:remote`, `setup:admin-password`, `setup:session-secret`, or `deploy` during bootstrap.

Authenticate Linux GitHub access afresh with your chosen HTTPS credential manager or SSH setup. Windows currently uses Git Credential Manager with an HTTPS remote. For future authorized Cloudflare operations, run `pnpm --filter @brendon/admin exec wrangler login` on Linux. Existing Cloudflare resources and production secrets stay in place; do not recreate the D1 database, Turnstile widget, or Worker.

For PDF-specific template work, the tracked `scripts/verify-resume-pdf.py` uses Python and `pdfplumber`; a Linux virtual environment and Poppler (`pdftoppm`) are useful for extraction/render comparisons. Root `resume.pdf` is the approved original visual reference and is already tracked. Compare its text only when intentionally generating that reference content; subsequent live CMS résumé edits are authoritative and may differ.

## Local-only files and private state transfer inventory

**Required separate project-file transfers: none found.** At audit time there is no actual project `.dev.vars`, `.env`, local D1 database, SQL backup, private key, or private npm configuration to migrate. Only the tracked `apps/admin/.dev.vars.example`, `apps/site/.env.example`, and D1 migration SQL were found. `apps/admin/.wrangler/` contains no local database files. Git includes source, tests, schemas, migrations, lockfile, all current published content/media, root `resume.pdf`, and the downloadable public PDF.

This inventory covers the project plus conventional Wrangler/Git/SSH locations; it is not a search of every unrelated disk folder or every possible password-manager store. Keep access to your GitHub account, Cloudflare account and CMS username/password through your password manager. Secret values were neither retrieved nor added to this handoff.

| Location/state | Transfer decision |
| --- | --- |
| Cloudflare Worker production secrets named above | Already remote. Keep them there; no file transfer or rotation needed. Cloudflare does not return their values. |
| Remote D1 `personal-site-cms` | Drafts, sessions, security events and admin preferences remain hosted. No local copy was found and no export was made. An optional private draft/preferences backup should be exported securely before decommissioning accounts, not committed. Moving the development machine does not require restoring D1. |
| GitHub Actions deployment secrets, if configured | Remain in GitHub; no Linux file transfer. Their presence/values were not queried during this audit. |
| `C:\Users\brend\AppData\Roaming\xdg.config\.wrangler\config\default.enc` | Existing encrypted, machine-specific Wrangler authentication. Do not commit or copy as Linux configuration; log in again. Wrangler logs, metrics, preferences, cache and native keyring packages beside it are also unnecessary. |
| Windows Git Credential Manager store | Machine-managed authentication, not a repository file. Authenticate again on Linux; do not export tokens into source. |
| `C:\Users\brend\.ssh\config` | Optional for unrelated SSH workflows; inspect privately and adapt Windows paths if transferring. This repository uses HTTPS. |
| `C:\Users\brend\.ssh\homeserver_ed25519` | Private key for a separate SSH identity; not required for this website. If retaining that access, transfer securely outside Git and set Linux permissions to 600. Contents were not read. |
| `C:\Users\brend\.ssh\homeserver_ed25519.pub` | Matching public key, optional with the above identity. |
| `C:\Users\brend\.ssh\known_hosts` and `known_hosts.old` | Optional SSH host-trust history; not required for this repository. |
| Browser state | Sign in to the CMS again. Themes (`brendon-publishing-theme`, `brendon-public-theme`) and last-publication banner (`cms-latest-publication`) are browser-local and can be reset. Do not migrate session cookies into the repository. |

### Optional QA evidence worth copying separately

All paths below are relative to the Windows checkout `C:\Users\brend\Documents\Codex\Personal-Homepage`. They are ignored, historical evidence, not required runtime data. Copy these privately if you want to retain earlier investigations; résumé PDFs/screenshots can contain personal contact information. Some scripts assume Windows paths or test behavior from before later fixes; the tracked tests are the current regression suite. No ignored file is included in the migration commit.

```text
tmp/dashboard-current.json
tmp/generate-long-resume.ts
tmp/generate-resume.ts
tmp/resume-smoke-report.json
tmp/resume-smoke.cjs
tmp/verify-dashboard-data.ts
tmp/verify-dashboard-ui.cjs
tmp/verify-live-resume.cjs
tmp/verify-project-live.cjs
tmp/verify-resume-checkbox.cjs
tmp/verify-resume-layout.cjs
tmp/lighthouse/home.json
tmp/pdfs/full-chrome-preview.png
tmp/pdfs/generated-resume.pdf
tmp/pdfs/live-cms-pdf-preview.png
tmp/pdfs/live-generated-resume.pdf
tmp/pdfs/live-matched-preview.png
tmp/pdfs/live-matched.pdf
tmp/pdfs/long.pdf
tmp/pdfs/matched-1.png
tmp/pdfs/matched.pdf
tmp/pdfs/reference-1.png
tmp/pdfs/resume-1.png
tmp/pdfs/resume-2.png
tmp/pdfs/smoke-generated.pdf
tmp/pdfs/smoke-live-1.png
tmp/pdfs/smoke-live.pdf
tmp/visual/admin.png
tmp/visual/dashboard-live-1365.png
tmp/visual/dashboard-live-390.png
tmp/visual/home.png
tmp/visual/resume-checkbox-after-1280.png
tmp/visual/resume-checkbox-after-390.png
tmp/visual/resume-checkbox-before-1280.png
tmp/visual/resume-checkbox-live-1280.png
tmp/visual/resume-checkbox-live-390.png
tmp/visual/resume-preview-after-1280.png
tmp/visual/resume-preview-after-390.png
tmp/visual/resume-preview-live-1280.png
tmp/visual/resume-preview-live-390.png
tmp/visual/resume.png
tmp/visual/smoke-public-resume-1280.png
tmp/visual/smoke-public-resume-390.png
tmp/visual/windows-macro-studio-live.png
```

Skip these rebuildable ignored directories: root `node_modules/`, `apps/admin/node_modules/`, `apps/site/node_modules/`, `packages/shared/node_modules/`, `apps/admin/dist/`, `apps/site/dist/`, `apps/site/.astro/`, `test-results/`, and empty `apps/admin/.wrangler/`. Also skip the obsolete `tmp/worker-dry-run/index.js`, `tmp/worker-dry-run/index.js.map`, and `tmp/worker-dry-run/README.md`. Rebuild them if needed; do not treat generated bundles as missing source.

## Starter prompt for the Linux session

```text
Continue this website on linux-migration. Read PROJECT_HANDOFF.md, kickoff.txt and README.md. Fetch origin, preserve newer CMS commits from main, install the pinned dependencies, and run the Linux validation steps. Keep current content and secrets safe. Stay on the development branch and do not deploy until I request a release. Report any migration blockers, then wait for my next feature request.
```

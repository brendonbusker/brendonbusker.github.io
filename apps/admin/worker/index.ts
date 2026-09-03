import { Hono } from "hono";
import sanitizeHtml from "sanitize-html";
import {
  draftSchema,
  isAllowedRepositoryPath,
  postSchema,
  projectSchema,
  resumeSchema,
  sanitizeFilename,
  sanitizeMarkdown,
  siteProfileSchema,
  timingSafeEqualText,
  validateContent,
  escapeYaml,
} from "@brendon/shared";

interface RateLimiter {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  LOGIN_RATE_LIMITER: RateLimiter;
  GLOBAL_LOGIN_RATE_LIMITER: RateLimiter;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_VERIFIER: string;
  ADMIN_PASSWORD_SALT: string;
  ADMIN_PASSWORD_PEPPER: string;
  SESSION_SECRET: string;
  IP_HASH_SECRET: string;
  GITHUB_TOKEN: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  ADMIN_ORIGIN: string;
  PUBLIC_SITE_URL: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  SESSION_IDLE_MINUTES: string;
  SESSION_ABSOLUTE_HOURS: string;
  PBKDF2_ITERATIONS: string;
}
type Variables = { sessionId: string; csrfHash: string };
type PublishedType = "homepage" | "resume" | "posts" | "projects";
type GitHubFile = {
  type: "file";
  path: string;
  sha: string;
  content?: string;
  encoding?: string;
};
const app = new Hono<{ Bindings: Env; Variables: Variables }>();
const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};
const fromB64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const randomToken = () =>
  b64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
async function sha256(value: string | Uint8Array) {
  const data = typeof value === "string" ? enc.encode(value) : value;
  return b64(
    new Uint8Array(await crypto.subtle.digest("SHA-256", data as BufferSource)),
  );
}
async function pbkdf2(password: string, env: Env) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password + env.ADMIN_PASSWORD_PEPPER),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromB64(env.ADMIN_PASSWORD_SALT),
      iterations: Number(env.PBKDF2_ITERATIONS || 100000),
    },
    key,
    256,
  );
  return b64(new Uint8Array(bits));
}
function cookie(request: Request, name: string) {
  return request.headers
    .get("Cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1);
}
function sessionCookie(token: string, maxAge: number) {
  return `__Host-admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
function clearCookie() {
  return "__Host-admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}
function expectedOrigin(c: {
  req: { header: (key: string) => string | undefined };
  env: Env;
}) {
  const origin = c.req.header("Origin");
  return !!origin && origin === c.env.ADMIN_ORIGIN;
}
async function ipFingerprint(request: Request, env: Env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(env.IP_HASH_SECRET || env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(ip))),
  ).slice(0, 22);
}
async function securityEvent(
  env: Env,
  request: Request,
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO security_events (id,event_type,created_at,ip_fingerprint,user_agent_summary,metadata_json) VALUES (?,?,?,?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        eventType,
        now,
        await ipFingerprint(request, env),
        (request.headers.get("User-Agent") || "").slice(0, 160),
        JSON.stringify(metadata),
      )
      .run();
    if (Math.random() < 0.05)
      await env.DB.prepare(
        "DELETE FROM security_events WHERE id IN (SELECT id FROM security_events ORDER BY created_at DESC LIMIT -1 OFFSET 2000)",
      ).run();
  } catch {
    /* Security logging must not break the protected action. */
  }
}
function securityHeaders(c: any, next: any) {
  return next().then(() => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    c.header(
      "Cache-Control",
      c.req.path.startsWith("/api/")
        ? "no-store"
        : c.req.path.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
    );
  });
}
app.use("*", securityHeaders);
app.get("/api/config", (c) =>
  c.json({ turnstileSiteKey: c.env.TURNSTILE_SITE_KEY }),
);

async function resolveSession(request: Request, env: Env) {
  const token = cookie(request, "__Host-admin_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT id,csrf_hash,last_seen_at,expires_at,absolute_expires_at FROM sessions WHERE token_hash=?",
  )
    .bind(tokenHash)
    .first<{
      id: string;
      csrf_hash: string;
      last_seen_at: string;
      expires_at: string;
      absolute_expires_at: string;
    }>();
  if (!row) return null;
  const now = Date.now();
  if (
    Date.parse(row.expires_at) <= now ||
    Date.parse(row.absolute_expires_at) <= now
  ) {
    await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(row.id).run();
    await securityEvent(env, request, "expired_session");
    return null;
  }
  if (now - Date.parse(row.last_seen_at) > 5 * 60_000) {
    const expires = new Date(
      Math.min(
        now + Number(env.SESSION_IDLE_MINUTES || 45) * 60_000,
        Date.parse(row.absolute_expires_at),
      ),
    ).toISOString();
    await env.DB.prepare(
      "UPDATE sessions SET last_seen_at=?,expires_at=? WHERE id=?",
    )
      .bind(new Date(now).toISOString(), expires, row.id)
      .run();
    row.expires_at = expires;
  }
  return row;
}
app.get("/api/session", async (c) => {
  const session = await resolveSession(c.req.raw, c.env);
  if (!session) return c.json({ authenticated: false });
  const csrfToken = randomToken();
  const csrfHash = await sha256(csrfToken);
  await c.env.DB.prepare("UPDATE sessions SET csrf_hash=? WHERE id=?")
    .bind(csrfHash, session.id)
    .run();
  return c.json({
    authenticated: true,
    csrfToken,
    expiresAt: session.expires_at,
  });
});
app.post("/api/auth/login", async (c) => {
  if (!expectedOrigin(c)) {
    await securityEvent(c.env, c.req.raw, "rejected_origin");
    return c.json({ error: "Request rejected." }, 403);
  }
  const ip = await ipFingerprint(c.req.raw, c.env);
  const [perIp, global] = await Promise.all([
    c.env.LOGIN_RATE_LIMITER.limit({ key: ip }),
    c.env.GLOBAL_LOGIN_RATE_LIMITER.limit({ key: "all-login-verification" }),
  ]);
  if (!perIp.success || !global.success) {
    await securityEvent(c.env, c.req.raw, "rate_limit");
    return c.json(
      { error: "Too many sign-in attempts. Try again shortly." },
      429,
    );
  }
  const body = await c.req
    .json<{ username?: string; password?: string; turnstileToken?: string }>()
    .catch(
      () =>
        ({}) as {
          username?: string;
          password?: string;
          turnstileToken?: string;
        },
    );
  if (!body.turnstileToken) {
    return c.json({ error: "Complete the security check and try again." }, 400);
  }
  const turnstile = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: c.env.TURNSTILE_SECRET_KEY,
        response: body.turnstileToken,
        remoteip: c.req.header("CF-Connecting-IP") || "",
      }),
    },
  )
    .then((r) => r.json<{ success: boolean; hostname?: string }>())
    .catch(() => ({ success: false }));
  if (!turnstile.success) {
    await securityEvent(c.env, c.req.raw, "turnstile_failure");
    return c.json({ error: "Security check failed. Please try again." }, 400);
  }
  const verifier = await pbkdf2(body.password || "", c.env);
  const valid =
    timingSafeEqualText(verifier, c.env.ADMIN_PASSWORD_VERIFIER) &&
    timingSafeEqualText(body.username || "", c.env.ADMIN_USERNAME);
  if (!valid) {
    await securityEvent(c.env, c.req.raw, "login_failure");
    return c.json({ error: "Invalid username or password." }, 401);
  }
  const token = randomToken(),
    csrfToken = randomToken(),
    now = Date.now(),
    idle = Number(c.env.SESSION_IDLE_MINUTES || 45) * 60_000,
    absolute = Number(c.env.SESSION_ABSOLUTE_HOURS || 8) * 3_600_000;
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO sessions (id,token_hash,csrf_hash,created_at,last_seen_at,expires_at,absolute_expires_at) VALUES (?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      await sha256(token),
      await sha256(csrfToken),
      new Date(now).toISOString(),
      new Date(now).toISOString(),
      new Date(now + idle).toISOString(),
      new Date(now + absolute).toISOString(),
    )
    .run();
  await securityEvent(c.env, c.req.raw, "login_success");
  c.header("Set-Cookie", sessionCookie(token, Math.floor(absolute / 1000)));
  return c.json({
    authenticated: true,
    csrfToken,
    expiresAt: new Date(now + idle).toISOString(),
  });
});

app.use("/api/*", async (c, next) => {
  const session = await resolveSession(c.req.raw, c.env);
  if (!session)
    return c.json({ error: "Your session has expired. Sign in again." }, 401);
  c.set("sessionId", session.id);
  c.set("csrfHash", session.csrf_hash);
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    if (!expectedOrigin(c)) {
      await securityEvent(c.env, c.req.raw, "rejected_origin");
      return c.json({ error: "Request rejected." }, 403);
    }
    const csrf = c.req.header("X-CSRF-Token");
    if (!csrf || !timingSafeEqualText(await sha256(csrf), session.csrf_hash)) {
      await securityEvent(c.env, c.req.raw, "csrf_failure");
      return c.json(
        { error: "Security token expired. Refresh and try again." },
        403,
      );
    }
  }
  await next();
});
app.post("/api/auth/logout", async (c) => {
  await c.env.DB.prepare("DELETE FROM sessions WHERE id=?")
    .bind(c.get("sessionId"))
    .run();
  await securityEvent(c.env, c.req.raw, "logout");
  c.header("Set-Cookie", clearCookie());
  return c.json({ ok: true });
});
app.get("/api/drafts", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT id,content_type,content_key,payload_json,updated_at FROM drafts ORDER BY updated_at DESC",
  ).all();
  return c.json({ drafts: result.results });
});
app.get("/api/drafts/:type/:key", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT payload_json FROM drafts WHERE content_type=? AND content_key=?",
  )
    .bind(c.req.param("type"), c.req.param("key"))
    .first<{ payload_json: string }>();
  return c.json({ draft: row ? JSON.parse(row.payload_json) : null });
});
app.put("/api/drafts", async (c) => {
  const input = draftSchema.parse(await c.req.json());
  const now = new Date().toISOString();
  const payload = JSON.stringify(input.payload);
  if (payload.length > 500_000)
    return c.json({ error: "Draft is too large." }, 413);
  await c.env.DB.prepare(
    "INSERT INTO drafts (id,content_type,content_key,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(content_type,content_key) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at",
  )
    .bind(input.id, input.contentType, input.contentKey, payload, now, now)
    .run();
  return c.json({ savedAt: now });
});
app.delete("/api/drafts/:type/:key", async (c) => {
  await c.env.DB.prepare(
    "DELETE FROM drafts WHERE content_type=? AND content_key=?",
  )
    .bind(c.req.param("type"), c.req.param("key"))
    .run();
  return c.json({ ok: true });
});

function githubHeaders(env: Env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Brendon-Busker-CMS",
  };
}

async function githubContent(env: Env, path: string) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`;
  const response = await fetch(url, { headers: githubHeaders(env) });
  if (!response.ok)
    throw new Error(`GitHub content read failed (${response.status})`);
  return response.json<GitHubFile | GitHubFile[]>();
}

async function githubTextFile(env: Env, path: string) {
  if (!isAllowedRepositoryPath(path))
    throw new Error("Repository path rejected");
  const item = await githubContent(env, path);
  if (Array.isArray(item) || item.type !== "file" || !item.content)
    throw new Error("GitHub did not return a file");
  const bytes = fromB64(item.content.replace(/\s/g, ""));
  return {
    path: item.path,
    sha: item.sha,
    text: new TextDecoder().decode(bytes),
  };
}

function parseFrontmatterValue(raw: string): unknown {
  const value = raw.trim();
  if (!value) return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("[") && value.endsWith("]")) ||
    (value.startsWith("{") && value.endsWith("}"))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return value.replace(/^"|"$/g, "");
    }
  }
  return value;
}

export function parseManagedMarkdown(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n"))
    throw new Error("Published content is missing frontmatter");
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("Published content has invalid frontmatter");
  const data: Record<string, unknown> = {};
  let listKey = "";
  for (const line of normalized.slice(4, end).split("\n")) {
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && listKey) {
      const list = Array.isArray(data[listKey]) ? data[listKey] : [];
      (list as unknown[]).push(parseFrontmatterValue(listItem[1] ?? ""));
      data[listKey] = list;
      continue;
    }
    const field = line.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/);
    if (!field) continue;
    listKey = field[1] ?? "";
    if (listKey)
      data[listKey] = field[2] ? parseFrontmatterValue(field[2]) : [];
  }
  return { data, body: normalized.slice(end + 5).trim() };
}

export function sanitizePostBody(body: string) {
  if (!/^\s*</.test(body)) return sanitizeMarkdown(body).trim();
  return sanitizeHtml(body, {
    allowedTags: [
      "p",
      "h1",
      "h2",
      "h3",
      "strong",
      "em",
      "u",
      "s",
      "sub",
      "sup",
      "mark",
      "span",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "br",
      "hr",
      "label",
      "input",
      "div",
    ],
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      table: ["class"],
      th: ["colspan", "rowspan", "colwidth"],
      td: ["colspan", "rowspan", "colwidth"],
      ul: ["data-type"],
      li: ["data-type", "data-checked"],
      input: ["type", "checked", "disabled"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^(?:left|center|right|justify)$/],
        "font-family": [
          /^(?:Arial|Georgia|Segoe UI|Times New Roman|Courier New)(?:, ?(?:sans-serif|serif|monospace))?$/,
        ],
        "font-size": [/^(?:10|11|12|14|16|18|24|32|48)px$/],
        color: [/^#[0-9a-fA-F]{6}$/],
        "background-color": [/^#[0-9a-fA-F]{6}$/],
        "line-height": [/^(?:1|1\.15|1\.5|2)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: { ...attribs, rel: "noopener noreferrer" },
      }),
    },
  }).trim();
}

async function publishedCollection(env: Env, type: "posts" | "projects") {
  const directory = `apps/site/src/content/${type}`;
  const listing = await githubContent(env, directory);
  if (!Array.isArray(listing)) throw new Error("Expected a content directory");
  const files = listing.filter(
    (item) => item.type === "file" && item.path.endsWith(".md"),
  );
  const entries = await Promise.all(
    files.map(async (item) => {
      const file = await githubTextFile(env, item.path);
      const parsed = parseManagedMarkdown(file.text);
      const content =
        type === "posts"
          ? postSchema.parse({ ...parsed.data, body: parsed.body })
          : projectSchema.parse({ ...parsed.data, overview: parsed.body });
      return { content, path: file.path, sha: file.sha };
    }),
  );
  return entries.sort((left, right) => {
    const leftDate =
      "publishedAt" in left.content
        ? left.content.publishedAt
        : left.content.updatedAt;
    const rightDate =
      "publishedAt" in right.content
        ? right.content.publishedAt
        : right.content.updatedAt;
    return rightDate.localeCompare(leftDate);
  });
}

app.get("/api/published/:type", async (c) => {
  const type = c.req.param("type") as PublishedType;
  try {
    if (type === "homepage" || type === "resume") {
      const path = `apps/site/src/data/${type === "homepage" ? "site" : "resume"}.json`;
      const file = await githubTextFile(c.env, path);
      const json: unknown = JSON.parse(file.text);
      const content =
        type === "homepage"
          ? siteProfileSchema.parse(json)
          : resumeSchema.parse(json);
      return c.json({ content, path: file.path, sha: file.sha });
    }
    if (type === "posts" || type === "projects")
      return c.json({ items: await publishedCollection(c.env, type) });
    return c.json({ error: "Unsupported published content type." }, 404);
  } catch (error) {
    const id = crypto.randomUUID();
    console.error(
      "published_content_error",
      id,
      error instanceof Error ? error.message : "unknown",
    );
    return c.json(
      { error: `Could not load published content. Reference ${id}.` },
      502,
    );
  }
});

function serializeContent(type: string, payload: any, targetPath?: string) {
  if (type === "homepage")
    return {
      path: "apps/site/src/data/site.json",
      content: JSON.stringify(siteProfileSchema.parse(payload), null, 2) + "\n",
      message: "cms: update homepage introduction",
    };
  if (type === "resume")
    return {
      path: "apps/site/src/data/resume.json",
      content: JSON.stringify(resumeSchema.parse(payload), null, 2) + "\n",
      message: "cms: update web resume",
    };
  if (type === "post") {
    const p = postSchema.parse({ ...payload, status: "published" });
    const date = p.publishedAt.slice(0, 10);
    const content = `---\nid: ${escapeYaml(p.id)}\ntitle: ${escapeYaml(p.title)}\nslug: ${escapeYaml(p.slug)}\npublishedAt: ${date}\nupdatedAt: ${p.updatedAt.slice(0, 10)}\nexcerpt: ${escapeYaml(p.excerpt || "")}\nstatus: published\n---\n\n${sanitizePostBody(p.body)}\n`;
    return {
      path: targetPath || `apps/site/src/content/posts/${date}-${p.slug}.md`,
      content,
      message: `cms: publish post "${p.title}"`,
    };
  }
  if (type === "project") {
    const p = projectSchema.parse(payload);
    const content = `---\nid: ${escapeYaml(p.id)}\ntitle: ${escapeYaml(p.title)}\nslug: ${escapeYaml(p.slug)}\nsummary: ${escapeYaml(p.summary)}\ncategory: ${escapeYaml(p.category || "")}\nstatus: ${escapeYaml(p.status || "")}\nfeatured: ${p.featured}\npublished: ${p.published}\nsortOrder: ${p.sortOrder}\nliveUrl: ${escapeYaml(p.liveUrl || "")}\ngithubUrl: ${escapeYaml(p.githubUrl || "")}\nicon: ${escapeYaml(p.icon)}\naccent: ${escapeYaml(p.accent)}\ntechStack: ${JSON.stringify(p.techStack)}\nscreenshots: ${JSON.stringify(p.screenshots)}\nwhy: ${escapeYaml(p.why || "")}\nfeatures: ${JSON.stringify(p.features)}\nimplementation: ${escapeYaml(p.implementation || "")}\ncreatedAt: ${p.createdAt.slice(0, 10)}\nupdatedAt: ${p.updatedAt.slice(0, 10)}\n---\n\n${sanitizeMarkdown(p.overview || p.summary)}\n`;
    return {
      path: targetPath || `apps/site/src/content/projects/${p.slug}.md`,
      content,
      message: `cms: update project "${p.title}"`,
    };
  }
  throw new Error("Unsupported publish type");
}
async function githubFile(
  env: Env,
  path: string,
  content: Uint8Array | string,
  message: string,
  expectedSha?: string,
) {
  if (!isAllowedRepositoryPath(path))
    throw new Error("Repository path rejected");
  const base = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const headers = githubHeaders(env);
  const current = await fetch(
    `${base}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`,
    { headers },
  ).then(async (r) =>
    r.status === 404
      ? null
      : r.ok
        ? r.json<{ sha: string }>()
        : Promise.reject(new Error(`GitHub read failed (${r.status})`)),
  );
  if (expectedSha && current?.sha !== expectedSha)
    throw new Error(
      "The published file changed since editing began. Refresh before overwriting.",
    );
  const bytes = typeof content === "string" ? enc.encode(content) : content;
  const response = await fetch(base, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: b64(bytes),
      branch: env.GITHUB_BRANCH,
      ...(current?.sha ? { sha: current.sha } : {}),
    }),
  });
  if (!response.ok)
    throw new Error(`GitHub publish failed (${response.status})`);
  return response.json<{
    content: { path: string; sha: string };
    commit: { sha: string; html_url: string };
  }>();
}
app.post("/api/publish", async (c) => {
  try {
    const body = await c.req.json<{
      contentType: string;
      payload: unknown;
      expectedSha?: string;
      targetPath?: string;
    }>();
    const valid = validateContent(body.contentType, body.payload);
    if (body.targetPath) {
      const expectedPrefix =
        body.contentType === "post"
          ? "apps/site/src/content/posts/"
          : body.contentType === "project"
            ? "apps/site/src/content/projects/"
            : "";
      if (
        !expectedPrefix ||
        !body.targetPath.startsWith(expectedPrefix) ||
        !isAllowedRepositoryPath(body.targetPath)
      )
        throw new Error("Repository path rejected");
    }
    const targetPath =
      body.contentType === "post" || body.contentType === "project"
        ? body.targetPath
        : undefined;
    const item = serializeContent(body.contentType, valid, targetPath);
    const result = await githubFile(
      c.env,
      item.path,
      item.content,
      item.message,
      body.expectedSha,
    );
    return c.json({
      commitUrl: result.commit.html_url,
      version: result.commit.sha,
      contentSha: result.content.sha,
      path: result.content.path,
    });
  } catch (error) {
    const id = crypto.randomUUID();
    console.error(
      "publish_error",
      id,
      error instanceof Error ? error.message : "unknown",
    );
    return c.json({ error: `Publishing failed. Reference ${id}.` }, 400);
  }
});

function detectImage(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8)
    return { mime: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === "PNG")
    return { mime: "image/png", ext: "png" };
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  if (String.fromCharCode(...bytes.slice(4, 12)).includes("ftypavif"))
    return { mime: "image/avif", ext: "avif" };
  return null;
}
app.post("/api/publish/media/:kind/:slug", async (c) => {
  const kind = c.req.param("kind"),
    slug = c.req.param("slug");
  if (
    !["posts", "projects"].includes(kind) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  )
    return c.json({ error: "Invalid media destination." }, 400);
  const data = await c.req.formData();
  const file = data.get("file");
  const alt = String(data.get("alt") || "").trim();
  if (!(file instanceof File) || !alt)
    return c.json({ error: "An image and alt text are required." }, 400);
  if (file.size > 6_000_000)
    return c.json({ error: "Image must be smaller than 6 MB." }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected)
    return c.json(
      { error: "Unsupported image. Use JPEG, PNG, WebP, or AVIF." },
      415,
    );
  const filename = `${Date.now()}-${sanitizeFilename(crypto.randomUUID())}.${detected.ext}`;
  const path = `apps/site/public/uploads/${kind}/${slug}/${filename}`;
  const result = await githubFile(
    c.env,
    path,
    bytes,
    `cms: add ${kind.slice(0, -1)} image`,
  );
  return c.json({
    path: path.replace("apps/site/public", ""),
    alt,
    commitUrl: result.commit.html_url,
  });
});
app.post("/api/publish/resume-pdf", async (c) => {
  const data = await c.req.formData();
  const file = data.get("file");
  if (!(file instanceof File))
    return c.json({ error: "Choose a PDF file." }, 400);
  if (file.size > 8_000_000)
    return c.json({ error: "PDF must be smaller than 8 MB." }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-")
    return c.json({ error: "The selected file is not a valid PDF." }, 415);
  const result = await githubFile(
    c.env,
    "apps/site/public/resume/Brendon-Busker-Resume.pdf",
    bytes,
    "cms: replace resume PDF",
  );
  return c.json({
    path: "/resume/Brendon-Busker-Resume.pdf",
    commitUrl: result.commit.html_url,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not found." }, 404));
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));
app.notFound((c) => c.json({ error: "Not found." }, 404));
app.onError((error, c) => {
  const id = crypto.randomUUID();
  console.error("worker_error", id, error.message);
  return c.json({ error: `Something went wrong. Reference ${id}.` }, 500);
});
export default app;

import { describe, expect, it } from "vitest";
import worker, {
  parseManagedMarkdown,
  sanitizePostBody,
  serializeContent,
} from "./index";

const db = {
  prepare: () => ({
    bind() {
      return this;
    },
    first: async () => null,
    run: async () => ({ success: true }),
    all: async () => ({ results: [] }),
  }),
};
const baseEnv: any = {
  DB: db,
  ASSETS: { fetch: () => new Response("asset") },
  LOGIN_RATE_LIMITER: { limit: async () => ({ success: true }) },
  GLOBAL_LOGIN_RATE_LIMITER: { limit: async () => ({ success: true }) },
  ADMIN_ORIGIN: "https://admin.example.com",
  TURNSTILE_SITE_KEY: "site-key",
  SESSION_SECRET: "secret",
  IP_HASH_SECRET: "ip-secret",
  SESSION_IDLE_MINUTES: "45",
  SESSION_ABSOLUTE_HOURS: "8",
};
describe("worker security boundaries", () => {
  it("exposes only public Turnstile configuration without a session", async () => {
    const res = await worker.request("/api/config", {}, baseEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ turnstileSiteKey: "site-key" });
    expect(res.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(res.headers.get("content-security-policy")).toContain(
      "img-src 'self' data: blob: https://brendonbusker.github.io",
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("revalidates the admin shell instead of serving stale editor code", async () => {
    const res = await worker.request("/", {}, baseEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });
  it("rejects protected APIs without a session", async () => {
    const res = await worker.request("/api/drafts", {}, baseEnv);
    expect(res.status).toBe(401);
  });
  it("rejects unexpected login origins before rate limiting or password work", async () => {
    let limited = false;
    const env = {
      ...baseEnv,
      LOGIN_RATE_LIMITER: {
        limit: async () => {
          limited = true;
          return { success: true };
        },
      },
    };
    const res = await worker.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { Origin: "https://evil.example" },
        body: "{}",
      },
      env,
    );
    expect(res.status).toBe(403);
    expect(limited).toBe(false);
  });
  it("rate limits before Turnstile and password verification", async () => {
    const env = {
      ...baseEnv,
      LOGIN_RATE_LIMITER: { limit: async () => ({ success: false }) },
    };
    const res = await worker.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { Origin: "https://admin.example.com" },
        body: "{}",
      },
      env,
    );
    expect(res.status).toBe(429);
  });
  it("returns a generic missing-session response for mutations", async () => {
    const res = await worker.request(
      "/api/auth/logout",
      { method: "POST", headers: { Origin: "https://admin.example.com" } },
      baseEnv,
    );
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toMatch(/token|password/i);
  });
});

describe("published content parsing", () => {
  it("serializes public appearance settings to their own managed file", () => {
    const serialized = serializeContent("appearance", {
      schemaVersion: 1,
      defaultTheme: "midnight",
      allowVisitorSelection: true,
      visitorThemes: ["light", "midnight", "system"],
      resumeThemeMode: "active",
    });
    expect(serialized.path).toBe("apps/site/src/data/appearance.json");
    expect(JSON.parse(serialized.content)).toMatchObject({
      defaultTheme: "midnight",
      visitorThemes: ["light", "midnight", "system"],
      resumeThemeMode: "active",
    });
  });

  it("reads generated post frontmatter and its full body", () => {
    const parsed = parseManagedMarkdown(
      '---\nid: "f3ca8746-060e-4f5f-a70a-776075596c4c"\ntitle: "A note"\nfeatured: true\ncount: 2\ntags: ["one","two"]\n---\n\nFirst paragraph.\n\nSecond paragraph.\n',
    );
    expect(parsed.data).toMatchObject({
      title: "A note",
      featured: true,
      count: 2,
      tags: ["one", "two"],
    });
    expect(parsed.body).toBe("First paragraph.\n\nSecond paragraph.");
  });
  it("reads block lists used by existing project files", () => {
    const parsed = parseManagedMarkdown(
      '---\nfeatures:\n  - "First"\n  - "Second"\n---\n\nOverview',
    );
    expect(parsed.data.features).toEqual(["First", "Second"]);
  });
});

describe("rich blog body sanitizing", () => {
  it("keeps editor formatting and strips executable content", () => {
    const clean = sanitizePostBody(
      '<p style="text-align: center"><span style="font-family: Georgia; font-size: 24px; color: #315b71">Hello</span><script>alert(1)</script><img src="/uploads/posts/test/image.webp" alt="Example" data-layout="behind" onerror="alert(2)"><img src="/uploads/posts/test/second.webp" data-layout="not-real"></p>',
    );
    expect(clean).toContain('style="text-align:center"');
    expect(clean).toContain("font-family:Georgia");
    expect(clean).toContain('src="/uploads/posts/test/image.webp"');
    expect(clean).toContain('data-layout="behind"');
    expect(clean).toContain('data-layout="block"');
    expect(clean).not.toMatch(/script|onerror|alert/i);
  });
  it("continues sanitizing existing Markdown posts", () => {
    expect(
      sanitizePostBody("# Hello\n\n[x](javascript:alert(1))"),
    ).not.toContain("javascript:");
  });
});

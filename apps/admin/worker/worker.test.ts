import { describe, expect, it } from "vitest";
import worker, { parseManagedMarkdown } from "./index";

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

import { describe, expect, it } from "vitest";
import {
  createSessionTimes,
  csrfHeaderIsValid,
  derivePasswordVerifier,
  excerptFromMarkdown,
  isAllowedRepositoryPath,
  postSchema,
  resumeSchema,
  sanitizeMarkdown,
  sessionIsExpired,
  siteProfileSchema,
  slugify,
} from ".";

describe("content schemas", () => {
  it("accepts a complete site profile and rejects dangerous links", () => {
    const profile = {
      schemaVersion: 1,
      fullName: "Brendon Busker",
      professionalHeadline: "Consultant",
      intro: "Hello",
      secondaryIntro: "",
      socialLinks: [],
      siteTitle: "Brendon",
      siteDescription: "Personal site",
      location: "Austin, Texas",
      timezone: "America/Chicago",
      adminUrl: "https://admin.example.com",
    };
    expect(siteProfileSchema.parse(profile).fullName).toBe("Brendon Busker");
    expect(() =>
      siteProfileSchema.parse({
        ...profile,
        socialLinks: [{ label: "bad", url: "javascript:alert(1)" }],
      }),
    ).toThrow();
  });
  it("requires stable post ids, titles, slugs, and dates", () => {
    expect(() =>
      postSchema.parse({
        id: "nope",
        title: "",
        slug: "Bad Slug",
        publishedAt: "today",
        updatedAt: "today",
        body: "x",
      }),
    ).toThrow();
  });
  it("validates the structured resume model", () => {
    expect(() => resumeSchema.parse({ fullName: "Brendon" })).toThrow();
  });
});
describe("content utilities", () => {
  it("creates durable URL slugs", () =>
    expect(slugify("  A Better First Version! ")).toBe(
      "a-better-first-version",
    ));
  it("removes raw HTML and dangerous protocols", () =>
    expect(
      sanitizeMarkdown("<script>alert(1)</script>[x](javascript:alert(1))"),
    ).not.toMatch(/<script>|javascript:/));
  it("creates bounded plain-text excerpts", () =>
    expect(
      excerptFromMarkdown("# Hello\n\n" + "word ".repeat(100), 40).length,
    ).toBeLessThanOrEqual(41));
});
describe("repository paths", () => {
  it("allows only CMS-owned content and asset destinations", () => {
    expect(
      isAllowedRepositoryPath("apps/site/src/content/posts/hello-world.md"),
    ).toBe(true);
    expect(
      isAllowedRepositoryPath(
        "apps/site/public/resume/Brendon-Busker-Resume.pdf",
      ),
    ).toBe(true);
    expect(isAllowedRepositoryPath(".github/workflows/pages.yml")).toBe(false);
    expect(
      isAllowedRepositoryPath("apps/site/src/content/posts/../config.md"),
    ).toBe(false);
  });
});
describe("authentication helpers", () => {
  it("derives deterministic strong verifiers", async () => {
    const salt = new Uint8Array(24).fill(7);
    const a = await derivePasswordVerifier(
      "a long password",
      "pepper",
      salt,
      1000,
    );
    const b = await derivePasswordVerifier(
      "a long password",
      "pepper",
      salt,
      1000,
    );
    expect(a).toEqual(b);
    expect(a.byteLength).toBe(32);
  });
  it("creates idle and absolute expirations and rejects expired sessions", () => {
    const times = createSessionTimes(Date.UTC(2026, 7, 31), 45, 8);
    expect(
      sessionIsExpired(
        times.expiresAt,
        times.absoluteExpiresAt,
        Date.UTC(2026, 7, 31) + 46 * 60_000,
      ),
    ).toBe(true);
    expect(
      sessionIsExpired(
        times.expiresAt,
        times.absoluteExpiresAt,
        Date.UTC(2026, 7, 31) + 30 * 60_000,
      ),
    ).toBe(false);
  });
  it("requires a nontrivial matching csrf hash", () => {
    const hash = "x".repeat(44);
    expect(csrfHeaderIsValid(hash, hash)).toBe(true);
    expect(csrfHeaderIsValid("no", hash)).toBe(false);
  });
});

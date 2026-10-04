import { describe, expect, it } from "vitest";
import {
  appearanceSchema,
  createSessionTimes,
  csrfHeaderIsValid,
  derivePasswordVerifier,
  excerptFromMarkdown,
  isAllowedRepositoryPath,
  postSchema,
  recipeSchema,
  draftSchema,
  projectPageSchema,
  resumeSchema,
  resumeLinkSchema,
  sanitizeMarkdown,
  sessionIsExpired,
  siteProfileSchema,
  slugify,
} from ".";

describe("content schemas", () => {
  it("allows blank optional résumé URLs and safely rejects malformed links", () => {
    const link = { label: "Phone", value: "555-0100", public: false };
    expect(resumeLinkSchema.safeParse({ ...link, url: "" }).success).toBe(true);
    expect(
      resumeLinkSchema.safeParse({ ...link, url: "not a URL" }).success,
    ).toBe(false);
    expect(
      resumeLinkSchema.safeParse({ ...link, url: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });
  it("validates editable projects page copy", () => {
    expect(
      projectPageSchema.parse({
        schemaVersion: 1,
        eyebrow: "Selected work",
        headline: "Useful things, built with care.",
        description: "Applications and experiments.",
      }).headline,
    ).toBe("Useful things, built with care.");
  });

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
  it("validates recipe meal labels and optional cooking details", () => {
    const recipe = {
      id: "c17b965a-5d6e-4bf0-a924-8a290b2d48f8",
      title: "Chickpea toast",
      slug: "chickpea-toast",
      publishedAt: "2026-10-04",
      updatedAt: "2026-10-04",
      body: "Mash chickpeas and serve on toast.",
      meals: ["breakfast", "lunch"],
    };
    expect(recipeSchema.parse(recipe)).toMatchObject({
      meals: recipe.meals,
      servings: "",
    });
    expect(
      recipeSchema.parse({
        ...recipe,
        prepMinutes: 0,
        cookMinutes: 10_080,
        servings: " 2–3 people ",
      }),
    ).toMatchObject({ prepMinutes: 0, servings: "2–3 people" });
    for (const invalid of [
      { meals: [] },
      { meals: ["brunch"] },
      { meals: ["lunch", "lunch"] },
      { prepMinutes: -1 },
      { cookMinutes: 1.5 },
      { prepMinutes: 10_081 },
      { servings: "x".repeat(61) },
    ])
      expect(recipeSchema.safeParse({ ...recipe, ...invalid }).success).toBe(
        false,
      );
    // Partial recipes can still autosave before they meet publication requirements.
    expect(
      draftSchema.parse({
        id: recipe.id,
        contentType: "recipe",
        contentKey: recipe.id,
        payload: { meals: [] },
      }).contentType,
    ).toBe("recipe");
  });
  it("validates public appearance choices", () => {
    const appearance = appearanceSchema.parse({
      schemaVersion: 1,
      defaultTheme: "midnight",
      allowVisitorSelection: true,
      visitorThemes: ["light", "hacker", "system"],
      resumeThemeMode: "active",
    });
    expect(appearance.visitorThemes).toContain("system");
    expect(() =>
      appearanceSchema.parse({ ...appearance, defaultTheme: "unknown" }),
    ).toThrow();
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
    expect(isAllowedRepositoryPath("apps/site/src/data/appearance.json")).toBe(
      true,
    );
    expect(
      isAllowedRepositoryPath("apps/site/src/data/projects-page.json"),
    ).toBe(true);
    expect(isAllowedRepositoryPath(".github/workflows/pages.yml")).toBe(false);
    expect(isAllowedRepositoryPath("apps/site/src/data/blog-page.json")).toBe(
      true,
    );
    expect(
      isAllowedRepositoryPath("apps/site/src/data/../blog-page.json"),
    ).toBe(false);
    expect(
      isAllowedRepositoryPath(
        "apps/site/public/uploads/posts/test/animated.gif",
      ),
    ).toBe(true);
    expect(
      isAllowedRepositoryPath(
        "apps/site/public/uploads/posts/test/animated.gif.html",
      ),
    ).toBe(false);
    expect(
      isAllowedRepositoryPath("apps/site/public/uploads/posts/../animated.gif"),
    ).toBe(false);
    expect(
      isAllowedRepositoryPath("apps/site/src/content/posts/../config.md"),
    ).toBe(false);
    for (const path of [
      "apps/site/src/content/recipes/chickpea-toast.md",
      "apps/site/public/uploads/recipes/chickpea-toast/animated.gif",
      "apps/site/public/uploads/recipes/chickpea-toast/image.webp",
    ])
      expect(isAllowedRepositoryPath(path)).toBe(true);
    for (const path of [
      "apps/site/src/content/recipes/../posts/stolen.md",
      "apps/site/src/content/recipes/test.html",
      "apps/site/src/content/recipes/test/other.md",
      "apps/site/public/uploads/recipes/test/animation.gif.html",
      "apps/site/public/uploads/recipes/test/image.svg",
    ])
      expect(isAllowedRepositoryPath(path)).toBe(false);
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

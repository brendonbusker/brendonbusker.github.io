import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { parseManagedMarkdown, serializeContent } from "./index";
import { recipeSchema, type Recipe } from "@brendon/shared";

const recipe: Recipe = {
  schemaVersion: 1,
  id: "c17b965a-5d6e-4bf0-a924-8a290b2d48f8",
  title: "Chickpea toast: a favorite",
  slug: "chickpea-toast",
  publishedAt: "2026-09-07T23:59:59-05:00",
  updatedAt: "2026-09-08T04:59:59.000Z",
  body: "<h2>Ingredients</h2><ul><li>Chickpeas</li></ul><p>Serve on toast.</p>",
  excerpt: "Lunch in a hurry.",
  status: "published",
  meals: ["breakfast", "lunch"],
  prepMinutes: 5,
  cookMinutes: 0,
  servings: "2 people",
};
const directory = "apps/site/src/content/recipes";
const path = `${directory}/${recipe.slug}.md`;
const sha = "a".repeat(40);
const initialHead = "d".repeat(40);
const profile = {
  fullName: "Test",
  professionalHeadline: "Test",
  intro: "Test",
  socialLinks: [],
  siteTitle: "Test",
  siteDescription: "Test",
  timezone: "America/Chicago",
  adminUrl: "https://admin.example.com",
};

async function setup(existing?: Recipe) {
  const csrfHash = Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode("csrf")),
  ).toString("base64");
  const session = {
    id: "session",
    csrf_hash: csrfHash,
    last_seen_at: new Date().toISOString(),
    expires_at: "2026-10-04T18:00:00Z",
    absolute_expires_at: "2026-10-04T23:00:00Z",
  };
  const queries: Array<{ sql: string; args: unknown[] }> = [];
  const env = {
    ADMIN_ORIGIN: "https://admin.example.com",
    SESSION_IDLE_MINUTES: "45",
    SESSION_ABSOLUTE_HOURS: "8",
    IP_HASH_SECRET: "test",
    GITHUB_OWNER: "owner",
    PUBLIC_SITE_URL: "https://site.example.com",
    GITHUB_REPO: "repo",
    GITHUB_BRANCH: "main",
    GITHUB_TOKEN: "test",
    DB: {
      prepare: (sql: string) => ({
        bind(...args: unknown[]) {
          queries.push({ sql, args });
          return this;
        },
        first: async () => session,
        run: async () => ({ success: true }),
      }),
    },
  };
  const files = new Map<string, { text: string; sha: string }>([
    ["apps/site/src/data/site.json", { text: JSON.stringify(profile), sha }],
  ]);
  if (existing)
    files.set(path, {
      text: serializeContent("recipe", existing).content,
      sha,
    });
  const failures = new Map<string, number>();
  const graph: {
    response?: unknown;
    head: string;
    beforeCreate?: () => Promise<void>;
    createResponse?: unknown;
    throwCreate?: boolean;
  } = { head: initialHead };
  const mutations: Array<{
    expectedHeadOid: string;
    branch: { repositoryNameWithOwner: string; branchName: string };
    fileChanges: { additions: Array<{ path: string; contents: string }> };
  }> = [];
  const reads: string[] = [];
  const libraryRefs: string[] = [];
  const writes: Array<{
    method: string;
    path: string;
    payload: { content: string; sha?: string };
  }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "https://api.github.com/graphql") {
        expect(options?.method).toBe("POST");
        const operation = JSON.parse(String(options?.body));
        if (operation.query.includes("query RecipeHead")) {
          reads.push(url);
          expect(operation.variables).toEqual({
            owner: "owner",
            name: "repo",
            branch: "refs/heads/main",
          });
          return Response.json({
            data: {
              repository: {
                ref: { target: { __typename: "Commit", oid: graph.head } },
              },
            },
          });
        }
        if (operation.query.includes("mutation CreateRecipe")) {
          const input = operation.variables.input;
          mutations.push(input);
          await graph.beforeCreate?.();
          if (graph.throwCreate) throw new Error("Network response lost");
          if (graph.createResponse !== undefined)
            return Response.json(graph.createResponse);
          if (input.expectedHeadOid !== graph.head)
            return Response.json({
              errors: [
                {
                  message:
                    "Expected branch to point to expectedHeadOid, but it did not.",
                },
              ],
              data: { createCommitOnBranch: null },
            });
          const addition = input.fileChanges.additions[0];
          expect(input.branch).toEqual({
            repositoryNameWithOwner: "owner/repo",
            branchName: "main",
          });
          expect(input.fileChanges.additions).toHaveLength(1);
          writes.push({
            method: "GRAPHQL",
            path: addition.path,
            payload: { content: addition.contents },
          });
          graph.head = "c".repeat(40);
          return Response.json({
            data: {
              createCommitOnBranch: {
                commit: {
                  oid: graph.head,
                  url: "https://github.test/commit",
                  file: {
                    oid: "b".repeat(40),
                    path: addition.path,
                    type: "blob",
                  },
                },
              },
            },
          });
        }
        reads.push(url);
        const ref = operation.variables.recipes.split(":")[0];
        libraryRefs.push(ref);
        expect(["main", initialHead]).toContain(ref);
        expect(operation.variables).toEqual({
          owner: "owner",
          name: "repo",
          parent: `${ref}:apps/site/src/content`,
          recipes: `${ref}:${directory}`,
        });
        if (failures.has("graphql"))
          return new Response("Failed", { status: failures.get("graphql") });
        if (graph.response !== undefined) return Response.json(graph.response);
        const entries = [...files]
          .filter(([filePath]) => filePath.startsWith(`${directory}/`))
          .map(([filePath, file]) => ({
            name: filePath.slice(directory.length + 1),
            type: "blob",
            oid: file.sha,
            object: { __typename: "Blob", text: file.text, isTruncated: false },
          }));
        return Response.json({
          data: {
            repository: {
              parent: {
                __typename: "Tree",
                entries: entries.length
                  ? [{ name: "recipes" }]
                  : [{ name: "posts" }],
              },
              recipes: entries.length ? { __typename: "Tree", entries } : null,
            },
          },
        });
      }
      const requestedPath = new URL(url).pathname.split("/contents/")[1]!;
      if (options?.method === "PUT" || options?.method === "DELETE") {
        writes.push({
          method: options.method,
          path: requestedPath,
          payload: JSON.parse(String(options.body)),
        });
        return Response.json({
          content: { path: requestedPath, sha: "b".repeat(40) },
          commit: {
            sha: "c".repeat(40),
            html_url: "https://github.test/commit",
          },
        });
      }
      if (failures.has(requestedPath))
        return new Response("Failed", { status: failures.get(requestedPath) });
      reads.push(url);
      const file = files.get(requestedPath);
      return file
        ? Response.json({
            type: "file",
            path: requestedPath,
            sha: file.sha,
            encoding: "base64",
            content: Buffer.from(file.text).toString("base64"),
          })
        : new Response("Not found", { status: 404 });
    }),
  );
  const request = (
    url: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    worker.request(
      url,
      {
        method,
        headers: {
          Origin: env.ADMIN_ORIGIN,
          Cookie: "__Host-admin_session=test",
          "X-CSRF-Token": "csrf",
          "Content-Type": "application/json",
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      env,
    );
  return {
    request,
    writes,
    files,
    failures,
    queries,
    graph,
    reads,
    mutations,
    libraryRefs,
  };
}

describe("recipe publishing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T17:23:45Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("round-trips rich content, meal labels and optional metadata without YAML injection", () => {
    const input = {
      ...recipe,
      title: "Toast\nstatus: draft",
      servings: '2: people "hungry"',
      prepMinutes: undefined,
      body: `${recipe.body}<script>alert(1)</script><img src="/uploads/recipes/chickpea-toast/image.gif" alt="Toast" data-layout="left" onerror="alert(2)">`,
    };
    const serialized = serializeContent("recipe", input);
    expect(serialized.path).toBe(path);
    const parsed = parseManagedMarkdown(serialized.content);
    expect(
      recipeSchema.parse({ ...parsed.data, body: parsed.body }),
    ).toMatchObject({
      title: input.title,
      meals: recipe.meals,
      servings: input.servings,
      cookMinutes: 0,
      status: "published",
    });
    expect(parsed.data).not.toHaveProperty("prepMinutes");
    expect(parsed.body).toContain("<h2>Ingredients</h2>");
    expect(parsed.body).toContain('data-layout="left"');
    expect(parsed.body).toContain("image.gif");
    expect(parsed.body).not.toMatch(/script|onerror|alert/);
  });

  it("loads recipes for reopening and treats a verified missing collection as empty", async () => {
    const existing = await setup(recipe);
    const response = await existing.request("/api/published/recipes");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ content: recipe, path, sha }],
    });
    const empty = await setup();
    const emptyResponse = await empty.request("/api/published/recipes");
    expect(emptyResponse.status).toBe(200);
    expect(await emptyResponse.json()).toEqual({ items: [] });
  });

  it("round-trips explicit cover metadata without changing the recipe body", async () => {
    const input: Recipe = {
      ...recipe,
      coverImage: {
        src: "/uploads/recipes/chickpea-toast/cover.gif",
        alt: 'Toast with "crème fraîche" 🥘\nstatus: draft',
      },
    };
    const serialized = serializeContent("recipe", input);
    const parsed = parseManagedMarkdown(serialized.content);
    expect(recipeSchema.parse({ ...parsed.data, body: parsed.body })).toEqual(
      input,
    );
    expect(serialized.content).toContain(
      `coverImage: ${JSON.stringify(input.coverImage)}\n`,
    );
    expect(parsed.body).toBe(recipe.body);

    const mock = await setup(input);
    const response = await mock.request("/api/published/recipes");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ content: input, path, sha }],
    });
  });

  it("removes omitted cover metadata when republishing and keeps inline images", async () => {
    const input: Recipe = {
      ...recipe,
      body: `${recipe.body}<img src="/uploads/recipes/chickpea-toast/inline.gif" alt="Toast" data-layout="block" />`,
    };
    const mock = await setup({
      ...input,
      coverImage: {
        src: "/uploads/recipes/chickpea-toast/cover.gif",
        alt: "Gallery cover",
      },
    });
    const response = await mock.request("/api/publish", "POST", {
      contentType: "recipe",
      payload: input,
      targetPath: path,
      expectedSha: sha,
    });
    expect(response.status).toBe(200);
    expect(mock.writes).toHaveLength(1);
    const saved = parseManagedMarkdown(
      Buffer.from(mock.writes[0]!.payload.content, "base64").toString(),
    );
    expect(saved.data).not.toHaveProperty("coverImage");
    expect(saved.body).toBe(input.body);
  });

  it("rejects unsafe cover sources before publishing", async () => {
    const mock = await setup();
    const response = await mock.request("/api/publish", "POST", {
      contentType: "recipe",
      payload: {
        ...recipe,
        coverImage: { src: "/uploads/%2e%2e/private.jpg" },
      },
    });
    expect(response.status).toBe(400);
    expect(mock.writes).toHaveLength(0);
    expect(mock.mutations).toHaveLength(0);
  });

  it("does not hide repository access errors, partial responses or missing files as empty libraries", async () => {
    for (const status of [403, 500]) {
      const mock = await setup();
      mock.failures.set("graphql", status);
      expect((await mock.request("/api/published/recipes")).status).toBe(502);
    }
    const parent = { __typename: "Tree", entries: [{ name: "recipes" }] };
    for (const response of [
      {
        errors: [{ type: "FORBIDDEN" }],
        data: { repository: { parent, recipes: null } },
      },
      { data: { repository: null } },
      { data: { repository: { parent: null, recipes: null } } },
      { data: { repository: { parent, recipes: null } } },
      {
        data: {
          repository: {
            parent,
            recipes: { __typename: "Tree", entries: null },
          },
        },
      },
      {
        data: {
          repository: {
            parent,
            recipes: {
              __typename: "Tree",
              entries: [
                {
                  name: `${recipe.slug}.md`,
                  type: "blob",
                  oid: sha,
                  object: null,
                },
              ],
            },
          },
        },
      },
    ]) {
      const mock = await setup();
      mock.graph.response = response;
      expect((await mock.request("/api/published/recipes")).status).toBe(502);
    }
  });

  it("loads 200 UTF-8 recipes with real blob SHAs in one GitHub request", async () => {
    const mock = await setup();
    for (let index = 0; index < 200; index++) {
      const item = {
        ...recipe,
        id: crypto.randomUUID(),
        slug: `recipe-${index}`,
        title: `Crème brûlée 🥘 ${index}`,
        body: "<p>Crème, jalapeño and 日本語.</p>",
      };
      mock.files.set(`${directory}/${item.slug}.md`, {
        text: serializeContent("recipe", item).content,
        sha: index.toString(16).padStart(40, "0"),
      });
    }
    const response = await mock.request("/api/published/recipes");
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      items: Array<{ content: Recipe; sha: string }>;
    };
    expect(data.items).toHaveLength(200);
    expect(data.items[199]).toMatchObject({
      content: {
        title: "Crème brûlée 🥘 199",
        body: "<p>Crème, jalapeño and 日本語.</p>",
      },
      sha: "c7".padStart(40, "0"),
    });
    expect(mock.reads).toEqual(["https://api.github.com/graphql"]);
  });

  it("rejects truncated/binary blobs, invalid identities, and oversized recipe responses", async () => {
    const parent = { __typename: "Tree", entries: [{ name: "recipes" }] };
    const entry = {
      name: `${recipe.slug}.md`,
      type: "blob",
      oid: sha,
      object: {
        __typename: "Blob",
        text: serializeContent("recipe", recipe).content,
        isTruncated: false,
      },
    };
    for (const invalid of [
      { ...entry, object: { ...entry.object, isTruncated: true } },
      { ...entry, object: { ...entry.object, text: null } },
      { ...entry, name: "../posts/other.md" },
      { ...entry, name: "mismatched-slug.md" },
      { ...entry, oid: "wrong-sha" },
      {
        ...entry,
        object: { ...entry.object, text: "x".repeat(8 * 1024 * 1024) },
      },
    ]) {
      const mock = await setup();
      mock.graph.response = {
        data: {
          repository: {
            parent,
            recipes: { __typename: "Tree", entries: [invalid] },
          },
        },
      };
      expect((await mock.request("/api/published/recipes")).status).toBe(502);
      expect(mock.writes).toHaveLength(0);
    }
  });

  it("publishes a new recipe with server dates and a stable recipe URL", async () => {
    const mock = await setup();
    const unicodeBody = "<p>Crème, jalapeño and 日本語 🥘.</p>";
    const response = await mock.request("/api/publish", "POST", {
      contentType: "recipe",
      payload: {
        ...recipe,
        body: unicodeBody,
        status: "draft",
        publishedAt: "2026-01-01",
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      path,
      publicUrl: "https://site.example.com/recipes/chickpea-toast/",
      publishedAt: "2026-10-04T12:23:45-05:00",
      contentSha: "b".repeat(40),
      version: "c".repeat(40),
    });
    expect(mock.writes).toHaveLength(1);
    expect(mock.writes[0]!.path).toBe(path);
    const saved = parseManagedMarkdown(
      Buffer.from(mock.writes[0]!.payload.content, "base64").toString(),
    );
    expect(saved.data).toMatchObject({
      meals: recipe.meals,
      publishedAt: "2026-10-04T12:23:45-05:00",
      updatedAt: "2026-10-04T17:23:45.000Z",
      status: "published",
    });
    expect(saved.body).toBe(unicodeBody);
    expect(mock.mutations).toHaveLength(1);
    expect(mock.mutations[0]!.expectedHeadOid).toBe(initialHead);
    expect(mock.libraryRefs).toEqual([initialHead]);
    expect(mock.reads.filter((url) => url.includes("/contents/"))).toEqual([
      `https://api.github.com/repos/owner/repo/contents/apps/site/src/data/site.json?ref=${initialHead}`,
    ]);
  });

  it("rejects a retry under a changed slug when its recipe ID is already published", async () => {
    for (const payload of [recipe, { ...recipe, slug: "renamed-toast" }]) {
      const mock = await setup(recipe);
      const response = await mock.request("/api/publish", "POST", {
        contentType: "recipe",
        payload,
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error:
          "This recipe has already been published. Reopen it from Recipes before publishing changes.",
      });
      expect(mock.writes).toHaveLength(0);
      expect(mock.mutations).toHaveLength(0);
    }
    const collision = await setup(recipe);
    const response = await collision.request("/api/publish", "POST", {
      contentType: "recipe",
      payload: { ...recipe, id: crypto.randomUUID() },
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("already uses this URL"),
    });
    expect(collision.writes).toHaveLength(0);
  });

  it("rejects a concurrent same-ID creation at another slug using the immutable expected head", async () => {
    const mock = await setup();
    let arrivals = 0;
    let release!: () => void;
    const bothReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    mock.graph.beforeCreate = async () => {
      if (++arrivals === 2) release();
      await bothReady;
    };
    const responses = await Promise.all([
      mock.request("/api/publish", "POST", {
        contentType: "recipe",
        payload: recipe,
      }),
      mock.request("/api/publish", "POST", {
        contentType: "recipe",
        payload: { ...recipe, slug: "renamed-toast" },
      }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(mock.mutations).toHaveLength(2);
    expect(mock.libraryRefs).toEqual([initialHead, initialHead]);
    expect(
      mock.mutations.every(
        (mutation) => mutation.expectedHeadOid === initialHead,
      ),
    ).toBe(true);
    expect(mock.writes).toHaveLength(1);
    expect(
      await responses.find((response) => response.status === 409)!.json(),
    ).toMatchObject({ error: expect.stringContaining("Reload Recipes") });
  });

  it("does not retry creation after an intervening CMS commit, uncertain response or GraphQL failure", async () => {
    const changed = await setup();
    changed.graph.beforeCreate = async () => {
      changed.graph.head = "e".repeat(40);
    };
    expect(
      (
        await changed.request("/api/publish", "POST", {
          contentType: "recipe",
          payload: recipe,
        })
      ).status,
    ).toBe(409);
    expect(changed.graph.head).toBe("e".repeat(40));
    expect(changed.writes).toHaveLength(0);
    expect(changed.mutations).toHaveLength(1);
    for (const mode of ["network", "permission"] as const) {
      const mock = await setup();
      if (mode === "network") mock.graph.throwCreate = true;
      else
        mock.graph.createResponse = {
          errors: [{ type: "FORBIDDEN" }],
          data: { createCommitOnBranch: null },
        };
      expect(
        (
          await mock.request("/api/publish", "POST", {
            contentType: "recipe",
            payload: recipe,
          })
        ).status,
      ).toBe(409);
      expect(mock.writes).toHaveLength(0);
      expect(mock.mutations).toHaveLength(1);
    }
    const unreadable = await setup();
    unreadable.failures.set("graphql", 403);
    expect(
      (
        await unreadable.request("/api/publish", "POST", {
          contentType: "recipe",
          payload: recipe,
        })
      ).status,
    ).toBe(400);
    expect(unreadable.mutations).toHaveLength(0);
  });

  it("updates a reopened recipe by SHA and retains its first publication time", async () => {
    const mock = await setup(recipe);
    const response = await mock.request("/api/publish", "POST", {
      contentType: "recipe",
      payload: { ...recipe, title: "Better toast", publishedAt: "2026-01-01" },
      targetPath: path,
      expectedSha: sha,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      path,
      publishedAt: recipe.publishedAt,
    });
    expect(mock.writes[0]!.payload.sha).toBe(sha);
    const saved = parseManagedMarkdown(
      Buffer.from(mock.writes[0]!.payload.content, "base64").toString(),
    );
    expect(saved.data).toMatchObject({
      title: "Better toast",
      slug: recipe.slug,
      publishedAt: recipe.publishedAt,
    });
  });

  it("rejects duplicate destinations, stale updates, changed identities and cross-collection paths", async () => {
    const valid = {
      contentType: "recipe",
      payload: recipe,
      targetPath: path,
      expectedSha: sha,
    };
    for (const input of [
      { ...valid, expectedSha: "b".repeat(40) },
      { ...valid, expectedSha: undefined },
      { ...valid, targetPath: undefined },
      {
        ...valid,
        payload: { ...recipe, id: "3272e9b2-b958-4229-a631-adf22477aef3" },
      },
      { ...valid, payload: { ...recipe, slug: "renamed-toast" } },
      { ...valid, targetPath: "apps/site/src/content/posts/chickpea-toast.md" },
      {
        ...valid,
        targetPath: "apps/site/src/content/recipes/../posts/chickpea-toast.md",
      },
      { ...valid, payload: { ...recipe, meals: ["brunch"] } },
    ]) {
      const mock = await setup(recipe);
      expect((await mock.request("/api/publish", "POST", input)).status).toBe(
        400,
      );
      expect(mock.writes).toHaveLength(0);
    }
  });

  it("checks recipes deletion identity/SHA, removes the matching draft, and tracks its deployment", async () => {
    const mock = await setup(recipe);
    const response = await mock.request("/api/published/recipes", "DELETE", {
      path,
      expectedSha: sha,
      contentKey: recipe.id,
      title: recipe.title,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      version: "c".repeat(40),
      publicUrl: "https://site.example.com/recipes/",
    });
    expect(mock.writes).toHaveLength(1);
    expect(mock.writes[0]).toMatchObject({
      method: "DELETE",
      path,
      payload: { sha },
    });
    expect(mock.queries).toContainEqual({
      sql: "DELETE FROM drafts WHERE content_type=? AND content_key=?",
      args: ["recipe", recipe.id],
    });
  });

  it("rejects unsafe/stale deletion and protects all recipe operations with the session and CSRF", async () => {
    const input = {
      path,
      expectedSha: sha,
      contentKey: recipe.id,
      title: recipe.title,
    };
    for (const invalid of [
      { ...input, expectedSha: "b".repeat(40) },
      { ...input, contentKey: "wrong-id" },
      { ...input, path: "apps/site/src/content/posts/other.md" },
    ]) {
      const mock = await setup(recipe);
      expect(
        (await mock.request("/api/published/recipes", "DELETE", invalid))
          .status,
      ).toBe(400);
      expect(mock.writes).toHaveLength(0);
    }
    const mock = await setup(recipe);
    expect(
      (
        await mock.request("/api/published/recipes", "GET", undefined, {
          Cookie: "",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await mock.request("/api/published/recipes", "DELETE", input, {
          "X-CSRF-Token": "wrong",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await mock.request(
          "/api/publish",
          "POST",
          { contentType: "recipe", payload: recipe },
          { Origin: "https://evil.test" },
        )
      ).status,
    ).toBe(403);
    expect(mock.writes).toHaveLength(0);
  });
});

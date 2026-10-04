import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import worker from "./index";

const databases: DatabaseSync[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

async function setup(migrateRecipes = true) {
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  database.exec(
    readFileSync(
      new URL("../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  if (migrateRecipes)
    database.exec(
      readFileSync(
        new URL("../migrations/0002_recipe_drafts.sql", import.meta.url),
        "utf8",
      ),
    );
  const hash = async (value: string) =>
    Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ).toString("base64");
  const now = new Date().toISOString();
  database
    .prepare(
      "INSERT INTO sessions (id,token_hash,csrf_hash,created_at,last_seen_at,expires_at,absolute_expires_at) VALUES (?,?,?,?,?,?,?)",
    )
    .run(
      "test-session",
      await hash("test-session-token"),
      await hash("test-csrf"),
      now,
      now,
      new Date(Date.now() + 60 * 60_000).toISOString(),
      new Date(Date.now() + 8 * 60 * 60_000).toISOString(),
    );
  const env = {
    ADMIN_ORIGIN: "https://admin.example.com",
    SESSION_IDLE_MINUTES: "45",
    IP_HASH_SECRET: "test-only-secret",
    DB: {
      prepare: (sql: string) => {
        let values: SQLInputValue[] = [];
        return {
          bind(...args: SQLInputValue[]) {
            values = args;
            return this;
          },
          first: async () => database.prepare(sql).get(...values) ?? null,
          all: async () => ({
            results: database.prepare(sql).all(...values),
            success: true,
          }),
          run: async () => ({
            ...database.prepare(sql).run(...values),
            success: true,
          }),
        };
      },
    },
  };
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    csrf = "test-csrf",
  ) =>
    worker.request(
      path,
      {
        method,
        headers: {
          Origin: env.ADMIN_ORIGIN,
          Cookie: "__Host-admin_session=test-session-token",
          "X-CSRF-Token": csrf,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      env,
    );
  return { database, request };
}

const contentKey = "5b97816c-d557-4006-ad37-cc3dffb541ef";
const recipe = {
  id: contentKey,
  title: "Sample BBQ Baked Potato",
  slug: "sample-bbq-baked-potato",
  meals: ["dinner"],
  prepMinutes: 80,
  cookMinutes: 20,
  servings: "4",
  body: "<h2>Ingredients</h2><ul><li>4 baking potatoes</li><li>BBQ sauce</li></ul><h2>Directions</h2><p>Bake until tender, then add toppings.</p>",
};
const draft = (payload: unknown = recipe) => ({
  id: crypto.randomUUID(),
  contentType: "recipe",
  contentKey,
  payload,
});

describe("draft API with the migrated SQLite schema", () => {
  it("saves, updates, lists and reopens a rich recipe with its exact content", async () => {
    const { request, database } = await setup();
    const initial = draft();
    expect((await request("/api/drafts", "PUT", initial)).status).toBe(200);
    const next = { ...recipe, body: `${recipe.body}<p>Crème fraîche 🥔.</p>` };
    expect((await request("/api/drafts", "PUT", draft(next))).status).toBe(200);
    const rows = database
      .prepare("SELECT id,content_type,content_key,payload_json FROM drafts")
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: initial.id,
      content_type: "recipe",
      content_key: contentKey,
    });
    expect(JSON.parse(String(rows[0]!.payload_json))).toEqual(next);
    const reopened = await request(`/api/drafts/recipe/${contentKey}`);
    expect(reopened.status).toBe(200);
    expect(await reopened.json()).toEqual({ draft: next });
    expect((await request("/api/drafts")).status).toBe(200);
  });

  it("permits unfinished metadata and rejects oversized payloads without changing the saved draft", async () => {
    const { request, database } = await setup();
    expect(
      (await request("/api/drafts", "PUT", draft({ meals: [], title: "" })))
        .status,
    ).toBe(200);
    const oversized = await request(
      "/api/drafts",
      "PUT",
      draft({ ...recipe, body: "x".repeat(500_001) }),
    );
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toEqual({ error: "Draft is too large." });
    expect(
      JSON.parse(
        String(
          database.prepare("SELECT payload_json FROM drafts").get()!
            .payload_json,
        ),
      ),
    ).toEqual({ meals: [], title: "" });
  });

  it("distinguishes an unapplied recipe migration from a stale CSRF token", async () => {
    const oldSchema = await setup(false);
    expect(
      (await oldSchema.request("/api/drafts", "PUT", draft())).status,
    ).toBe(500);
    expect(
      oldSchema.database.prepare("SELECT count(*) AS total FROM drafts").get()!
        .total,
    ).toBe(0);
    const migrated = await setup();
    const stale = await migrated.request(
      "/api/drafts",
      "PUT",
      draft(),
      "stale-csrf",
    );
    expect(stale.status).toBe(403);
    expect(await stale.json()).toEqual({
      error: "Security token expired. Sign in again to continue.",
      code: "csrf_expired",
    });
    expect(
      migrated.database.prepare("SELECT count(*) AS total FROM drafts").get()!
        .total,
    ).toBe(0);
  });

  it("rejects both idle-expired and absolute-expired sessions before storing a draft", async () => {
    for (const expiredField of ["expires_at", "absolute_expires_at"] as const) {
      const { request, database } = await setup();
      database
        .prepare(`UPDATE sessions SET ${expiredField}=?`)
        .run(new Date(Date.now() - 1_000).toISOString());
      const response = await request("/api/drafts", "PUT", draft());
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "Your session has expired. Sign in again.",
      });
      expect(
        database.prepare("SELECT count(*) AS total FROM drafts").get()!.total,
      ).toBe(0);
      expect(
        database.prepare("SELECT count(*) AS total FROM sessions").get()!.total,
      ).toBe(0);
      expect(
        database.prepare("SELECT event_type FROM security_events").get()!
          .event_type,
      ).toBe("expired_session");
    }
  });
});

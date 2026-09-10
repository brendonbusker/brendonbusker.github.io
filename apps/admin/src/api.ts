import { publishing } from "./publishing";
export type Session = {
  authenticated: boolean;
  csrfToken?: string;
  expiresAt?: string;
};
let csrfToken = "";
export function setCsrf(value?: string) {
  csrfToken = value || "";
}
export async function api<T>(path: string, options: RequestInit = {}) {
  const tracksPublish =
    (options.method === "POST" && path.startsWith("/api/publish")) ||
    (options.method === "DELETE" && path === "/api/published/posts");
  const id = tracksPublish ? crypto.randomUUID() : null;
  if (id)
    publishing.set({
      id,
      state: "publishing",
      message: "Sending your changes to GitHub…",
    });
  try {
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    if (options.method && options.method !== "GET")
      headers.set("X-CSRF-Token", csrfToken);
    const response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
    });
    const data = (await response.json().catch(() => ({
      error: "The server returned an unreadable response.",
    }))) as Record<string, unknown>;
    if (!response.ok)
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : `Request failed (${response.status})`,
      );
    if (id) {
      if (
        typeof data.version === "string" &&
        /^[a-f0-9]{40}$/i.test(data.version) &&
        typeof data.publicUrl === "string"
      )
        publishing.update(id, {
          version: data.version,
          publicUrl: data.publicUrl,
          state: "waiting",
          message: "Changes saved. Waiting for the website build…",
        });
      else
        publishing.update(id, {
          state: "unavailable",
          message:
            "Changes saved, but deployment tracking is unavailable for this publication.",
        });
    }
    return data as T;
  } catch (error) {
    if (id)
      publishing.update(id, {
        state: "failed",
        message:
          "Publication could not be confirmed. Review the editor message and reload the published content before trying again.",
      });
    throw error;
  }
}
export type PublishedItem<T> = { content: T; path: string; sha: string };
export type PublishOptions = { expectedSha?: string; targetPath?: string };
export const draftsApi = {
  list: () =>
    api<{
      drafts: Array<{
        id: string;
        content_type: string;
        content_key: string;
        updated_at: string;
        payload_json: string;
      }>;
    }>("/api/drafts"),
  get: <T>(type: string, key: string) =>
    api<{ draft: T | null }>(`/api/drafts/${type}/${encodeURIComponent(key)}`),
  save: (body: unknown) =>
    api<{ savedAt: string }>("/api/drafts", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (type: string, key: string) =>
    api("/api/drafts/" + type + "/" + encodeURIComponent(key), {
      method: "DELETE",
    }),
  publish: (
    contentType: string,
    payload: unknown,
    options: PublishOptions = {},
  ) =>
    api<{
      commitUrl: string;
      version: string;
      contentSha: string;
      path: string;
      publishedAt?: string;
    }>("/api/publish", {
      method: "POST",
      body: JSON.stringify({ contentType, payload, ...options }),
    }),
};
export const publishedApi = {
  one: <T>(
    type: "homepage" | "resume" | "appearance" | "projects-page" | "blog-page",
  ) => api<PublishedItem<T>>(`/api/published/${type}`),
  collection: <T>(type: "posts" | "projects") =>
    api<{ items: Array<PublishedItem<T>> }>(`/api/published/${type}`),
  removePost: (input: {
    path: string;
    expectedSha: string;
    contentKey: string;
    title: string;
  }) =>
    api<{ commitUrl: string; version: string }>("/api/published/posts", {
      method: "DELETE",
      body: JSON.stringify(input),
    }),
};

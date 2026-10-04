import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

test("expired requests coalesce authentication recovery and writes resume only explicitly with the new token", async () => {
  const { api, setCsrf, subscribeAuthentication } = await import("./api");
  const replies: Array<(response: Response) => void> = [];
  const fetch = vi.fn(
    (_path: string, _options?: RequestInit) =>
      new Promise<Response>((resolve) => replies.push(resolve)),
  );
  vi.stubGlobal("fetch", fetch);
  setCsrf("old-test-token");
  const events: boolean[] = [];
  const stop = subscribeAuthentication((required) => events.push(required));
  const requests = Promise.allSettled([
    api("/api/drafts", { method: "PUT", body: "{}" }),
    api("/api/dashboard"),
  ]);
  for (const reply of replies)
    reply(
      Response.json(
        { error: "Your session has expired. Sign in again." },
        { status: 401 },
      ),
    );
  expect((await requests).every((result) => result.status === "rejected")).toBe(
    true,
  );
  expect(events).toEqual([false, true]);
  await expect(
    api("/api/drafts", { method: "PUT", body: "{}" }),
  ).rejects.toThrow("Sign in again");
  expect(fetch).toHaveBeenCalledTimes(2);
  setCsrf("new-test-token");
  expect(events).toEqual([false, true, false]);
  expect(fetch).toHaveBeenCalledTimes(2);
  fetch.mockImplementationOnce(async () => Response.json({ savedAt: "now" }));
  await api("/api/drafts", { method: "PUT", body: "{}" });
  expect(
    new Headers(fetch.mock.calls[2]?.[1]?.headers).get("X-CSRF-Token"),
  ).toBe("new-test-token");
  stop();
});

test("a late 401 from the previous session cannot reopen recovery after successful sign-in", async () => {
  const { api, setCsrf, subscribeAuthentication } = await import("./api");
  let reply!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          reply = resolve;
        }),
    ),
  );
  setCsrf("old-test-token");
  const events: boolean[] = [];
  const stop = subscribeAuthentication((required) => events.push(required));
  const request = api("/api/dashboard");
  setCsrf("new-test-token");
  reply(
    Response.json(
      { error: "Your session has expired. Sign in again." },
      { status: 401 },
    ),
  );
  await expect(request).rejects.toThrow("expired");
  expect(events).toEqual([false]);
  stop();
});

test("only expired CSRF errors trigger recovery, while wrong passwords and rejected origins retain their errors", async () => {
  const { api, setCsrf, subscribeAuthentication } = await import("./api");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  setCsrf("test-token");
  const events: boolean[] = [];
  const stop = subscribeAuthentication((required) => events.push(required));
  fetch.mockResolvedValueOnce(
    Response.json({ error: "Invalid username or password." }, { status: 401 }),
  );
  await expect(api("/api/auth/login", { method: "POST" })).rejects.toThrow(
    "Invalid username",
  );
  fetch.mockResolvedValueOnce(
    Response.json({ error: "Request rejected." }, { status: 403 }),
  );
  await expect(api("/api/drafts", { method: "PUT" })).rejects.toThrow(
    "Request rejected",
  );
  expect(events).toEqual([false]);
  fetch.mockResolvedValueOnce(
    Response.json(
      {
        error: "Security token expired. Refresh and try again.",
        code: "csrf_expired",
      },
      { status: 403 },
    ),
  );
  await expect(api("/api/drafts", { method: "PUT" })).rejects.toThrow(
    "Sign in again",
  );
  expect(events).toEqual([false, true]);
  stop();
});

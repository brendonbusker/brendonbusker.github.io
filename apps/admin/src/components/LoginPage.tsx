import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Spinner } from "@fluentui/react-components";
import { LockClosed24Regular } from "@fluentui/react-icons";
import { api, setCsrf, type Session } from "../api";
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
    };
  }
}
export function LoginPage({
  onLogin,
}: {
  onLogin: (session: Session) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [siteKey, setSiteKey] = useState("");
  const [challengeReady, setChallengeReady] = useState(false);
  const token = useRef("");
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef("");
  useEffect(() => {
    api<{ turnstileSiteKey: string }>("/api/config").then((c) =>
      setSiteKey(c.turnstileSiteKey),
    );
  }, []);
  useEffect(() => {
    if (!siteKey || !widget.current) return;
    const render = () => {
      if (window.turnstile && widget.current)
        widgetId.current = window.turnstile.render(widget.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (value: string) => {
            token.current = value;
            setChallengeReady(true);
          },
          "expired-callback": () => {
            token.current = "";
            setChallengeReady(false);
          },
          "error-callback": () => {
            token.current = "";
            setChallengeReady(false);
            setError(
              "The security check could not load. Refresh and try again.",
            );
          },
        });
    };
    if (window.turnstile) render();
    else {
      const script = window.document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = render;
      script.onerror = () =>
        setError("The security check could not load. Refresh and try again.");
      window.document.head.appendChild(script);
    }
  }, [siteKey]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.current) {
      setError("Complete the security check before signing in.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = await api<Session>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          turnstileToken: token.current,
        }),
      });
      setCsrf(session.csrfToken);
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
      token.current = "";
      setChallengeReady(false);
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark">
          <LockClosed24Regular />
        </div>
        <p className="product-name">Brendon Busker Publishing</p>
        <h1>Sign in to edit the site</h1>
        <p className="login-copy">
          Your publishing workspace is private. Use the administrator
          credentials created during setup.
        </p>
        <Field label="Username" required>
          <Input
            autoComplete="username"
            value={username}
            onChange={(_, d) => setUsername(d.value)}
            autoFocus
          />
        </Field>
        <Field label="Password" required>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(_, d) => setPassword(d.value)}
          />
        </Field>
        <div ref={widget} className="turnstile" />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button
          appearance="primary"
          type="submit"
          disabled={busy || !challengeReady}
        >
          {busy ? (
            <>
              <Spinner size="tiny" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </main>
  );
}

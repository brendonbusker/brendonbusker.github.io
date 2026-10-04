import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Spinner } from "@fluentui/react-components";
import { LockClosed24Regular } from "@fluentui/react-icons";
import { api, setCsrf, type Session } from "../api";
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove?: (id: string) => void;
    };
  }
}
export function LoginPage({
  onLogin,
  recovery = false,
  onCancel,
  onBusyChange,
}: {
  onLogin: (session: Session) => void;
  recovery?: boolean;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [siteKey, setSiteKey] = useState("");
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  const [challengeReady, setChallengeReady] = useState(false);
  const token = useRef("");
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef("");
  useEffect(() => {
    let alive = true;
    api<{ turnstileSiteKey: string }>("/api/config")
      .then((c) => {
        if (alive) setSiteKey(c.turnstileSiteKey);
      })
      .catch(() => {
        if (alive)
          setError(
            "The security check could not load. Retry the security check below.",
          );
      });
    return () => {
      alive = false;
    };
  }, [challengeAttempt]);
  useEffect(() => {
    if (!siteKey || !widget.current) return;
    let alive = true;
    const render = () => {
      if (alive && window.turnstile && widget.current)
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
              "The security check could not load. Retry the security check below.",
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
        setError(
          "The security check could not load. Retry the security check below.",
        );
      window.document.head.appendChild(script);
    }
    return () => {
      alive = false;
      if (widgetId.current) window.turnstile?.remove?.(widgetId.current);
      widgetId.current = "";
      token.current = "";
    };
  }, [siteKey, challengeAttempt]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.current) {
      setError("Complete the security check before signing in.");
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
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
      if (
        session.authenticated !== true ||
        typeof session.csrfToken !== "string" ||
        !session.csrfToken.trim()
      )
        throw new Error(
          "Sign-in could not be confirmed. Your open document has been kept. Please try again.",
        );
      setCsrf(session.csrfToken);
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
      token.current = "";
      setChallengeReady(false);
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };
  return (
    <main className={`login-page${recovery ? " login-recovery" : ""}`}>
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark">
          <LockClosed24Regular />
        </div>
        <p className="product-name">Brendon Busker Publishing</p>
        <h1>
          {recovery
            ? "Sign in again to save your work"
            : "Sign in to edit the site"}
        </h1>
        <p className="login-copy">
          {recovery
            ? "Your sign-in or security token expired. Your document and unsaved edits are still open behind this window. After signing in, retry saving or publishing when you are ready."
            : "Your publishing workspace is private. Use the administrator credentials created during setup."}
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
        {error.includes("security check could not load") && (
          <Button
            type="button"
            onClick={() => {
              setError("");
              setChallengeReady(false);
              setChallengeAttempt((attempt) => attempt + 1);
            }}
          >
            Retry security check
          </Button>
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
        {onCancel && (
          <Button type="button" disabled={busy} onClick={onCancel}>
            Return to editor
          </Button>
        )}
      </form>
    </main>
  );
}

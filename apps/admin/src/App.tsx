import { lazy, Suspense, useEffect, useState } from "react";
import { FluentProvider, Spinner } from "@fluentui/react-components";
import { api, setCsrf, type Session } from "./api";
import { LoginPage } from "./components/LoginPage";
import { AdminShell } from "./components/AdminShell";
import { Dashboard } from "./components/Dashboard";
import {
  applyAdminTheme,
  getAdminTheme,
  readStoredAdminTheme,
  type AdminThemeId,
} from "./themes";
const PostEditor = lazy(() =>
  import("./components/PostEditor").then((module) => ({
    default: module.PostEditor,
  })),
);
const ProjectEditor = lazy(() =>
  import("./components/ProjectEditor").then((module) => ({
    default: module.ProjectEditor,
  })),
);
const ResumeEditor = lazy(() =>
  import("./components/ResumeEditor").then((module) => ({
    default: module.ResumeEditor,
  })),
);
const SiteEditor = lazy(() =>
  import("./components/SiteEditor").then((module) => ({
    default: module.SiteEditor,
  })),
);
const Settings = lazy(() =>
  import("./components/Settings").then((module) => ({
    default: module.Settings,
  })),
);
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [page, setPage] = useState("home");
  const [themeId, setThemeId] = useState<AdminThemeId>(readStoredAdminTheme);
  const theme = getAdminTheme(themeId);
  useEffect(() => applyAdminTheme(theme), [theme]);
  useEffect(() => {
    api<Session>("/api/session")
      .then((s) => {
        setCsrf(s.csrfToken);
        setSession(s);
      })
      .catch(() => setSession({ authenticated: false }));
  }, []);
  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setCsrf();
      setSession({ authenticated: false });
    }
  };
  let content;
  if (!session)
    content = (
      <div className="app-loading">
        <Spinner label="Opening publishing workspace…" />
      </div>
    );
  else if (!session.authenticated) content = <LoginPage onLogin={setSession} />;
  else
    content = (
      <AdminShell page={page} setPage={setPage} onLogout={logout}>
        <Suspense
          fallback={
            <div className="app-loading">
              <Spinner label="Opening editor…" />
            </div>
          }
        >
          {page === "home" ? (
            <Dashboard go={setPage} />
          ) : page === "posts" ? (
            <PostEditor />
          ) : page === "projects" ? (
            <ProjectEditor />
          ) : page === "resume" ? (
            <ResumeEditor />
          ) : page === "site" ? (
            <SiteEditor />
          ) : (
            <Settings themeId={themeId} onThemeChange={setThemeId} />
          )}
        </Suspense>
      </AdminShell>
    );
  return <FluentProvider theme={theme.fluent}>{content}</FluentProvider>;
}

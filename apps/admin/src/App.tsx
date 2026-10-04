import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FluentProvider, Spinner } from "@fluentui/react-components";
import { api, setCsrf, type Session } from "./api";
import { LoginPage } from "./components/LoginPage";
import { AdminShell } from "./components/AdminShell";
import { Dashboard } from "./components/Dashboard";
import { PublishingStatus } from "./components/PublishingStatus";
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
  const beforeLeave = useRef<(() => Promise<boolean>) | null>(null);
  const navigating = useRef(false);
  const registerBeforeLeave = useCallback(
    (guard: (() => Promise<boolean>) | null) => {
      beforeLeave.current = guard;
    },
    [],
  );
  const navigate = async (next: string) => {
    if (next === page || navigating.current) return;
    navigating.current = true;
    try {
      if (beforeLeave.current && !(await beforeLeave.current())) return;
      setPage(next);
    } finally {
      navigating.current = false;
    }
  };
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
    if (navigating.current) return;
    navigating.current = true;
    if (beforeLeave.current && !(await beforeLeave.current())) {
      navigating.current = false;
      return;
    }
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setCsrf();
      setSession({ authenticated: false });
      navigating.current = false;
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
      <AdminShell
        page={page}
        setPage={(next) => void navigate(next)}
        onLogout={logout}
      >
        <PublishingStatus />
        <Suspense
          fallback={
            <div className="app-loading">
              <Spinner label="Opening editor…" />
            </div>
          }
        >
          {page === "home" ? (
            <Dashboard go={(next) => void navigate(next)} />
          ) : page === "posts" ? (
            <PostEditor key="posts" registerBeforeLeave={registerBeforeLeave} />
          ) : page === "recipes" ? (
            <PostEditor
              key="recipes"
              kind="recipe"
              registerBeforeLeave={registerBeforeLeave}
            />
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

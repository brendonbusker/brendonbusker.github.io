import { useEffect, useState } from "react";
import { Button } from "@fluentui/react-components";
import { publishingTimezone } from "@brendon/shared";
import { api } from "../api";
import {
  Add24Regular,
  WindowEditRegular,
  AppsAddIn24Regular,
  PersonEdit24Regular,
} from "@fluentui/react-icons";
type SiteDetails = {
  fullName: string;
  timezone: string;
  latestPost: { title: string } | null;
  projectCount: number;
  webUpdatedAt: string | null;
  pdfUpdatedAt: string | null;
};

export function Dashboard({ go }: { go: (p: string) => void }) {
  const [details, setDetails] = useState<SiteDetails | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const controller = new AbortController();
    setDetails(null);
    setError("");
    api<SiteDetails>("/api/dashboard", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setDetails(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Could not load current site details.");
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60000);
    const refresh = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
        setAttempt((value) => value + 1);
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  let timezone: string | undefined;
  try {
    if (details?.timezone) timezone = publishingTimezone(details.timezone);
  } catch {
    // A display-only timezone label can fall back to the browser's local zone.
  }
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = details?.fullName?.trim().split(/\s+/)[0];
  const unavailable = error ? "Unavailable" : "Loading…";
  const updated = (value: string | null | undefined) => {
    if (!value) return "No publication found";
    return `Updated ${new Date(value).toLocaleDateString("en-US", {
      timeZone: timezone,
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;
  };
  return (
    <div className="workspace-page dashboard">
      <header>
        <p className="page-label">
          {now.toLocaleDateString("en-US", {
            timeZone: timezone,
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1>
          {greeting}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p>Pick up where you left off or start something new.</p>
      </header>
      <section>
        <h2>Quick actions</h2>
        <div className="quick-actions">
          <Button icon={<Add24Regular />} onClick={() => go("posts")}>
            New post
          </Button>
          <Button icon={<WindowEditRegular />} onClick={() => go("site")}>
            Edit homepage
          </Button>
          <Button icon={<AppsAddIn24Regular />} onClick={() => go("projects")}>
            Add project
          </Button>
          <Button icon={<PersonEdit24Regular />} onClick={() => go("resume")}>
            Edit résumé
          </Button>
        </div>
      </section>
      <section className="dashboard-columns">
        <div>
          <h2>Current site</h2>
          {error && (
            <div role="status">
              {error}{" "}
              <Button onClick={() => setAttempt((value) => value + 1)}>
                Retry
              </Button>
            </div>
          )}
          <dl>
            <div>
              <dt>Latest post</dt>
              <dd>
                {details
                  ? details.latestPost?.title || "No published posts"
                  : unavailable}
              </dd>
            </div>
            <div>
              <dt>Projects</dt>
              <dd>
                {details ? `${details.projectCount} published` : unavailable}
              </dd>
            </div>
            <div>
              <dt>Web résumé</dt>
              <dd>{details ? updated(details.webUpdatedAt) : unavailable}</dd>
            </div>
            <div>
              <dt>Résumé PDF</dt>
              <dd>{details ? updated(details.pdfUpdatedAt) : unavailable}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h2>Publishing</h2>
          <p>
            After you publish, the status banner follows your changes from
            GitHub to the live website. You can switch sections while it builds.
            Drafts stay private until you publish.
          </p>
        </div>
      </section>
    </div>
  );
}

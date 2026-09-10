import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, Spinner } from "@fluentui/react-components";
import { api, ApiError } from "../api";
import { publishing, type Publication } from "../publishing";

const labels = {
  publishing: "Publishing",
  waiting: "Waiting for build",
  building: "Building",
  retrying: "Rechecking status",
  live: "Live",
  failed: "Needs attention",
  cancelled: "Build cancelled",
  unavailable: "Status unavailable",
};
export function PublishingStatus() {
  const job = useSyncExternalStore(publishing.subscribe, publishing.get);
  const [retry, setRetry] = useState(0);
  const id = job?.id;
  const version = job?.version;
  useEffect(() => {
    if (!id || !version) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let failures = 0;
    const retryDelays = [5000, 15000, 30000];
    const started = Date.now();
    const check = async () => {
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20000);
      try {
        const result = await api<
          Pick<Publication, "state" | "message" | "detailsUrl">
        >(`/api/deployment/${version}`, { signal: controller.signal });
        if (!active) return;
        if (!result.state || !result.message)
          throw new Error(
            "Cannot check deployment right now. Try checking again shortly.",
          );
        publishing.update(id, result);
        failures = 0;
        if (result.state === "live" || result.state === "failed") return;
        if (Date.now() - started >= 10 * 60 * 1000) {
          publishing.update(id, {
            state: "unavailable",
            message:
              "This is taking longer than usual. Your changes are saved. Open build details or check again.",
          });
          return;
        }
        timer = setTimeout(() => {
          void check();
        }, 30000);
      } catch (error) {
        if (!active) return;
        const permanent =
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500 &&
          ![408, 429].includes(error.status);
        const delay = retryDelays[failures++];
        if (
          !permanent &&
          delay !== undefined &&
          Date.now() - started < 10 * 60 * 1000
        ) {
          publishing.update(id, {
            state: "retrying",
            message:
              "Your changes are saved. The status check was interrupted; trying again automatically…",
          });
          timer = setTimeout(() => {
            void check();
          }, delay);
        } else {
          publishing.update(id, {
            state: "unavailable",
            message: permanent
              ? error.message
              : "Your changes are saved, but we still cannot check whether they are live. Try checking again shortly.",
          });
        }
      } finally {
        clearTimeout(timeout);
      }
    };
    void check();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [id, version, retry]);
  if (!job) return null;
  const busy = ["publishing", "waiting", "building", "retrying"].includes(
    job.state,
  );
  return (
    <section className="publishing-banner" aria-label="Publication status">
      <div className="publishing-summary" aria-live="polite">
        {busy && <Spinner size="tiny" />}
        <div>
          <strong>{labels[job.state]}</strong>
          <p>{job.message}</p>
        </div>
      </div>
      <div className="publishing-actions">
        {job.state === "live" && job.publicUrl && (
          <a href={job.publicUrl} target="_blank" rel="noreferrer">
            View published page ↗
          </a>
        )}
        {job.detailsUrl && (
          <a href={job.detailsUrl} target="_blank" rel="noreferrer">
            Build details ↗
          </a>
        )}
        {!busy && job.version && job.state !== "live" && (
          <Button
            onClick={() => {
              publishing.update(job.id, {
                state: "retrying",
                message: "Checking your publication…",
              });
              setRetry((value) => value + 1);
            }}
          >
            Check again
          </Button>
        )}
        {!busy && (
          <Button appearance="subtle" onClick={() => publishing.set(null)}>
            Dismiss
          </Button>
        )}
      </div>
    </section>
  );
}

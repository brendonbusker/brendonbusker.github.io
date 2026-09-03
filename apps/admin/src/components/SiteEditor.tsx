import { useEffect, useState } from "react";
import { Button, Field, Input, Textarea } from "@fluentui/react-components";
import { Eye20Regular, Send20Regular } from "@fluentui/react-icons";
import { siteProfileSchema, type SiteProfile } from "@brendon/shared";
import { publishedSite as seedSite } from "../published-seed";
import { useDraft } from "../hooks";
import { draftsApi, publishedApi, type PublishedItem } from "../api";
import { SaveStatus } from "./SaveStatus";
export function SiteEditor() {
  const [published, setPublished] = useState<PublishedItem<SiteProfile>>({
    content: seedSite,
    path: "apps/site/src/data/site.json",
    sha: "",
  });
  const [syncing, setSyncing] = useState(true);
  const { value, setValue, state, reset, loading } = useDraft<SiteProfile>(
    "homepage",
    "main",
    published.content,
    published.sha,
  );
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    publishedApi
      .one<SiteProfile>("homepage")
      .then((item) => {
        if (alive) setPublished(item);
      })
      .catch((error) => {
        if (alive)
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load the published homepage.",
          );
      })
      .finally(() => {
        if (alive) setSyncing(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  const set = (key: keyof SiteProfile, v: unknown) =>
    setValue((p) => ({ ...p, [key]: v }));
  const publish = async () => {
    try {
      const valid = siteProfileSchema.parse(value);
      const result = await draftsApi.publish("homepage", valid, {
        expectedSha: published.sha || undefined,
      });
      await draftsApi.remove("homepage", "main");
      setPublished({
        content: valid,
        path: result.path,
        sha: result.contentSha,
      });
      reset(valid);
      setMessage("Published to GitHub. Site deployment is in progress.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not publish.");
    }
  };
  return (
    <div className="workspace-page form-page">
      <header className="command-header">
        <div>
          <p className="page-label">Site</p>
          <h1>Homepage introduction</h1>
          <SaveStatus state={state} />
          <p className="source-status">
            {syncing || loading
              ? "Loading current content from GitHub…"
              : "Current published content loaded from GitHub"}
          </p>
        </div>
        <div>
          <Button icon={<Eye20Regular />} onClick={() => setPreview(!preview)}>
            {preview ? "Edit" : "Preview"}
          </Button>
          <Button
            appearance="primary"
            icon={<Send20Regular />}
            onClick={publish}
            disabled={syncing || loading}
          >
            Publish
          </Button>
        </div>
      </header>
      {preview ? (
        <div className="homepage-preview">
          <p>
            {value.location} · {value.timezone}
          </p>
          <h2>{value.fullName}</h2>
          <h3>{value.professionalHeadline}</h3>
          <div>
            <p>{value.intro}</p>
            <p>{value.secondaryIntro}</p>
          </div>
        </div>
      ) : (
        <section className="single-form">
          <Field label="Full name" required>
            <Input
              value={value.fullName}
              onChange={(_, d) => set("fullName", d.value)}
            />
          </Field>
          <Field label="Professional headline" required>
            <Textarea
              value={value.professionalHeadline}
              onChange={(_, d) => set("professionalHeadline", d.value)}
            />
          </Field>
          <Field label="Introduction" required>
            <Textarea
              rows={5}
              value={value.intro}
              onChange={(_, d) => set("intro", d.value)}
            />
          </Field>
          <Field label="Secondary introduction">
            <Textarea
              rows={4}
              value={value.secondaryIntro}
              onChange={(_, d) => set("secondaryIntro", d.value)}
            />
          </Field>
          <div className="two-fields">
            <Field
              label="Site title"
              hint="Used in the browser tab and as the default title in link previews."
            >
              <Input
                value={value.siteTitle}
                onChange={(_, d) => set("siteTitle", d.value)}
              />
            </Field>
            <Field
              label="Timezone label"
              hint='Shown on the homepage. Examples: "CST" or "America/Chicago".'
            >
              <Input
                value={value.timezone}
                onChange={(_, d) => set("timezone", d.value)}
              />
            </Field>
          </div>
          <Field
            label="Location"
            hint="Shown beside the timezone on the homepage."
          >
            <Input
              value={value.location}
              onChange={(_, d) => set("location", d.value)}
            />
          </Field>
          <Field
            label="Site description"
            hint="Used by search engines and social link previews; it is intentionally not visible in the page body."
          >
            <Textarea
              value={value.siteDescription}
              onChange={(_, d) => set("siteDescription", d.value)}
            />
          </Field>
        </section>
      )}
      {message && <div className="publish-message">{message}</div>}
    </div>
  );
}

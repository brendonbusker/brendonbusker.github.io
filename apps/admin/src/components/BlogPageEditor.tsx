import { useEffect, useState } from "react";
import { Button, Field, Input, Textarea } from "@fluentui/react-components";
import { Send20Regular } from "@fluentui/react-icons";
import { blogPageSchema, type BlogPage } from "@brendon/shared";
import { draftsApi, publishedApi, type PublishedItem } from "../api";

export function BlogPageEditor({ onBack }: { onBack: () => void }) {
  const [value, setValue] = useState<BlogPage | null>(null);
  const [source, setSource] = useState<PublishedItem<BlogPage> | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const valid = blogPageSchema.safeParse(value);

  useEffect(() => {
    let alive = true;
    publishedApi
      .one<BlogPage>("blog-page")
      .then((item) => {
        if (!alive) return;
        const content = blogPageSchema.parse(item.content);
        setValue(content);
        setSource({ ...item, content });
      })
      .catch((reason) => {
        if (!alive) return;
        setError(true);
        setMessage(
          reason instanceof Error
            ? reason.message
            : "Could not load the blog page introduction.",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (key: "eyebrow" | "headline" | "description", next: string) => {
    setValue((current) => (current ? { ...current, [key]: next } : current));
    setDirty(true);
    setMessage("");
    setError(false);
  };
  const publish = async () => {
    if (!source || !valid.success) return;
    setPublishing(true);
    setMessage("");
    setError(false);
    try {
      const result = await draftsApi.publish("blogPage", valid.data, {
        expectedSha: source.sha,
      });
      setValue(valid.data);
      setSource({
        content: valid.data,
        path: result.path,
        sha: result.contentSha,
      });
      setDirty(false);
      setMessage(
        `Blog page introduction published. Site deployment is in progress. Version ${result.version.slice(0, 8)}.`,
      );
    } catch (reason) {
      setError(true);
      setMessage(
        reason instanceof Error
          ? reason.message
          : "Could not publish the blog page introduction.",
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="workspace-page form-page">
      <header className="command-header">
        <div>
          <p className="page-label">Blog</p>
          <h1>Blog page introduction</h1>
          <p className="source-status">
            {loading
              ? "Loading current introduction from GitHub…"
              : source
                ? "Published introduction loaded from GitHub"
                : "Introduction could not be loaded"}
          </p>
        </div>
        <div>
          <Button
            disabled={publishing}
            onClick={() => {
              if (
                !dirty ||
                confirm(
                  "Discard unpublished changes to the Blog page introduction?",
                )
              )
                onBack();
            }}
          >
            Back to blog
          </Button>
          <Button
            appearance="primary"
            icon={<Send20Regular />}
            onClick={publish}
            disabled={
              loading || publishing || !source || !dirty || !valid.success
            }
          >
            {publishing ? "Publishing…" : "Publish introduction"}
          </Button>
        </div>
      </header>
      {value && (
        <div className="form-grid project-page-copy-editor">
          <section>
            <h2>Page copy</h2>
            <Field
              label="Eyebrow"
              hint="The small line above the headline."
              required
            >
              <Input
                value={value.eyebrow}
                maxLength={80}
                disabled={publishing}
                onChange={(_, data) => set("eyebrow", data.value)}
              />
            </Field>
            <Field label="Headline" required>
              <Textarea
                value={value.headline}
                maxLength={180}
                rows={4}
                disabled={publishing}
                onChange={(_, data) => set("headline", data.value)}
              />
            </Field>
            <Field label="Supporting description" required>
              <Textarea
                value={value.description}
                maxLength={500}
                rows={4}
                disabled={publishing}
                onChange={(_, data) => set("description", data.value)}
              />
            </Field>
            {!valid.success && (
              <p role="alert">All three fields are required.</p>
            )}
          </section>
          <section
            className="project-page-copy-preview"
            aria-label="Blog page introduction preview"
          >
            <p className="page-label">Live preview</p>
            <div>
              <p className="preview-eyebrow">{value.eyebrow}</p>
              <h2>{value.headline}</h2>
              <p>{value.description}</p>
            </div>
          </section>
        </div>
      )}
      {message && (
        <div
          className={error ? "publish-message error" : "publish-message"}
          role="status"
        >
          {message}
        </div>
      )}
    </div>
  );
}

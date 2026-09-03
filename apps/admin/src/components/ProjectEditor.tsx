import { useMemo, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Field,
  Input,
  Textarea,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowDown20Regular,
  ArrowUp20Regular,
  Delete20Regular,
  Eye20Regular,
  ImageAdd20Regular,
  Send20Regular,
} from "@fluentui/react-icons";
import { projectSchema, slugify, type Project } from "@brendon/shared";
import { newProject, seedProject, seedProjects } from "../seed";
import { useDraft } from "../hooks";
import { api, draftsApi } from "../api";
import { SaveStatus } from "./SaveStatus";
import { optimizeImage } from "../media";
export function ProjectEditor() {
  const [contentKey, setContentKey] = useState(seedProject.slug);
  const initial = useMemo(
    () =>
      seedProjects.find((project) => project.slug === contentKey) ??
      newProject(),
    [contentKey],
  );
  const { value, setValue, state } = useDraft<Project>(
    "project",
    contentKey,
    initial,
  );
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  const set = (key: keyof Project, v: unknown) =>
    setValue((p) => ({ ...p, [key]: v, updatedAt: new Date().toISOString() }));
  const publish = async () => {
    try {
      projectSchema.parse(value);
      await draftsApi.publish("project", value);
      setMessage("Published to GitHub. Site deployment is in progress.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not publish.");
    }
  };
  const deleteProject = async () => {
    if (!confirm(`Delete "${value.title || "this project"}"?`)) return;
    await draftsApi.remove("project", contentKey);
    setContentKey(crypto.randomUUID());
    setMessage("Project draft deleted. A new blank project is ready.");
  };
  const uploadImage = async (file?: File) => {
    if (!file) return;
    const alt = prompt(
      "Describe this screenshot for visitors using a screen reader.",
    );
    if (!alt) return;
    try {
      const optimized = await optimizeImage(file);
      const form = new FormData();
      form.append("file", optimized);
      form.append("alt", alt);
      const result = await api<{ path: string; alt: string }>(
        `/api/publish/media/projects/${value.slug}`,
        { method: "POST", body: form },
      );
      set("screenshots", [
        ...value.screenshots,
        { src: result.path, alt: result.alt },
      ]);
      setMessage("Screenshot published and added to this project draft.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Image upload failed.");
    }
  };
  const addFeature = () => set("features", [...value.features, ""]);
  const updateFeature = (i: number, text: string) =>
    set(
      "features",
      value.features.map((f, n) => (n === i ? text : f)),
    );
  const move = (i: number, d: number) => {
    const copy = [...value.features];
    const [item] = copy.splice(i, 1);
    if (item !== undefined) copy.splice(i + d, 0, item);
    set("features", copy);
  };
  return (
    <div className="workspace-page form-page">
      <header className="command-header">
        <div>
          <p className="page-label">Projects</p>
          <h1>{value.title}</h1>
          <SaveStatus state={state} />
        </div>
        <div>
          <select
            className="project-switcher"
            aria-label="Choose a project to edit"
            value={
              seedProjects.some((project) => project.slug === contentKey)
                ? contentKey
                : "new"
            }
            onChange={(event) => {
              if (event.target.value !== "new")
                setContentKey(event.target.value);
            }}
          >
            {seedProjects.map((project) => (
              <option key={project.slug} value={project.slug}>
                {project.title}
              </option>
            ))}
            {!seedProjects.some((project) => project.slug === contentKey) && (
              <option value="new">New project draft</option>
            )}
          </select>
          <Button
            icon={<Add20Regular />}
            onClick={() => setContentKey(crypto.randomUUID())}
          >
            New project
          </Button>
          <input
            ref={imageRef}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(event) => void uploadImage(event.target.files?.[0])}
          />
          <Button
            icon={<ImageAdd20Regular />}
            onClick={() => imageRef.current?.click()}
          >
            Add screenshot
          </Button>
          <Button icon={<Eye20Regular />} onClick={() => setPreview(!preview)}>
            {preview ? "Edit" : "Preview"}
          </Button>
          <Button
            appearance="primary"
            icon={<Send20Regular />}
            onClick={publish}
          >
            Publish
          </Button>
          <Button
            appearance="subtle"
            icon={<Delete20Regular />}
            onClick={deleteProject}
            aria-label={`Delete ${value.title || "project draft"}`}
          />
        </div>
      </header>
      {preview ? (
        <div className="project-preview">
          <article style={{ borderColor: value.accent }}>
            <div className="preview-icon" style={{ background: value.accent }}>
              ⌗
            </div>
            <p>
              {value.category} · {value.status}
            </p>
            <h2>{value.title}</h2>
            <p>{value.summary}</p>
          </article>
          <section>
            <h2>{value.title}</h2>
            <p>{value.overview}</p>
            <h3>Why I built it</h3>
            <p>{value.why}</p>
            <h3>Notable features</h3>
            <ul>
              {value.features.map((f) => (
                <li>{f}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <div className="form-grid">
          <section>
            <h2>Project details</h2>
            <div className="two-fields">
              <Field label="Project name" required>
                <Input
                  value={value.title}
                  onChange={(_, d) => {
                    set("title", d.value);
                    set("slug", slugify(d.value));
                  }}
                />
              </Field>
              <Field label="Slug" required>
                <Input
                  value={value.slug}
                  onChange={(_, d) => set("slug", slugify(d.value))}
                />
              </Field>
            </div>
            <Field label="Short summary" required>
              <Textarea
                value={value.summary}
                onChange={(_, d) => set("summary", d.value)}
              />
            </Field>
            <div className="two-fields">
              <Field label="Category">
                <Input
                  value={value.category}
                  onChange={(_, d) => set("category", d.value)}
                />
              </Field>
              <Field label="Status">
                <Input
                  value={value.status}
                  onChange={(_, d) => set("status", d.value)}
                />
              </Field>
            </div>
            <div className="two-fields">
              <Field label="Live URL">
                <Input
                  value={value.liveUrl}
                  onChange={(_, d) => set("liveUrl", d.value)}
                />
              </Field>
              <Field label="GitHub URL">
                <Input
                  value={value.githubUrl}
                  onChange={(_, d) => set("githubUrl", d.value)}
                />
              </Field>
            </div>
            <div className="two-fields">
              <Field label="Icon">
                <select
                  value={value.icon}
                  onChange={(e) => set("icon", e.target.value)}
                >
                  <option value="calculator">Calculator</option>
                  <option value="sparkles">Sparkles</option>
                  <option value="folder">Folder</option>
                </select>
              </Field>
              <Field label="Accent color">
                <input
                  className="color-input"
                  type="color"
                  value={value.accent}
                  onChange={(e) => set("accent", e.target.value)}
                />
              </Field>
            </div>
            <div className="checks">
              <Checkbox
                label="Featured"
                checked={value.featured}
                onChange={(_, d) => set("featured", !!d.checked)}
              />
              <Checkbox
                label="Published"
                checked={value.published}
                onChange={(_, d) => set("published", !!d.checked)}
              />
            </div>
          </section>
          <section>
            <h2>Project story</h2>
            <Field label="Overview">
              <Textarea
                rows={5}
                value={value.overview}
                onChange={(_, d) => set("overview", d.value)}
              />
            </Field>
            <Field label="Why I built it">
              <Textarea
                rows={5}
                value={value.why}
                onChange={(_, d) => set("why", d.value)}
              />
            </Field>
            <Field label="Implementation">
              <Textarea
                rows={5}
                value={value.implementation}
                onChange={(_, d) => set("implementation", d.value)}
              />
            </Field>
          </section>
          <section className="full-span">
            <div className="section-heading">
              <h2>Screenshots</h2>
              <Button
                icon={<ImageAdd20Regular />}
                onClick={() => imageRef.current?.click()}
              >
                Upload image
              </Button>
            </div>
            {value.screenshots.length === 0 ? (
              <p className="settings-note">
                No screenshots yet. Images are resized to 2,000 pixels and
                converted to WebP before the Worker validates and publishes
                them.
              </p>
            ) : (
              value.screenshots.map((shot, index) => (
                <div className="repeatable-row" key={shot.src}>
                  <Input
                    value={shot.src}
                    readOnly
                    aria-label="Published image path"
                  />
                  <Input
                    value={shot.alt}
                    aria-label="Image description"
                    onChange={(_, data) =>
                      set(
                        "screenshots",
                        value.screenshots.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, alt: data.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    icon={<Delete20Regular />}
                    aria-label="Remove screenshot from project"
                    onClick={() =>
                      set(
                        "screenshots",
                        value.screenshots.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      )
                    }
                  />
                </div>
              ))
            )}
          </section>
          <section className="full-span">
            <div className="section-heading">
              <h2>Notable features</h2>
              <Button icon={<Add20Regular />} onClick={addFeature}>
                Add feature
              </Button>
            </div>
            {value.features.map((feature, i) => (
              <div className="repeatable-row" key={i}>
                <Input
                  value={feature}
                  onChange={(_, d) => updateFeature(i, d.value)}
                />
                <Button
                  icon={<ArrowUp20Regular />}
                  aria-label="Move feature up"
                  disabled={!i}
                  onClick={() => move(i, -1)}
                />
                <Button
                  icon={<ArrowDown20Regular />}
                  aria-label="Move feature down"
                  disabled={i === value.features.length - 1}
                  onClick={() => move(i, 1)}
                />
                <Button
                  icon={<Delete20Regular />}
                  aria-label="Delete feature"
                  onClick={() =>
                    set(
                      "features",
                      value.features.filter((_, n) => n !== i),
                    )
                  }
                />
              </div>
            ))}
          </section>
        </div>
      )}
      {message && <div className="publish-message">{message}</div>}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
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
  DocumentPdf20Regular,
  Eye20Regular,
  Send20Regular,
} from "@fluentui/react-icons";
import { resumeSchema, type Resume } from "@brendon/shared";
import { publishedResume as seedResume } from "../published-seed";
import { useDraft } from "../hooks";
import { api, draftsApi, publishedApi, type PublishedItem } from "../api";
import { SaveStatus } from "./SaveStatus";
import { ResumePdfPanel } from "./ResumePdfPanel";
import { ResumeAdditionalFields } from "./ResumeAdditionalFields";
import { ResumeWebPreview } from "./ResumeWebPreview";
import { CommaListInput } from "./CommaListInput";
export function ResumeEditor() {
  const [published, setPublished] = useState<PublishedItem<Resume>>({
    content: seedResume,
    path: "apps/site/src/data/resume.json",
    sha: "",
  });
  const [syncing, setSyncing] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const publishLock = useRef(false);
  const { value, setValue, state, reset, loading, lockAndSave, unlock } =
    useDraft<Resume>(
      "resume",
      "main",
      published.content,
      published.sha,
      !syncing && !!published.sha,
    );
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    setSyncing(true);
    publishedApi
      .one<Resume>("resume")
      .then((item) => {
        if (alive) {
          setPublished(item);
          setMessage("");
        }
      })
      .catch((error) => {
        if (alive)
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load the published résumé.",
          );
      })
      .finally(() => {
        if (alive) setSyncing(false);
      });
    return () => {
      alive = false;
    };
  }, [loadAttempt]);
  const ready = !syncing && !loading && !!published.sha;
  const set = (key: keyof Resume, v: unknown) =>
    setValue((r) => ({
      ...r,
      [key]: v,
      updatedAt: new Date().toISOString().slice(0, 10),
    }));
  const updateExperience = (i: number, key: string, v: unknown) =>
    set(
      "experience",
      value.experience.map((x, n) => (n === i ? { ...x, [key]: v } : x)),
    );
  const moveExperience = (i: number, d: number) => {
    const copy = [...value.experience];
    const [item] = copy.splice(i, 1);
    if (item) copy.splice(i + d, 0, item);
    set("experience", copy);
  };
  const publish = async () => {
    if (!ready || publishLock.current) return;
    publishLock.current = true;
    setPublishing(true);
    try {
      const valid = resumeSchema.parse({
        ...value,
        experience: value.experience.map((item) => ({
          ...item,
          accomplishments: item.accomplishments.filter((line) => line.trim()),
        })),
        selectedWork: value.selectedWork.map((item) => ({
          ...item,
          techStack: (item.techStack || []).filter((text) => text.trim()),
          accomplishments: (item.accomplishments || []).filter((line) =>
            line.trim(),
          ),
        })),
      });
      if (!(await lockAndSave()))
        throw new Error(
          "Could not save your draft. Your edits are still here; try publishing again.",
        );
      const result = await draftsApi.publish("resume", valid, {
        expectedSha: published.sha,
      });
      let draftCleared = true;
      try {
        await draftsApi.remove("resume", "main");
      } catch {
        draftCleared = false;
      }
      setPublished({
        content: valid,
        path: result.path,
        sha: result.contentSha,
      });
      reset(valid);
      setMessage(
        draftCleared
          ? "Published to GitHub. Follow the publication status above."
          : "Published to GitHub, but the saved draft could not be cleared. Follow the publication status above.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      unlock();
      publishLock.current = false;
      setPublishing(false);
    }
  };
  const uploadPdf = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" || file.size > 8_000_000) {
      setMessage("Choose a PDF smaller than 8 MB.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    try {
      await api("/api/publish/resume-pdf", { method: "POST", body: form });
      setMessage(
        "Résumé PDF published to its stable download path. Follow the publication status above.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "PDF upload failed.");
    }
  };
  return (
    <div className="workspace-page form-page">
      <header className="command-header">
        <div>
          <p className="page-label">Résumé</p>
          <h1>Structured résumé</h1>
          <SaveStatus state={state} />
          <p className="source-status">
            {syncing || loading
              ? "Loading current content from GitHub…"
              : published.sha
                ? "Current published content loaded from GitHub"
                : "Could not load the current published résumé"}
          </p>
          {!syncing && !published.sha && (
            <Button onClick={() => setLoadAttempt((n) => n + 1)}>
              Retry loading résumé
            </Button>
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => void uploadPdf(e.target.files?.[0])}
          />
          <Button
            icon={<DocumentPdf20Regular />}
            onClick={() => fileRef.current?.click()}
            disabled={publishing}
          >
            Replace PDF
          </Button>
          <Button
            icon={<Eye20Regular />}
            onClick={() => setPreview(!preview)}
            disabled={!ready || publishing}
          >
            {preview ? "Edit" : "Preview"}
          </Button>
          <Button
            appearance="primary"
            icon={<Send20Regular />}
            onClick={publish}
            disabled={!ready || publishing}
          >
            {publishing ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </header>
      <ResumePdfPanel value={value} ready={ready && !publishing} />
      {preview ? (
        <ResumeWebPreview value={value} />
      ) : (
        <fieldset
          className="resume-form"
          disabled={!ready || publishing}
          aria-label="Résumé fields"
        >
          <section>
            <h2>Basic information</h2>
            <div className="two-fields">
              <Field label="Name">
                <Input
                  value={value.fullName}
                  onChange={(_, d) => set("fullName", d.value)}
                />
              </Field>
              <Field
                label="Headline"
                hint="Website only; omitted from the PDF."
              >
                <Input
                  value={value.headline}
                  onChange={(_, d) => set("headline", d.value)}
                />
              </Field>
            </div>
            <Field
              label="Professional summary"
              hint="Optional website copy; omitted from the PDF."
            >
              <Textarea
                rows={5}
                value={value.summary}
                onChange={(_, d) => set("summary", d.value)}
              />
            </Field>
          </section>
          <section>
            <div className="section-heading">
              <h2>Experience</h2>
              <Button
                icon={<Add20Regular />}
                onClick={() =>
                  set("experience", [
                    ...value.experience,
                    {
                      id: crypto.randomUUID(),
                      employer: "",
                      role: "",
                      location: "",
                      startDate: "",
                      endDate: "",
                      current: false,
                      description: "",
                      accomplishments: [],
                    },
                  ])
                }
              >
                Add role
              </Button>
            </div>
            {value.experience.map((item, i) => (
              <div className="repeatable-card" key={item.id}>
                <div className="repeatable-card-actions">
                  <Button
                    icon={<ArrowUp20Regular />}
                    aria-label="Move role up"
                    disabled={!i}
                    onClick={() => moveExperience(i, -1)}
                  />
                  <Button
                    icon={<ArrowDown20Regular />}
                    aria-label="Move role down"
                    disabled={i === value.experience.length - 1}
                    onClick={() => moveExperience(i, 1)}
                  />
                  <Button
                    icon={<Delete20Regular />}
                    aria-label={`Delete ${item.role}`}
                    onClick={() =>
                      confirm(`Delete ${item.role || "this role"}?`) &&
                      set(
                        "experience",
                        value.experience.filter((_, n) => n !== i),
                      )
                    }
                  />
                </div>
                <div className="two-fields">
                  <Field label="Employer">
                    <Input
                      value={item.employer}
                      onChange={(_, d) =>
                        updateExperience(i, "employer", d.value)
                      }
                    />
                  </Field>
                  <Field label="Role">
                    <Input
                      value={item.role}
                      onChange={(_, d) => updateExperience(i, "role", d.value)}
                    />
                  </Field>
                </div>
                <div className="three-fields">
                  <Field label="Location">
                    <Input
                      value={item.location}
                      onChange={(_, d) =>
                        updateExperience(i, "location", d.value)
                      }
                    />
                  </Field>
                  <Field label="Start">
                    <Input
                      value={item.startDate}
                      onChange={(_, d) =>
                        updateExperience(i, "startDate", d.value)
                      }
                    />
                  </Field>
                  <Field label="End">
                    <Input
                      value={item.current ? "Present" : item.endDate}
                      disabled={item.current}
                      onChange={(_, d) =>
                        updateExperience(i, "endDate", d.value)
                      }
                    />
                  </Field>
                </div>
                <Checkbox
                  label="I currently work here"
                  checked={item.current}
                  onChange={(_, d) =>
                    updateExperience(i, "current", d.checked === true)
                  }
                />
                <Field
                  label="Description"
                  hint="Optional website copy; omitted from the PDF."
                >
                  <Textarea
                    value={item.description}
                    onChange={(_, d) =>
                      updateExperience(i, "description", d.value)
                    }
                  />
                </Field>
                <Field label="Accomplishments (one per line)">
                  <Textarea
                    rows={6}
                    value={item.accomplishments.join("\n")}
                    onChange={(_, d) =>
                      updateExperience(
                        i,
                        "accomplishments",
                        d.value.split("\n"),
                      )
                    }
                  />
                </Field>
              </div>
            ))}
          </section>
          <section>
            <div className="section-heading">
              <h2>Education</h2>
              <Button
                icon={<Add20Regular />}
                onClick={() =>
                  set("education", [
                    ...value.education,
                    {
                      id: crypto.randomUUID(),
                      school: "",
                      degree: "",
                      field: "",
                      location: "",
                      startDate: "",
                      endDate: "",
                      details: [],
                    },
                  ])
                }
              >
                Add education
              </Button>
            </div>
            {value.education.map((item, i) => (
              <div className="repeatable-card" key={item.id}>
                <Button
                  className="delete-corner"
                  icon={<Delete20Regular />}
                  aria-label="Delete education"
                  onClick={() =>
                    set(
                      "education",
                      value.education.filter((_, n) => n !== i),
                    )
                  }
                />
                <div className="two-fields">
                  <Field label="School">
                    <Input
                      value={item.school}
                      onChange={(_, d) =>
                        set(
                          "education",
                          value.education.map((x, n) =>
                            n === i ? { ...x, school: d.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Degree">
                    <Input
                      value={item.degree}
                      onChange={(_, d) =>
                        set(
                          "education",
                          value.education.map((x, n) =>
                            n === i ? { ...x, degree: d.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <Field label="Field">
                  <Input
                    value={item.field}
                    onChange={(_, d) =>
                      set(
                        "education",
                        value.education.map((x, n) =>
                          n === i ? { ...x, field: d.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <div className="three-fields">
                  {(["location", "startDate", "endDate"] as const).map(
                    (key) => (
                      <Field
                        label={`Education ${i + 1} ${key === "startDate" ? "start" : key === "endDate" ? "end" : "location"}`}
                        key={key}
                      >
                        <Input
                          value={item[key]}
                          onChange={(_, d) =>
                            set(
                              "education",
                              value.education.map((x, n) =>
                                n === i ? { ...x, [key]: d.value } : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    ),
                  )}
                </div>
              </div>
            ))}
          </section>
          <section>
            <h2>Skill groups</h2>
            {value.skillGroups.map((group, i) => (
              <div className="repeatable-row" key={group.id}>
                <Input
                  value={group.name}
                  aria-label="Skill group name"
                  onChange={(_, d) =>
                    set(
                      "skillGroups",
                      value.skillGroups.map((g, n) =>
                        n === i ? { ...g, name: d.value } : g,
                      ),
                    )
                  }
                />
                <CommaListInput
                  items={group.skills}
                  aria-label={`${group.name} skills`}
                  onItemsChange={(skills) =>
                    set(
                      "skillGroups",
                      value.skillGroups.map((g, n) =>
                        n === i
                          ? {
                              ...g,
                              skills,
                            }
                          : g,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </section>
          <ResumeAdditionalFields value={value} set={set} />
        </fieldset>
      )}
      {message && (
        <div
          className={
            message.includes("failed")
              ? "publish-message error"
              : "publish-message"
          }
        >
          {message}
        </div>
      )}
    </div>
  );
}

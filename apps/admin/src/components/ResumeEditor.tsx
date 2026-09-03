import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Textarea } from "@fluentui/react-components";
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
export function ResumeEditor() {
  const [published, setPublished] = useState<PublishedItem<Resume>>({
    content: seedResume,
    path: "apps/site/src/data/resume.json",
    sha: "",
  });
  const [syncing, setSyncing] = useState(true);
  const { value, setValue, state, reset, loading } = useDraft<Resume>(
    "resume",
    "main",
    published.content,
  );
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    publishedApi
      .one<Resume>("resume")
      .then((item) => {
        if (alive) setPublished(item);
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
  }, []);
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
    try {
      const valid = resumeSchema.parse(value);
      const result = await draftsApi.publish("resume", valid, {
        expectedSha: published.sha || undefined,
      });
      await draftsApi.remove("resume", "main");
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
        "Résumé PDF published to its stable download path. Site deployment is in progress.",
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
              : "Current published content loaded from GitHub"}
          </p>
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
          >
            Replace PDF
          </Button>
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
        <div className="resume-preview">
          <aside>
            <h2>{value.fullName}</h2>
            <p className="preview-headline">{value.headline}</p>
            <p>{value.summary}</p>
            <h3>Skills</h3>
            {value.skillGroups.map((g) => (
              <p>
                <b>{g.name}</b>
                <br />
                {g.skills.join(" · ")}
              </p>
            ))}
          </aside>
          <main>
            <h3>Experience</h3>
            {value.experience.map((x) => (
              <article>
                <div>
                  <h4>{x.role}</h4>
                  <p>{x.employer}</p>
                </div>
                <small>
                  {x.startDate} — {x.current ? "Present" : x.endDate}
                </small>
                <ul>
                  {x.accomplishments.map((a) => (
                    <li>{a}</li>
                  ))}
                </ul>
              </article>
            ))}
            <h3>Education</h3>
            {value.education.map((x) => (
              <article>
                <h4>{x.school}</h4>
                <p>
                  {x.degree}, {x.field}
                </p>
              </article>
            ))}
          </main>
        </div>
      ) : (
        <div className="resume-form">
          <section>
            <h2>Basic information</h2>
            <div className="two-fields">
              <Field label="Name">
                <Input
                  value={value.fullName}
                  onChange={(_, d) => set("fullName", d.value)}
                />
              </Field>
              <Field label="Headline">
                <Input
                  value={value.headline}
                  onChange={(_, d) => set("headline", d.value)}
                />
              </Field>
            </div>
            <Field label="Professional summary">
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
                      onChange={(_, d) =>
                        updateExperience(i, "endDate", d.value)
                      }
                    />
                  </Field>
                </div>
                <Field label="Description">
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
                        d.value.split("\n").filter(Boolean),
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
                <Input
                  value={group.skills.join(", ")}
                  aria-label={`${group.name} skills`}
                  onChange={(_, d) =>
                    set(
                      "skillGroups",
                      value.skillGroups.map((g, n) =>
                        n === i
                          ? {
                              ...g,
                              skills: d.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            }
                          : g,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </section>
        </div>
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

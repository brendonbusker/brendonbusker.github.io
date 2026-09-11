import {
  Button,
  Checkbox,
  Field,
  Input,
  Textarea,
} from "@fluentui/react-components";
import type { Resume } from "@brendon/shared";
import { CommaListInput } from "./CommaListInput";

export function ResumeAdditionalFields({
  value,
  set,
}: {
  value: Resume;
  set: (key: keyof Resume, value: unknown) => void;
}) {
  const updateContact = (index: number, key: string, next: unknown) =>
    set(
      "links",
      value.links.map((item, i) =>
        i === index ? { ...item, [key]: next } : item,
      ),
    );
  const updateProject = (index: number, key: string, next: unknown) =>
    set(
      "selectedWork",
      value.selectedWork.map((item, i) =>
        i === index ? { ...item, [key]: next } : item,
      ),
    );
  return (
    <>
      <section>
        <div className="section-heading">
          <h2>Contact details</h2>
          <Button
            onClick={() =>
              set("links", [
                ...value.links,
                { label: "Contact", value: "", url: "", public: true },
              ])
            }
          >
            Add contact
          </Button>
        </div>
        <p>
          Public contacts appear in this order on the website and the PDF’s
          contact line.
        </p>
        {value.links.map((contact, i) => (
          <div className="repeatable-card" key={i}>
            <div className="two-fields">
              <Field label={`Contact ${i + 1} label`}>
                <Input
                  value={contact.label}
                  onChange={(_, d) => updateContact(i, "label", d.value)}
                />
              </Field>
              <Field label={`Contact ${i + 1} text`}>
                <Input
                  value={contact.value}
                  onChange={(_, d) => updateContact(i, "value", d.value)}
                />
              </Field>
            </div>
            <Field
              label={`Contact ${i + 1} URL`}
              hint="Optional. Leave blank for a phone number."
            >
              <Input
                value={contact.url || ""}
                onChange={(_, d) => updateContact(i, "url", d.value)}
              />
            </Field>
            <Checkbox
              label={`Show ${contact.label || "contact"} publicly`}
              checked={contact.public}
              onChange={(_, d) =>
                updateContact(i, "public", d.checked === true)
              }
            />
            <Button
              onClick={() =>
                set(
                  "links",
                  value.links.filter((_, n) => n !== i),
                )
              }
            >
              Remove contact {i + 1}
            </Button>
          </div>
        ))}
      </section>
      <section>
        <div className="section-heading">
          <h2>Projects</h2>
          <Button
            onClick={() =>
              set("selectedWork", [
                ...value.selectedWork,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  summary: "",
                  techStack: [],
                  accomplishments: [],
                  url: "",
                  githubUrl: "",
                },
              ])
            }
          >
            Add résumé project
          </Button>
        </div>
        {value.selectedWork.map((project, i) => (
          <div className="repeatable-card" key={project.id}>
            <Field label={`Project ${i + 1} name`}>
              <Input
                value={project.name}
                onChange={(_, d) => updateProject(i, "name", d.value)}
              />
            </Field>
            <Field
              label={`Project ${i + 1} technologies`}
              hint="Separate technologies with commas."
            >
              <CommaListInput
                items={project.techStack || []}
                onItemsChange={(items) => updateProject(i, "techStack", items)}
              />
            </Field>
            <div className="two-fields">
              <Field label={`Project ${i + 1} live URL`}>
                <Input
                  value={project.url || ""}
                  onChange={(_, d) => updateProject(i, "url", d.value)}
                />
              </Field>
              <Field label={`Project ${i + 1} GitHub URL`}>
                <Input
                  value={project.githubUrl || ""}
                  onChange={(_, d) => updateProject(i, "githubUrl", d.value)}
                />
              </Field>
            </div>
            <Field
              label={`Project ${i + 1} accomplishments`}
              hint="One bullet per line."
            >
              <Textarea
                rows={7}
                value={(project.accomplishments || []).join("\n")}
                onChange={(_, d) =>
                  updateProject(i, "accomplishments", d.value.split("\n"))
                }
              />
            </Field>
            <Field
              label={`Project ${i + 1} summary`}
              hint="Optional website introduction. Used as a PDF bullet only when no accomplishments are entered."
            >
              <Textarea
                value={project.summary}
                onChange={(_, d) => updateProject(i, "summary", d.value)}
              />
            </Field>
            <Button
              onClick={() =>
                confirm(
                  `Remove ${project.name || "this project"} from the résumé?`,
                ) &&
                set(
                  "selectedWork",
                  value.selectedWork.filter((_, n) => n !== i),
                )
              }
            >
              Remove résumé project
            </Button>
          </div>
        ))}
      </section>
      <section>
        <div className="section-heading">
          <h2>Certifications</h2>
          <Button
            onClick={() =>
              set("certifications", [
                ...value.certifications,
                { id: crypto.randomUUID(), name: "", issuer: "", date: "" },
              ])
            }
          >
            Add certification
          </Button>
        </div>
        {value.certifications.map((cert, i) => (
          <div className="repeatable-card" key={cert.id}>
            {(["name", "issuer", "date"] as const).map((key) => (
              <Field label={`Certification ${i + 1} ${key}`} key={key}>
                <Input
                  value={cert[key]}
                  onChange={(_, d) =>
                    set(
                      "certifications",
                      value.certifications.map((item, n) =>
                        n === i ? { ...item, [key]: d.value } : item,
                      ),
                    )
                  }
                />
              </Field>
            ))}
            <Button
              onClick={() =>
                set(
                  "certifications",
                  value.certifications.filter((_, n) => n !== i),
                )
              }
            >
              Remove certification {i + 1}
            </Button>
          </div>
        ))}
      </section>
    </>
  );
}

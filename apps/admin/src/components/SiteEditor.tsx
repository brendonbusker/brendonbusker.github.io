import { useState } from "react";
import { Button, Field, Input, Textarea } from "@fluentui/react-components";
import { Eye20Regular, Send20Regular } from "@fluentui/react-icons";
import { siteProfileSchema, type SiteProfile } from "@brendon/shared";
import { publishedSite as seedSite } from "../published-seed";
import { useDraft } from "../hooks";
import { draftsApi } from "../api";
import { SaveStatus } from "./SaveStatus";
export function SiteEditor() {
  const { value, setValue, state } = useDraft<SiteProfile>(
    "homepage",
    "main",
    seedSite,
  );
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const set = (key: keyof SiteProfile, v: unknown) =>
    setValue((p) => ({ ...p, [key]: v }));
  const publish = async () => {
    try {
      siteProfileSchema.parse(value);
      await draftsApi.publish("homepage", value);
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
        </div>
        <div>
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
        </div>
      </header>
      {preview ? (
        <div className="homepage-preview">
          <p>Homepage preview</p>
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
            <Field label="Site title">
              <Input
                value={value.siteTitle}
                onChange={(_, d) => set("siteTitle", d.value)}
              />
            </Field>
            <Field label="Timezone">
              <Input
                value={value.timezone}
                onChange={(_, d) => set("timezone", d.value)}
              />
            </Field>
          </div>
          <Field label="Site description">
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

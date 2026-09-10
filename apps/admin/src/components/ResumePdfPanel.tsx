import { useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@fluentui/react-components";
import type { Resume } from "@brendon/shared";
import { api } from "../api";
import { generateResumePdf, reviewResume } from "../resume-pdf";

export function ResumePdfPanel({
  value,
  ready,
}: {
  value: Resume;
  ready: boolean;
}) {
  const [generated, setGenerated] = useState<{
    blob: Blob;
    url: string;
    filename: string;
    source: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const alive = useRef(true);
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);
  const stale = generated && generated.source !== JSON.stringify(value);
  const notes = reviewResume(value);
  const generate = async () => {
    setBusy(true);
    setMessage("");
    const source = JSON.stringify(value);
    try {
      const result = await generateResumePdf(value);
      if (!alive.current) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(result.blob);
      urlRef.current = url;
      setGenerated({ ...result, url, source });
      setMessage("PDF ready. Review the preview before publishing.");
    } catch (error) {
      if (alive.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "PDF generation failed. Try again.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const publish = async () => {
    if (!generated || stale) return;
    setPublishing(true);
    setMessage("");
    const form = new FormData();
    form.append("file", generated.blob, generated.filename);
    try {
      await api("/api/publish/resume-pdf", { method: "POST", body: form });
      if (alive.current)
        setMessage(
          "Résumé PDF published. Follow the publication status above.",
        );
    } catch (error) {
      if (alive.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "PDF publishing failed. Try again.",
        );
    } finally {
      if (alive.current) setPublishing(false);
    }
  };
  return (
    <section className="resume-pdf-panel" aria-labelledby="resume-pdf-title">
      <h2 id="resume-pdf-title">Generate a résumé PDF</h2>
      <p>
        Uses the current editor content, including unpublished edits. Single
        column, standard headings, selectable text and embedded fonts. Only
        contact details marked public are included.
      </p>
      <p>
        Download a copy for applications, or publish it to replace the website’s
        PDF. Publishing this PDF does not publish your web résumé edits.
      </p>
      <div className="pdf-actions">
        <Button
          onClick={() => void generate()}
          disabled={!ready || busy || publishing}
        >
          {generated ? "Regenerate PDF" : "Generate PDF"}
        </Button>
        {busy && <Spinner size="tiny" label="Generating PDF…" />}
        {generated && !stale && (
          <a href={generated.url} download={generated.filename}>
            Download PDF
          </a>
        )}
        {generated && (
          <Button
            appearance="primary"
            onClick={() => void publish()}
            disabled={!ready || !!stale || busy || publishing}
          >
            {publishing ? "Publishing PDF…" : "Publish PDF to website"}
          </Button>
        )}
      </div>
      {stale && (
        <p role="status">
          Your résumé has changed. Regenerate the PDF to include your latest
          edits.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <details>
        <summary>Before applying</summary>
        <p>
          Tailor the headline, skills and strongest accomplishments to the role.
          Keep relevant experience first and use specific actions and results
          you can support. Review spelling, dates, links and page breaks.
        </p>
        {notes.length > 0 && (
          <ul>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        <p>
          The layout is designed for ATS readability; follow each employer’s
          requested file format. Longer content flows onto additional pages
          without shrinking the text.
        </p>
      </details>
      {generated && (
        <iframe
          className="resume-pdf-preview"
          title="Generated résumé PDF preview"
          src={generated.url}
        />
      )}
    </section>
  );
}

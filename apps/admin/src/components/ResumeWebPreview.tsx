import type { Resume } from "@brendon/shared";

const bullets = (items: string[]) => {
  const visible = items.filter((item) => item.trim());
  return visible.length ? (
    <ul>
      {visible.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  ) : null;
};

export function ResumeWebPreview({ value }: { value: Resume }) {
  return (
    <div className="resume-preview">
      <aside>
        <h2>{value.fullName}</h2>
        <p className="preview-headline">{value.headline}</p>
        {value.summary && <p>{value.summary}</p>}
        <h3>Contact</h3>
        {value.links
          .filter((link) => link.public)
          .map((link, i) => (
            <p key={i}>
              <b>{link.label}</b>
              <br />
              {link.url ? (
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.value}
                </a>
              ) : (
                link.value
              )}
            </p>
          ))}
        <h3>Skills</h3>
        {value.skillGroups.map((group) => (
          <p key={group.id}>
            <b>{group.name}</b>
            <br />
            {group.skills.filter((skill) => skill.trim()).join(" · ")}
          </p>
        ))}
      </aside>
      <main>
        <h3>Experience</h3>
        {value.experience.map((item) => (
          <article key={item.id}>
            <h4>{item.role}</h4>
            <p>{item.employer}</p>
            <small>
              {item.startDate} — {item.current ? "Present" : item.endDate}
            </small>
            {item.location && <p>{item.location}</p>}
            {item.description && <p>{item.description}</p>}
            {bullets(item.accomplishments)}
          </article>
        ))}
        <h3>Education</h3>
        {value.education.map((item) => (
          <article key={item.id}>
            <h4>{item.school}</h4>
            <p>{[item.degree, item.field].filter(Boolean).join(", ")}</p>
            <small>
              {[item.startDate, item.endDate].filter(Boolean).join(" — ")}
            </small>
            {item.location && <p>{item.location}</p>}
            {bullets(item.details)}
          </article>
        ))}
        <h3>Certifications</h3>
        {value.certifications.map((item) => (
          <article key={item.id}>
            <h4>{item.name}</h4>
            <p>{[item.issuer, item.date].filter(Boolean).join(" · ")}</p>
          </article>
        ))}
        <h3>Selected work</h3>
        {value.selectedWork.map((item) => (
          <article key={item.id}>
            <h4>{item.name}</h4>
            {!!item.techStack?.length && (
              <p>{item.techStack.filter((tech) => tech.trim()).join(", ")}</p>
            )}
            {item.summary && <p>{item.summary}</p>}
            {bullets(item.accomplishments || [])}
            {item.githubUrl && (
              <p>
                <a href={item.githubUrl} target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </p>
            )}
            {item.url && (
              <p>
                <a href={item.url} target="_blank" rel="noreferrer">
                  View project
                </a>
              </p>
            )}
          </article>
        ))}
      </main>
    </div>
  );
}

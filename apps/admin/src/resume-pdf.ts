import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { resumeSchema, type Resume } from "@brendon/shared";

const clean = (text: string) =>
  text.trim().replace(/[\u2010-\u2015\u2212]/g, "-");
const join = (parts: string[]) => parts.map(clean).filter(Boolean).join(" | ");
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export function reviewResume(resume: Resume) {
  const notes: string[] = [];
  if (!resume.links.some((link) => link.public && /@/.test(link.value)))
    notes.push("Add a public email address so employers can contact you.");
  if (words(resume.summary) > 65)
    notes.push(
      "Consider shortening the summary to a few focused lines for your target role.",
    );
  for (const job of resume.experience) {
    if (
      !job.role.trim() ||
      !job.employer.trim() ||
      !job.startDate.trim() ||
      (!job.current && !job.endDate.trim())
    )
      notes.push(
        `Complete the title, employer and dates for ${job.role || job.employer || "an experience entry"}.`,
      );
    if (job.accomplishments.some((bullet) => words(bullet) > 45))
      notes.push(
        `Shorten the longest bullets under ${job.role || job.employer}; keep the action, relevant tools and concrete outcome.`,
      );
  }
  if (
    !resume.skillGroups.some((group) =>
      group.skills.some((skill) => skill.trim()),
    )
  )
    notes.push(
      "List relevant technical and professional skills using the terminology in the job description.",
    );
  return notes;
}

export function resumeDocument(input: Resume): TDocumentDefinitions {
  const resume = resumeSchema.parse(input);
  if (!resume.fullName.trim() || !resume.headline.trim())
    throw new Error(
      "Enter your name and professional headline before generating a PDF.",
    );
  const content: Content[] = [
    {
      text: clean(resume.fullName),
      fontSize: 20,
      bold: true,
      margin: [0, 0, 0, 3],
    },
    { text: clean(resume.headline), fontSize: 11, margin: [0, 0, 0, 5] },
    ...resume.links
      .filter((link) => link.public && link.value.trim())
      .map((link) => ({
        text: `${clean(link.label)}: ${clean(link.value)}`,
        ...(link.url ? { link: link.url } : {}),
        fontSize: 9.5,
        margin: [0, 0, 0, 2] as [number, number, number, number],
      })),
  ];
  const section = (title: string) =>
    content.push({
      text: title,
      bold: true,
      fontSize: 11,
      headlineLevel: 1,
      margin: [0, 12, 0, 5],
    });
  const paragraph = (text: string) => {
    if (text.trim()) content.push({ text: clean(text), margin: [0, 0, 0, 4] });
  };
  const bullets = (items: string[]) => {
    const nonempty = items.map(clean).filter(Boolean);
    if (nonempty.length)
      content.push({
        ul: nonempty.map((text) => ({ text, margin: [0, 0, 0, 3] })),
        margin: [10, 0, 0, 5],
      });
  };
  if (resume.summary.trim()) {
    section("Professional Summary");
    paragraph(resume.summary);
  }
  if (resume.experience.length) {
    section("Experience");
    for (const job of resume.experience) {
      content.push({
        stack: [
          { text: clean(job.role) || clean(job.employer), bold: true },
          {
            text: join([
              job.employer,
              job.location,
              [job.startDate, job.current ? "Present" : job.endDate]
                .filter(Boolean)
                .join(" - "),
            ]),
            fontSize: 10,
          },
        ],
        unbreakable: true,
        headlineLevel: 2,
        margin: [0, 4, 0, 4],
      });
      paragraph(job.description);
      bullets(job.accomplishments);
    }
  }
  if (resume.education.length) {
    section("Education");
    for (const school of resume.education) {
      content.push({
        stack: [
          { text: clean(school.school), bold: true },
          {
            text: join([
              [school.degree, school.field].filter(Boolean).join(", "),
              school.location,
              [school.startDate, school.endDate].filter(Boolean).join(" - "),
            ]),
          },
        ],
        unbreakable: true,
        margin: [0, 0, 0, 4],
      });
      bullets(school.details);
    }
  }
  if (resume.skillGroups.some((group) => group.skills.length)) {
    section("Skills");
    for (const group of resume.skillGroups)
      if (group.skills.length)
        content.push({
          text: [
            { text: `${clean(group.name)}: `, bold: true },
            group.skills.map(clean).filter(Boolean).join(", "),
          ],
          margin: [0, 0, 0, 4],
        });
  }
  if (resume.certifications.length) {
    section("Certifications");
    for (const cert of resume.certifications)
      paragraph(join([cert.name, cert.issuer, cert.date]));
  }
  if (resume.selectedWork.length) {
    section("Projects");
    for (const project of resume.selectedWork) {
      content.push({
        text: clean(project.name),
        bold: true,
        headlineLevel: 2,
        margin: [0, 2, 0, 3],
      });
      paragraph(project.summary);
      if (project.url)
        content.push({
          text: project.url,
          link: project.url,
          fontSize: 9,
          margin: [0, 0, 0, 5],
        });
    }
  }
  return {
    pageSize: "LETTER",
    pageMargins: [42, 36, 42, 36],
    info: {
      title: `${clean(resume.fullName)} - Resume`,
      author: clean(resume.fullName),
      subject: clean(resume.headline),
    },
    defaultStyle: {
      font: "Roboto",
      fontSize: 10.5,
      lineHeight: 1.12,
      color: "#111111",
    },
    content,
    pageBreakBefore: (node, container) =>
      !!node.headlineLevel && container.getFollowingNodesOnPage().length === 0,
  };
}

export async function generateResumePdf(resume: Resume) {
  // Loaded only on demand; the public website and other editors do not load PDF code/fonts.
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  const blob = await pdfMake.createPdf(resumeDocument(resume)).getBlob();
  const filename = `${resume.fullName.trim().replace(/[^\p{L}\p{N}]+/gu, "-") || "Resume"}-Resume.pdf`;
  return { blob, filename };
}

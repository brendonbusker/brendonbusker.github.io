import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { resumeSchema, type Resume } from "@brendon/shared";

const clean = (text: string) => {
  const result = text.trim().replace(/[\u2010-\u2015\u2212]/g, "-");
  // Standard 14 Times uses WinAnsi. Report unsupported characters instead of
  // silently dropping them from an application document.
  for (const char of result) {
    const code = char.codePointAt(0)!;
    if (
      (code >= 32 && code <= 126) ||
      (code >= 160 && code <= 255) ||
      [9, 10, 13].includes(code) ||
      "ŒœŠšŸŽžƒ€‘’“”‚„…†‡ˆ‰‹›˜•™".includes(char)
    )
      continue;
    throw new Error(
      `The Times PDF template cannot render “${char}”. Replace that character before generating the PDF.`,
    );
  }
  return result;
};
const join = (parts: string[], separator = " | ") =>
  parts.map(clean).filter(Boolean).join(separator);
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "");

export function reviewResume(resume: Resume) {
  const notes: string[] = [];
  if (!resume.links.some((link) => link.public && /@/.test(link.value)))
    notes.push("Add a public email address so employers can contact you.");
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

// Dimensions, font sizes and leading measured from the user's original resume.pdf.
// Flow layout preserves the template while allowing edited content to wrap/paginate.
const width = 525.12;
const line = (text: string, fontSize: number, height: number, extra = {}) => ({
  text: clean(text),
  fontSize,
  lineHeight: height / (fontSize * ("italics" in extra ? 0.888 : 0.9)),
  ...extra,
});

export function resumeDocument(input: Resume): TDocumentDefinitions {
  const resume = resumeSchema.parse(input);
  if (!resume.fullName.trim())
    throw new Error("Enter your name before generating a PDF.");
  const content: Content[] = [
    line(resume.fullName.toUpperCase(), 21, 22.1009, {
      bold: true,
      alignment: "center",
    }),
    {
      text: resume.links
        .filter((link) => link.public && link.value.trim())
        .flatMap((link, index) => [
          ...(index ? [{ text: " | " }] : []),
          { text: clean(link.value), ...(link.url ? { link: link.url } : {}) },
        ]),
      fontSize: 8.7,
      lineHeight: 10 / (8.7 * 0.9),
      alignment: "center",
      color: "#444444",
      margin: [0, 0, 0, -0.7367],
    },
  ];
  const section = (title: string) =>
    content.push({
      stack: [
        line(title, 8.8, 8.7104, { bold: true }),
        {
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: width,
              y2: 0,
              lineWidth: 0.5,
              lineColor: "#5b5b5b",
            },
          ],
        },
      ],
      unbreakable: true,
      headlineLevel: 1,
      margin: [
        0,
        title === "PROJECTS"
          ? 7.19285
          : title === "EDUCATION"
            ? 6.83275
            : title === "CERTIFICATIONS"
              ? 3.95275
              : 7.5683,
        0,
        title === "SKILLS"
          ? 5.8213
          : title === "CERTIFICATIONS"
            ? 5.90055
            : 6.2334,
      ],
    });
  const bullets = (items: string[]) => {
    for (const text of items.map(clean).filter(Boolean))
      content.push({
        columns: [
          {
            text: "-",
            font: "Helvetica",
            fontSize: 10,
            width: 11,
            relativePosition: { x: 0, y: -1.06715 },
          },
          {
            ...line(text, 8.95, 10.2),
            text: text
              .split(/(\S*-\S*)/g)
              .map((part, index) => ({ text: part, noWrap: index % 2 === 1 })),
            leadingIndent: -1.67,
          },
        ],
        columnGap: 0,
        margin: [0, 0, 0, 0.8],
      });
  };
  const entry = (name: string, location: string, role: string, dates: string) =>
    ({
      stack: [
        {
          columns: [
            line(name, 10.2, 10.9464, { bold: true }),
            line(location, 9.2, 10.9464, {
              alignment: "right",
              relativePosition: { x: 0, y: -0.317 },
            }),
          ],
        },
        {
          columns: [
            line(role, 9.4, 10.4, {
              italics: true,
              color: "#333333",
              width: "*",
            }),
            line(dates, 9.2, 10.4, {
              italics: true,
              color: "#333333",
              alignment: "right",
              width: "auto",
              relativePosition: { x: 0, y: -0.0634 },
            }),
          ],
        },
      ],
      unbreakable: true,
      headlineLevel: 2,
      margin: [32.16, 0, 32.16, 1.6769],
    }) satisfies Content;

  if (resume.skillGroups.some((group) => group.skills.length)) {
    section("SKILLS");
    for (const group of resume.skillGroups)
      if (group.skills.length)
        content.push({
          columns: [
            line(`${group.name}:`, 8.9, 10, { bold: true, width: 92.16 }),
            line(join(group.skills, ", "), 8.9, 10),
          ],
          columnGap: 0,
          margin: [32.16, 0, 32.16, 0],
        });
  }
  if (resume.experience.length) {
    section("EXPERIENCE");
    resume.experience.forEach((job, index) => {
      if (index) content.push({ canvas: [], margin: [0, 3.636, 0, 0] });
      content.push(
        entry(
          job.employer,
          job.location,
          job.role,
          join([job.startDate, job.current ? "Present" : job.endDate], " - "),
        ),
      );
      bullets(job.accomplishments);
    });
  }
  if (resume.selectedWork.length) {
    section("PROJECTS");
    for (const project of resume.selectedWork) {
      content.push(
        line(project.name, 10.2, 10.9464, { bold: true, headlineLevel: 2 }),
      );
      if (project.techStack.length)
        content.push(
          line(join(project.techStack, ", "), 9.4, 9.7739, {
            italics: true,
            color: "#333333",
          }),
        );
      const links = [
        ...(project.url
          ? [{ text: `Live: ${displayUrl(project.url)}`, link: project.url }]
          : []),
        ...(project.githubUrl
          ? [
              {
                text: `GitHub: ${displayUrl(project.githubUrl)}`,
                link: project.githubUrl,
              },
            ]
          : []),
      ];
      if (links.length)
        content.push({
          text: links.flatMap((link, index) => [
            ...(index ? [{ text: " | " }] : []),
            link,
          ]),
          fontSize: 8.5,
          lineHeight: 10 / (8.5 * 0.9),
          color: "#333333",
          margin: [0, 0, 0, 1.54265],
        });
      bullets(
        project.accomplishments.length
          ? project.accomplishments
          : project.summary.trim()
            ? [project.summary]
            : [],
      );
    }
  }
  if (resume.education.length) {
    section("EDUCATION");
    for (const school of resume.education) {
      content.push(
        entry(
          school.school,
          school.location,
          join([school.degree, school.field], ", "),
          join([school.startDate, school.endDate], " - "),
        ),
      );
      bullets(school.details);
    }
  }
  if (resume.certifications.length) {
    section("CERTIFICATIONS");
    for (const cert of resume.certifications)
      content.push(
        line(
          join([join([cert.name, cert.issuer], ", "), cert.date]),
          9.15,
          11.9,
        ),
      );
  }
  return {
    pageSize: "LETTER",
    pageMargins: [43.44, 40.017, 43.44, 36],
    info: {
      title: `${clean(resume.fullName)} - Resume`,
      author: clean(resume.fullName),
    },
    defaultStyle: { font: "Times", fontSize: 8.95, color: "#111827" },
    content,
    pageBreakBefore: (node, container) =>
      !!node.headlineLevel && container.getFollowingNodesOnPage().length === 0,
  };
}

export async function generateResumePdf(resume: Resume) {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("./fonts/times"),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  pdfMake.addFonts({
    Times: {
      normal: "Times-Roman",
      bold: "Times-Bold",
      italics: "Times-Italic",
      bolditalics: "Times-BoldItalic",
    },
    Helvetica: {
      normal: "Helvetica",
      bold: "Helvetica",
      italics: "Helvetica",
      bolditalics: "Helvetica",
    },
  });
  const blob = await pdfMake.createPdf(resumeDocument(resume)).getBlob();
  const filename = `${resume.fullName.trim().replace(/[^\p{L}\p{N}]+/gu, "-") || "Resume"}-Resume.pdf`;
  return { blob, filename };
}

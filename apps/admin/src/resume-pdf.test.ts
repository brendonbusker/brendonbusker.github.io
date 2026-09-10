import { expect, it } from "vitest";
import source from "../../site/src/data/resume.json";
import { resumeSchema } from "@brendon/shared";
import { resumeDocument, reviewResume } from "./resume-pdf";

function visibleText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(visibleText).join("");
  if (!value || typeof value !== "object") return "";
  if ("text" in value) return visibleText(value.text);
  return Object.values(value).map(visibleText).join("\n");
}

it("includes every résumé section in reading order and excludes private contact information", () => {
  const resume = resumeSchema.parse(source);
  resume.summary = "WEBSITE-ONLY-SUMMARY";
  resume.experience[0]!.description = "WEBSITE-ONLY-DESCRIPTION";
  resume.links.push({
    label: "Private phone",
    value: "PRIVATE-NUMBER",
    url: "",
    public: false,
  });
  const doc = resumeDocument(resume);
  const text = JSON.stringify(doc);
  expect(text).not.toContain("PRIVATE-NUMBER");
  for (const section of [
    "SKILLS",
    "EXPERIENCE",
    "PROJECTS",
    "EDUCATION",
    "CERTIFICATIONS",
  ])
    expect(text).toContain(section);
  for (const job of resume.experience)
    for (const bullet of job.accomplishments)
      expect(visibleText(doc.content)).toContain(
        bullet.replace(/[\u2010-\u2015\u2212]/g, "-"),
      );
  for (const project of resume.selectedWork)
    for (const bullet of project.accomplishments)
      expect(visibleText(doc.content)).toContain(bullet);
  expect(text).not.toContain("WEBSITE-ONLY-");
  expect(text).not.toContain("Professional Summary");
  expect(text.indexOf('"SKILLS"')).toBeLessThan(text.indexOf('"EXPERIENCE"'));
  expect(text.indexOf('"PROJECTS"')).toBeLessThan(text.indexOf('"EDUCATION"'));
  expect(text.indexOf('"EDUCATION"')).toBeLessThan(
    text.indexOf('"CERTIFICATIONS"'),
  );
  expect(text).toContain("Pokemon");
  expect(text).toContain("Next.js, TypeScript, FastAPI");
  expect(text).toContain(
    "GitHub: github.com/brendonbusker/UltimateIVCalculator-Webapp",
  );
  expect(doc.defaultStyle?.font).toBe("Times");
  expect(doc).not.toHaveProperty("header");
  expect(doc).not.toHaveProperty("footer");
  expect(text).not.toContain('"table"');
});

it("supports older résumé projects and current project/contact edits", () => {
  const resume = resumeSchema.parse({
    ...source,
    selectedWork: [
      {
        id: "old",
        name: "Old project",
        summary: "Legacy project summary",
        url: "",
      },
    ],
  });
  expect(JSON.stringify(resumeDocument(resume))).toContain(
    "Legacy project summary",
  );
  resume.selectedWork[0]!.accomplishments = ["New project accomplishment"];
  resume.links[0]!.value = "changed@example.com";
  const text = JSON.stringify(resumeDocument(resume));
  expect(text).toContain("New project accomplishment");
  expect(text).toContain("changed@example.com");
  expect(text).not.toContain("Legacy project summary");
});

it("preserves supported accents and reports unsupported glyphs instead of losing text", () => {
  const resume = resumeSchema.parse(source);
  resume.selectedWork[0]!.name = "Pokémon calculator";
  expect(JSON.stringify(resumeDocument(resume))).toContain(
    "Pokémon calculator",
  );
  resume.selectedWork[0]!.name = "Calculator 🎮";
  expect(() => resumeDocument(resume)).toThrow("cannot render");
});

it("flags incomplete content without adding unverified claims or mutating the résumé", () => {
  const resume = resumeSchema.parse(source);
  resume.links = [];
  resume.experience[0]!.startDate = "";
  const snapshot = structuredClone(resume);
  expect(reviewResume(resume).join(" ")).toContain("email");
  expect(reviewResume(resume).join(" ")).toContain("dates");
  resumeDocument(resume);
  expect(resume).toEqual(snapshot);
  expect(() => resumeDocument({ ...resume, fullName: " " })).toThrow(
    "Enter your name",
  );
});

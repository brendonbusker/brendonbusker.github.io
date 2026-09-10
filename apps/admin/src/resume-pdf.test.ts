import { expect, it } from "vitest";
import source from "../../site/src/data/resume.json";
import { resumeSchema } from "@brendon/shared";
import { resumeDocument, reviewResume } from "./resume-pdf";

it("includes every résumé section in reading order and excludes private contact information", () => {
  const resume = resumeSchema.parse(source);
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
    "Professional Summary",
    "Experience",
    "Education",
    "Skills",
    "Certifications",
    "Projects",
  ])
    expect(text).toContain(section);
  for (const job of resume.experience)
    for (const bullet of job.accomplishments)
      expect(text).toContain(bullet.replace(/[\u2010-\u2015\u2212]/g, "-"));
  expect(text).toContain("Pokémon");
  expect(doc).not.toHaveProperty("header");
  expect(doc).not.toHaveProperty("footer");
  expect(text).not.toContain('"columns"');
  expect(text).not.toContain('"table"');
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

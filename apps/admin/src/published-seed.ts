import { resumeSchema, siteProfileSchema } from "@brendon/shared";
import resumeData from "../../site/src/data/resume.json";
import siteData from "../../site/src/data/site.json";

export const publishedResume = resumeSchema.parse(resumeData);
export const publishedSite = siteProfileSchema.parse(siteData);

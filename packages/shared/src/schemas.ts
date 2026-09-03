import { z } from "zod";

const safeUrl = z
  .string()
  .url()
  .refine(
    (value) => ["https:", "http:", "mailto:"].includes(new URL(value).protocol),
    "Unsupported URL protocol",
  );
export const slugSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/);
export const socialLinkSchema = z.object({
  label: z.string().min(1).max(40),
  url: safeUrl,
});

export const siteProfileSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  fullName: z.string().min(1).max(100),
  professionalHeadline: z.string().min(1).max(180),
  intro: z.string().min(1).max(1200),
  secondaryIntro: z.string().max(600).optional().default(""),
  socialLinks: z.array(socialLinkSchema).max(10),
  siteTitle: z.string().min(1).max(100),
  siteDescription: z.string().min(1).max(240),
  location: z.string().min(1).max(100).default("Austin, Texas"),
  timezone: z.string().min(1).default("America/Chicago"),
  adminUrl: z.string().url(),
});

export const postSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.string().uuid(),
  title: z.string().min(1).max(180),
  slug: slugSchema,
  publishedAt: isoDateSchema,
  updatedAt: isoDateSchema,
  excerpt: z.string().max(320).optional().default(""),
  body: z.string().min(1).max(250_000),
  status: z.enum(["draft", "published"]).default("draft"),
});

export const projectSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.string().uuid(),
  title: z.string().min(1).max(120),
  slug: slugSchema,
  summary: z.string().min(1).max(320),
  category: z.string().max(80).optional().default(""),
  status: z.string().max(60).optional().default(""),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  liveUrl: safeUrl.optional().or(z.literal("")),
  githubUrl: safeUrl.optional().or(z.literal("")),
  icon: z.string().min(1).max(64),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  techStack: z.array(z.string().max(60)).max(30),
  screenshots: z
    .array(
      z.object({
        src: z.string().startsWith("/"),
        alt: z.string().min(1).max(240),
      }),
    )
    .max(12),
  overview: z.string().max(5000).optional().default(""),
  why: z.string().max(5000).optional().default(""),
  features: z.array(z.string().max(300)).max(30),
  implementation: z.string().max(5000).optional().default(""),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const resumeLinkSchema = z.object({
  label: z.string().min(1).max(50),
  value: z.string().min(1).max(180),
  url: safeUrl.optional().or(z.literal("")),
  public: z.boolean().default(true),
});
export const resumeSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  fullName: z.string().min(1),
  headline: z.string().min(1),
  summary: z.string(),
  links: z.array(resumeLinkSchema),
  experience: z.array(
    z.object({
      id: z.string(),
      employer: z.string(),
      role: z.string(),
      location: z.string().optional().default(""),
      startDate: z.string(),
      endDate: z.string().optional().default(""),
      current: z.boolean(),
      description: z.string().optional().default(""),
      accomplishments: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      id: z.string(),
      school: z.string(),
      degree: z.string(),
      field: z.string().optional().default(""),
      location: z.string().optional().default(""),
      startDate: z.string().optional().default(""),
      endDate: z.string().optional().default(""),
      details: z.array(z.string()).default([]),
    }),
  ),
  certifications: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        issuer: z.string().optional().default(""),
        date: z.string().optional().default(""),
      }),
    )
    .default([]),
  skillGroups: z.array(
    z.object({ id: z.string(), name: z.string(), skills: z.array(z.string()) }),
  ),
  selectedWork: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        summary: z.string(),
        url: safeUrl.optional().or(z.literal("")),
      }),
    )
    .default([]),
  pdfPath: z.string().startsWith("/"),
  updatedAt: isoDateSchema,
});

export const draftSchema = z.object({
  id: z.string().uuid(),
  contentType: z.enum(["post", "project", "homepage", "resume", "settings"]),
  contentKey: z.string().min(1).max(160),
  payload: z.unknown(),
  updatedAt: z.string().optional(),
});
export const publishPayloadSchema = z.object({
  contentType: z.enum(["post", "project", "homepage", "resume"]),
  payload: z.unknown(),
  expectedSha: z.string().optional(),
});
export type SiteProfile = z.infer<typeof siteProfileSchema>;
export type Post = z.infer<typeof postSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Resume = z.infer<typeof resumeSchema>;

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}
export function validateContent(type: string, payload: unknown) {
  if (type === "post") return postSchema.parse(payload);
  if (type === "project") return projectSchema.parse(payload);
  if (type === "homepage") return siteProfileSchema.parse(payload);
  if (type === "resume") return resumeSchema.parse(payload);
  throw new Error("Unsupported content type");
}

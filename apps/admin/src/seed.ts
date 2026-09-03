import type { Post, Project, Resume, SiteProfile } from "@brendon/shared";
export const newPost = (): Post => ({
  schemaVersion: 1,
  id: crypto.randomUUID(),
  title: "",
  slug: "",
  publishedAt: new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
  updatedAt: new Date().toISOString(),
  excerpt: "",
  body: "",
  status: "draft",
});
export const seedProject: Project = {
  schemaVersion: 1,
  id: "dd36582b-12d3-4ab0-87ed-e96f81cc7503",
  title: "Ultimate IV Calculator",
  slug: "ultimate-iv-calculator",
  summary:
    "A generation-aware Pokémon stat calculator that makes the series’ changing mechanics understandable.",
  category: "Web application",
  status: "Live",
  featured: true,
  published: true,
  sortOrder: 1,
  liveUrl: "https://brendonbusker.github.io/UltimateIVCalculator-Webapp/",
  githubUrl: "https://github.com/brendonbusker/UltimateIVCalculator-Webapp",
  icon: "calculator",
  accent: "#315b71",
  techStack: ["Next.js", "TypeScript", "FastAPI"],
  screenshots: [],
  overview:
    "The calculator brings several generations of stat systems into one focused interface.",
  why: "The project began as a desktop-style utility and grew into a browser-based tool that could explain the mechanics instead of merely returning a number.",
  features: [
    "Generation-specific IV, DV, Stat Exp, HP DV, and characteristic logic",
    "Historical stat data across multiple game generations",
  ],
  implementation:
    "The frontend is built with Next.js and TypeScript, with calculation and lookup services exposed through FastAPI.",
  createdAt: "2025-01-01",
  updatedAt: "2026-08-31",
};
export const shinyHuntTrackerProject: Project = {
  schemaVersion: 1,
  id: "932feeb1-05a7-41a4-bcab-6c6da8e6c76d",
  title: "Shiny Hunt Tracker",
  slug: "shiny-hunt-tracker",
  summary:
    "A local-first dashboard for tracking multiple Pokémon shiny hunts, from encounter counts to stream-ready layouts.",
  category: "Web application",
  status: "Live",
  featured: true,
  published: true,
  sortOrder: 2,
  liveUrl: "https://brendonbusker.github.io/shiny-hunt-tracker/",
  githubUrl: "https://github.com/brendonbusker/shiny-hunt-tracker",
  icon: "sparkles",
  accent: "#9a6a22",
  techStack: ["React", "TypeScript", "Vite", "Dexie", "IndexedDB"],
  screenshots: [],
  overview:
    "Shiny Hunt Tracker is a browser-based companion for managing several hunts without losing the context around each one. Every hunt keeps its own count, increment, shortcut, timer, encounter history, sprite, and completion state. Data stays in the browser for a fast, private workflow, with exportable backups for moving or protecting the collection.",
  why: "Long hunts can span many sessions, and a simple click counter loses the timing, pace, history, and setup around the hunt. This tracker keeps that context together without requiring an account or sending hunt data to a server.",
  features: [
    "Multiple simultaneous hunts with independent increments, shortcuts, timers, and encounter histories",
    "Transactional counters with auditable events, undo, pause and resume controls, and crash recovery",
    "Generation-aware shiny sprites through PokéAPI, including explicit Colosseum and XD fallbacks",
    "Per-hunt statistics, configurable stream layouts, and validated JSON backup and restore",
  ],
  implementation:
    "The app uses React and TypeScript with Dexie over IndexedDB for durable local storage. Its repository layer isolates persistence from the interface, while React Router supports the dashboard and capture-friendly Stream Mode. The entire app deploys statically to GitHub Pages with no backend or user account.",
  createdAt: "2026-08-31",
  updatedAt: "2026-09-01",
};
export const seedProjects: Project[] = [seedProject, shinyHuntTrackerProject];
export const newProject = (): Project => ({
  schemaVersion: 1,
  id: crypto.randomUUID(),
  title: "",
  slug: "",
  summary: "",
  category: "Web application",
  status: "In progress",
  featured: false,
  published: false,
  sortOrder: 0,
  liveUrl: "",
  githubUrl: "",
  icon: "folder",
  accent: "#315b71",
  techStack: [],
  screenshots: [],
  overview: "",
  why: "",
  features: [],
  implementation: "",
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString(),
});
export const seedSite: SiteProfile = {
  schemaVersion: 1,
  fullName: "Brendon Busker",
  professionalHeadline:
    "Technical consultant, systems thinker, and hands-on builder.",
  intro:
    "I work where business operations, data, and software meet—turning complicated requirements into systems people can rely on.",
  secondaryIntro:
    "This is my place to keep track of what I’m building, what I’m learning, and the ideas that are still taking shape.",
  socialLinks: [
    { label: "GitHub", url: "https://github.com/brendonbusker" },
    { label: "LinkedIn", url: "https://www.linkedin.com/in/brendonbusker/" },
  ],
  siteTitle: "Brendon Busker",
  siteDescription:
    "The personal website, writing archive, projects, and résumé of Brendon Busker.",
  location: "Austin, Texas",
  timezone: "America/Chicago",
  adminUrl: "https://personal-site-admin.brendonbusker.workers.dev/",
};
export const seedResume: Resume = {
  schemaVersion: 1,
  fullName: "Brendon Busker",
  headline: "Technical Consultant",
  summary:
    "Technical consultant experienced in business systems, data validation, requirements analysis, testing, client training, and production support.",
  links: [
    {
      label: "Email",
      value: "brendonbusker14@gmail.com",
      url: "mailto:brendonbusker14@gmail.com",
      public: true,
    },
    {
      label: "LinkedIn",
      value: "linkedin.com/in/brendonbusker",
      url: "https://www.linkedin.com/in/brendonbusker/",
      public: true,
    },
  ],
  experience: [
    {
      id: "quorum",
      employer: "Quorum Software",
      role: "Technical Consultant",
      location: "Houston, Texas",
      startDate: "July 2024",
      endDate: "",
      current: true,
      description: "Enterprise implementation and client delivery.",
      accomplishments: [
        "Support full-scale implementations, custom enhancements, and upgrade projects for Quorum TIPS Gathering clients.",
        "Write validation queries in Oracle PL/SQL and Microsoft SQL Server to investigate data, configuration, process, and migration issues.",
        "Lead QA, UAT, and pre-production testing and support production go-lives.",
      ],
    },
  ],
  education: [
    {
      id: "baylor",
      school: "Baylor University",
      degree: "BBA",
      field: "Management Information Systems",
      location: "Waco, Texas",
      startDate: "August 2020",
      endDate: "May 2024",
      details: [],
    },
  ],
  certifications: [
    {
      id: "google",
      name: "Google Cybersecurity Specialization",
      issuer: "Coursera",
      date: "May 2023",
    },
    {
      id: "analytics",
      name: "Business Analytics Certificate",
      issuer: "Baylor University",
      date: "May 2024",
    },
  ],
  skillGroups: [
    {
      id: "data",
      name: "Data & Analysis",
      skills: [
        "Oracle PL/SQL",
        "Microsoft SQL Server",
        "Excel",
        "Tableau",
        "Data Validation",
        "ETL",
      ],
    },
    {
      id: "systems",
      name: "Business Systems",
      skills: [
        "Quorum TIPS",
        "FLOWCAL",
        "Salesforce",
        "Azure DevOps",
        "Requirements Gathering",
        "QA/UAT",
        "Production Support",
      ],
    },
    {
      id: "technical",
      name: "Technical",
      skills: ["Python", "TypeScript", "Next.js", "FastAPI"],
    },
  ],
  selectedWork: [
    {
      id: "iv",
      name: "Ultimate IV Calculator Webapp",
      summary: "A generation-aware Pokémon IV calculator.",
      url: "https://brendonbusker.github.io/UltimateIVCalculator-Webapp/",
    },
  ],
  pdfPath: "/resume/Brendon-Busker-Resume.pdf",
  updatedAt: "2026-08-31",
};

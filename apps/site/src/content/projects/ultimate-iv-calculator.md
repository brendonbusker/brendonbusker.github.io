---
id: "dd36582b-12d3-4ab0-87ed-e96f81cc7503"
title: "Ultimate IV Calculator"
slug: "ultimate-iv-calculator"
summary: "A generation-aware Pokémon IV calculator I built in college that I've ported over as a webapp."
category: "Web application"
status: "Live"
featured: true
published: true
sortOrder: 1
liveUrl: "https://brendonbusker.github.io/UltimateIVCalculator-Webapp/"
githubUrl: "https://github.com/brendonbusker/UltimateIVCalculator-Webapp"
icon: "calculator"
accent: "#315b71"
techStack: ["Next.js","TypeScript","FastAPI"]
screenshots: [{"src":"/uploads/projects/ultimate-iv-calculator/1788450548239-c8d30580-855c-4f93-8ad0-be3a7bcfbe27.webp","alt":"cover"}]
why: "The underlying code behind this tool was originally built simply as a fun project to do while I learned to code in college. I decided to port it as a web application because it eventually grew from a fun project to something I genuinely considered better than other online calculators."
features: ["Generation-specific IV, DV, Stat Exp, HP DV, and characteristic logic","Historical stat data across multiple game generations","Cached lookups and a static GitHub Pages deployment path","Production-oriented security headers, origin controls, and rate limiting defaults"]
implementation: "The frontend is built with Next.js and TypeScript, with calculation and lookup services exposed through FastAPI. The deployment supports a fully static public path while retaining a hardened API configuration for hosted environments."
createdAt: 2025-01-01
updatedAt: 2026-09-03
---

The calculator aims to make the IV calculation experience a little bit less annoying than traditional calculators you see online. Everything is concise and has more of a modern look imo. I made sure to include compatibility with all generations and PokeAPI should theoretically keep this tool up to date at all times.

---
id: "dd36582b-12d3-4ab0-87ed-e96f81cc7503"
title: "Ultimate IV Calculator"
slug: "ultimate-iv-calculator"
summary: "A generation-aware Pokémon stat calculator that makes the series’ changing mechanics understandable."
category: "Web application"
status: "Live"
featured: true
published: true
sortOrder: 1
liveUrl: "https://brendonbusker.github.io/UltimateIVCalculator-Webapp/"
githubUrl: "https://github.com/brendonbusker/UltimateIVCalculator-Webapp"
icon: "calculator"
accent: "#315b71"
techStack: ["Next.js", "TypeScript", "FastAPI"]
screenshots: []
why: "The project began as a desktop-style utility and grew into a browser-based tool that could explain the mechanics instead of merely returning a number."
features:
  - "Generation-specific IV, DV, Stat Exp, HP DV, and characteristic logic"
  - "Historical stat data across multiple game generations"
  - "Cached lookups and a static GitHub Pages deployment path"
  - "Production-oriented security headers, origin controls, and rate limiting defaults"
implementation: "The frontend is built with Next.js and TypeScript, with calculation and lookup services exposed through FastAPI. The deployment supports a fully static public path while retaining a hardened API configuration for hosted environments."
createdAt: 2025-01-01
updatedAt: 2026-08-31
---

The calculator brings several generations of stat systems into one focused interface. Rather than flattening every game into the newest rules, it preserves the differences that make older generations interesting—and difficult to calculate by hand.

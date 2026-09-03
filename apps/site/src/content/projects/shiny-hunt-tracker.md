---
id: "932feeb1-05a7-41a4-bcab-6c6da8e6c76d"
title: "Shiny Hunt Tracker"
slug: "shiny-hunt-tracker"
summary: "A local-first dashboard for tracking multiple Pokémon shiny hunts, from encounter counts to stream-ready layouts."
category: "Web application"
status: "Live"
featured: true
published: true
sortOrder: 2
liveUrl: "https://brendonbusker.github.io/shiny-hunt-tracker/"
githubUrl: "https://github.com/brendonbusker/shiny-hunt-tracker"
icon: "sparkles"
accent: "#9a6a22"
techStack: ["React","TypeScript","Vite","Dexie","IndexedDB"]
screenshots: [{"src":"/uploads/projects/shiny-hunt-tracker/1788451980242-5500c18f-b513-48c5-b91c-8635a864c32d.webp","alt":"cover"}]
why: "I built this because I wanted a spot where I could keep all of my hunts logged in the same spot where I could track encounters and keep stats as well. Found a shiny shadow suicune in Colosseum while I tested it which was pretty sick. If you want stats on all your hunts that are very accurate then this will be your best friend."
features: ["Multiple simultaneous hunts with independent increments, shortcuts, timers, and encounter histories","Transactional counters with auditable events, undo, pause and resume controls, and crash recovery","Generation-aware shiny sprites through PokéAPI, including explicit Colosseum and XD fallbacks","Per-hunt statistics, configurable stream layouts, and validated JSON backup and restore"]
implementation: "The app uses React and TypeScript with Dexie over IndexedDB for durable local storage. Its repository layer isolates persistence from the interface, while React Router supports the dashboard and capture-friendly Stream Mode. The entire app deploys statically to GitHub Pages with no backend or user account."
createdAt: 2026-08-31
updatedAt: 2026-09-03
---

Shiny Hunt Tracker is a browser-based companion for managing several hunts without losing the context around each one. Every hunt keeps its own count, increment, shortcut, timer, encounter history, sprite, and completion state. Data stays in the browser for a fast, private workflow, with exportable backups for moving or protecting the collection.

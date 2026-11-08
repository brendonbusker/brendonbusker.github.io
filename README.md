# Brendon Busker — Personal Website

[Visit my website](https://brendonbusker.github.io)

This is the source for my personal website: a place to share what I'm building, write about what I've been working on, keep my résumé current, and collect recipes I actually make.

I wanted a site that felt like my own space and that I could keep updating as my interests and projects grew. That meant working on both the pages people visit and the tools I use to publish them. Behind the public website is a custom private content-management system where I can write, upload photos, manage projects, and publish updates without editing source files each time.

## The website

The public design centers on typography, spacing, and a clear reading order. Newsreader headings and Inter body text give it an editorial feel, with subtle rules between sections and project cards for browsing my work. Visitors can choose from several themes, and the layout adapts to phones as well as larger screens.

The main sections bring together different parts of what I do:

- **Blog:** a searchable archive of writing and updates, with permanent post links and an RSS feed.
- **Projects:** a portfolio with screenshots, links, and detail views that can be opened directly and navigated with the keyboard.
- **Recipes:** a searchable collection with Breakfast, Lunch, Dinner, and Snack labels, optional cooking times and servings, photos I choose for the covers, and printable recipe pages.
- **Résumé:** a web version alongside a downloadable PDF that I can generate and update through the admin.

## Behind the scenes

The public site uses **Astro and TypeScript** and is built into static pages hosted on **GitHub Pages**. Blog and recipe search run in the browser over published content. Visitors can read the site without depending on the private publishing service being online.

The admin uses **React, Fluent UI, and Tiptap**, with a Word-style editor for formatting text, pasting recipes or articles, adding tables, and working with photos and animated GIFs. **Cloudflare Workers** serves the admin and its API, while **D1** stores private drafts and sessions. Shared **Zod** schemas keep content validation consistent between the editor, publishing API, and website.

Publishing turns an edit into a Git commit, which triggers the public site's build. That gives published content a version history while keeping everyday editing in the admin. A status banner follows the build and checks the deployed site before reporting that an update is live.

## The work beyond the pages

A lot of the work has gone into making editing dependable: autosaving drafts, preserving text when a session expires, waiting for image uploads before publishing, and checking for newer published edits before overwriting a file. Recipe cover photos are stored separately from the images inside the instructions, and animated GIF uploads preserve their animation.

The résumé tools generate PDFs in the browser using locally bundled font data. I can preview and download a document, then publish the PDF and web résumé independently. Theme settings, page introductions, project visibility, and homepage content are also editable through the CMS.

The publishing service includes server-side authentication, session expiry, CSRF protection, login rate limits, and validation of content and upload destinations. Automated unit and browser tests cover the publishing flows, editor recovery, search, themes, mobile layouts, and keyboard interactions.

This repository holds the public site in `apps/site`, the publishing application in `apps/admin`, and their shared schemas and utilities in `packages/shared`. The [project handoff](PROJECT_HANDOFF.md) contains maintenance notes and development history; [kickoff.txt](kickoff.txt) records the original brief. The site continues to grow as I use it and find things I want to add or improve.

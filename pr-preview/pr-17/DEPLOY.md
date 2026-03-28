# Deploy: how private repos connect to this Pages site

This repo is the **public** GitHub Pages site. Private subsite repos push built content here; **Build root index** turns that into the root `index.html`, nav links, and pill styling (via each subsite’s `design-tokens.json` when present).

## What each private repo should do

Every subsite lives in its **own** private repo. That repo is responsible for two things:

1. **Deploy to this repo**  
   - Build the site in CI.  
   - Push the output into **this** repo under a folder named **like the private repo** (e.g. `discogs-collection/`).  
   - Include **`design-tokens.json`** there if you want a custom nav pill label or colors (see below).  
   - Do **not** overwrite this repo’s root `index.html`; only add or update your subfolder.

2. **Register the subsite on this repo**  
   - A small **sync** workflow (e.g. `sync_variables_to_pages.yml` in the private repo) runs on a schedule and/or `workflow_dispatch`.  
   - It ensures **`PRIVATE_REPOS`** on this repo includes your repo’s name (read → add if missing → write).  
   - It uses **`PAGES_DEPLOY_TOKEN`**: a PAT with **Actions variables** read/write on **this** repo, plus permission to push contents for deploy.

Together, deploy brings the files; sync makes **Build root index** know to list your folder.

---

## Repository variable: `PRIVATE_REPOS`

Comma-separated list of private repo **names** that are subsites (e.g. `discogs-collection,album-scraper`). **Build root index** uses it to know which subfolders to include in the root index.

## `design-tokens.json` (per subsite)

Each name in `PRIVATE_REPOS` should have a folder `<repo-name>/` with at least `index.html`. For nav, **Build root index** reads `<repo-name>/design-tokens.json` if present:

- **`pill.label`** — text on the root project pill. If missing or empty, the workflow uses the **subpath uppercased** (e.g. `discogs-collection` → `DISCOGS-COLLECTION`).  
- **`pill.background`**, **`pill.border`**, **`pill.text`**, and hover fields — optional; default orchid/slate pill styles apply when omitted.

Private repos typically generate this file as part of deploy.

## Workflows in this repo

- **Build root index** (`.github/workflows/build-root-index.yml`)  
  Runs on push to `main` and on `workflow_dispatch`. Reads `PRIVATE_REPOS`, loads each subsite’s `design-tokens.json` for labels and pill CSS, writes `index.html`, and commits and pushes if changed.  
  **Optional secret:** `BUILD_VARIABLES_TOKEN` — PAT with **repo** scope if `gh variable list` needs it to read `PRIVATE_REPOS`.  
  Pushes that **only** change `pr-preview/**` are ignored so this workflow does not fight the preview action.

- **PR preview on Pages** (`.github/workflows/pr_preview_pages.yml`)  
  On each pull request (open / sync / reopen), publishes the **repository root** of the PR head under `https://<owner>.github.io/pr-preview/pr-<number>/` (user-site layout; see the comment on the PR from the action). On **close** (merged or not), removes that folder from `main`.  
  **Settings:** **Actions → General → Workflow permissions** must allow **Read and write**. **Pages** must use **Deploy from a branch** (this site uses `main` / root). Previews from **forks** are not supported by the action (v1).

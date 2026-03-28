# Deploy: how private repos connect to this Pages site

This repo is the **public** user site (`username.github.io`). Subsite folders and workflows publish the **root** `https://<username>.github.io/` and paths like `/<subsite>/`.

## GitHub Pages on this repo

In **Settings → Pages**:

- **Source:** Deploy from a branch.
- **Branch:** `main`, folder **/** (repository root).

Everything in `main` at the repo root is what Pages serves. Private subsite repos push into **named subfolders** here (not the root `index.html`); **Build root index** regenerates that root `index.html` from `PRIVATE_REPOS` and each subsite’s `design-tokens.json`.

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

Deploy brings the files; sync makes **Build root index** include your folder in the variable list.

---

## Repository variable: `PRIVATE_REPOS`

Comma-separated list of private repo **names** that are subsites (e.g. `discogs-collection,album-scraper`). **Build root index** uses it to know which subfolders get nav pills on the root page.

## `design-tokens.json` (per subsite)

For each name in `PRIVATE_REPOS`, expect a folder `<repo-name>/` with at least `index.html`. For labels and pill CSS, **Build root index** reads `<repo-name>/design-tokens.json` if present:

- **`pill.label`** — nav pill text. If missing or empty, the workflow uppercases the folder name (e.g. `discogs-collection` → `DISCOGS-COLLECTION`).  
- **`pill.background`**, **`pill.border`**, **`pill.text`** — optional.  
- **Hover:** `pill.hover_background`, `pill.hover_text`, `pill.hover_border`, `pill.hover_shadow` — optional; default orchid/slate styling applies when omitted.

Private repos usually generate this file during deploy.

## Workflows in this repo

- **Build root index** (`.github/workflows/build-root-index.yml`)  
  - **When:** push to `main` (except commits that only touch `pr-preview/**`) and `workflow_dispatch`.  
  - **What:** Reads `PRIVATE_REPOS` from the job (`vars.PRIVATE_REPOS`). If that is empty, falls back to `gh variable list` with the workflow token. For each listed repo, loads `<repo>/design-tokens.json` if present, writes root `index.html`, and commits only if it changed.

- **PR preview on Pages** (`.github/workflows/pr_preview_pages.yml`)  
  Uses [rossjrw/pr-preview-action](https://github.com/rossjrw/pr-preview-action) to put the PR head’s repo root under `/pr-preview/pr-<number>/` on the **same** `main` Pages deployment (see the bot comment on the PR for the preview URL). On PR close, removes that folder from `main`.  
  **Requirements:** **Actions → General → Workflow permissions** → **Read and write** for `contents` (and `pull-requests` for the action). Same Pages branch/root settings as above. Previews from **fork** PRs are not supported (v1).

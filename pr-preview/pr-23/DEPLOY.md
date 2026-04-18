# Deploy: how private repos connect to this Pages site

This repo is the **public** GitHub Pages site. The doc has two parts: what **private subsite repos** must do, then what **this repo** uses to turn their folders into the root `index.html` and nav (via `PRIVATE_REPOS` and each subsite’s `project_label.json`).

## What each private repo should do

Every subsite lives in its **own** private repo. That repo is responsible for two things:

1. **Deploy to this repo**  
   - Build the site in CI.  
   - Push the output into **this** repo under a folder named **like the private repo** (e.g. `my-project/`).  
   - Include **`project_label.json`** there (nav pill text), generated in that repo’s CI with the same rules as its subsite title (see **How this repo builds the root page**).  
   - Do **not** overwrite this repo’s root `index.html`; only add or update your subfolder.

2. **Register the subsite on this repo**  
   - A small **sync** workflow (e.g. `sync_variables_to_pages.yml` in the private repo) runs on a schedule and/or `workflow_dispatch`.  
   - It ensures **`PRIVATE_REPOS`** on this repo includes your repo’s name (read → add if missing → write).  
   - It uses **`PAGES_DEPLOY_TOKEN`**: a PAT with **Actions variables** read/write on **this** repo, plus permission to push contents for deploy.

Together, deploy brings the files; sync makes **Build root index** know to list your folder.

## How this repo builds the root page

Once **`main`** has the subsite folders and **`PRIVATE_REPOS`** is up to date, everything below is **on this public repo only**: the variable, the label file per folder, and the workflows that regenerate the landing page.

### `PRIVATE_REPOS` (Actions variable)

Comma-separated list of private repo **names** that are subsites (e.g. `project-a,project-b`). **Build root index** uses it to know which subfolders to include in the root index.

### `project_label.json` (per subsite folder)

Each name in `PRIVATE_REPOS` should have a folder `<repo-name>/` with at least `index.html`. For nav, **Build root index** reads `<repo-name>/project_label.json` if present:

- **`label`** — text on the root project pill. If the file is missing or `label` is empty, the workflow uses the **subpath uppercased** (e.g. `my-vinyl` → `MY-VINYL`).

Pill **styling** (colors, hover) is fixed in **Build root index** as static CSS: the same values that used to live in each subsite’s `design-tokens.json` under `pill.*` (slate gradient shell, orchid text, hover chrome).

Private repos generate `project_label.json` as part of deploy (see each repo’s `DEPLOY.md`).

### Workflows

- **Build root index** (`.github/workflows/build-root-index.yml`)  
  Runs on push to `main` and on `workflow_dispatch`. Reads `PRIVATE_REPOS`, loads each subsite’s `project_label.json` for link text, writes `index.html`, and commits and pushes if changed.  
  **Optional secret:** `BUILD_VARIABLES_TOKEN` — PAT with **repo** scope if `gh variable list` needs it to read `PRIVATE_REPOS`.  
  Pushes that **only** change `pr-preview/**` are ignored so this workflow does not fight the preview action.

- **PR preview on Pages** (`.github/workflows/pr_preview_pages.yml`)  
  On each pull request (open / sync / reopen), publishes the **repository root** of the PR head under `https://<owner>.github.io/pr-preview/pr-<number>/` (user-site layout; see the comment on the PR from the action). On **close** (merged or not), removes that folder from `main`.  
  **Settings:** **Actions → General → Workflow permissions** must allow **Read and write**. **Pages** must use **Deploy from a branch** (this site uses `main` / root). Previews from **forks** are not supported by the action (v1).

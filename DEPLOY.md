# Deploy: how private repos connect to this Pages site

This repo is the **public** GitHub Pages site. Subsite content, nav **pill labels**, and **pill styling** come from what each private repo publishes under its folder (especially `design-tokens.json`). This file describes the contract.

## Variables in this repo (public)

- **`PRIVATE_REPOS`**  
  Comma-separated list of private repo **names** that are subsites (e.g. `discogs-collection,album-scraper`). The **Build root index** workflow reads this to know which subfolders exist in this repo. It does **not** use per-repo `*_PILL_LABEL` variables.

- **`design-tokens.json` (per subsite)**  
  Each entry in `PRIVATE_REPOS` should have a folder `<repo-name>/` containing at least `index.html`. For nav links, **Build root index** reads `<repo-name>/design-tokens.json` if present:
  - **`pill.label`** — text on the root project pill. If missing or empty, the workflow uses the **subpath uppercased** (e.g. `discogs-collection` → `DISCOGS-COLLECTION`).
  - **`pill.background`**, **`pill.border`**, **`pill.text`**, hover fields — optional; default orchid/slate pill styles apply when omitted.

  Private repos (e.g. Discogs collection) generate this file when they deploy.

## What each private repo must do

1. **Deploy workflow**  
   - Build its site.  
   - Push content into **this** repo under a folder named **like the repo** (e.g. `discogs-collection/`).  
   - Include **`design-tokens.json`** in that folder if you want a custom pill label or styling.  
   - Do **not** overwrite this repo’s root `index.html`; only add/update its own subfolder.

2. **Sync workflow** (e.g. `sync_variables_to_pages.yml` in the private repo)  
   - Runs on schedule and/or `workflow_dispatch`.  
   - Ensures this repo’s **`PRIVATE_REPOS`** includes that private repo’s name (read → add if missing → write).  
   - It **does not** set `*_PILL_LABEL` variables (legacy).  
   - Uses **`PAGES_DEPLOY_TOKEN`** (PAT with **Actions variables** read/write on **this** repo, plus contents push for deploy).

## This repo’s workflows

- **Build root index** (`.github/workflows/build-root-index.yml`)  
  Runs on push to `main` and on `workflow_dispatch`. Reads `PRIVATE_REPOS`, loads each subsite’s `design-tokens.json` for nav labels and pill CSS, generates `index.html`, and commits and pushes if changed.  
  **Optional secret:** `BUILD_VARIABLES_TOKEN` — PAT with **repo** scope if `gh variable list` needs it for `PRIVATE_REPOS`.  
  Pushes that **only** change `pr-preview/**` are ignored so this workflow does not fight the preview action.

- **PR preview on Pages** (`.github/workflows/pr_preview_pages.yml`)  
  On each pull request (open / sync / reopen), publishes the **repository root** of the PR head under `https://<owner>.github.io/pr-preview/pr-<number>/` (user-site layout; see comment on the PR from the action). On **close** (merged or not), removes that folder from `main`.  
  **Settings:** **Actions → General → Workflow permissions** must allow **Read and write**. **Pages** must use **Deploy from a branch** (this site uses `main` / root). Previews from **forks** are not supported by the action (v1).

## Adding a new private subsite

1. In the new repo: add a deploy workflow that pushes its build output to this repo under a folder named like the repo (e.g. `my-new-app/`), including **`design-tokens.json`** with at least `pill.label` if you want a specific nav label.  
2. In the new repo: add the sync workflow (copy from e.g. `discogs-collection`), set `PAGES_REPO` to your Pages repo, and use **`PAGES_DEPLOY_TOKEN`** (PAT: contents + Actions variables read/write on the Pages repo).  
3. Run the sync workflow once. It will add the repo name to **`PRIVATE_REPOS`** here.  
4. After the next **Build root index** run, the root page will list the new project.

### Legacy GitHub variables

Older setups used **`{repo}_PILL_LABEL`** Action variables on this repo. They are **no longer read** by Build root index. You can delete those variables after subsites publish `pill.label` in `design-tokens.json`.

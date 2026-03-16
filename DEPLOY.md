# Deploy: how private repos connect to this Pages site

This repo is the **public** GitHub Pages site. Subsite content and pill labels are driven by **private** repos that push here and sync variables. This file is the single source of truth for the contract.

## Variables in this repo (public)

- **`PRIVATE_REPOS`**  
  Comma-separated list of private repo **names** that are subsites (e.g. `discogs-collection,album-scraper`). The **Build root index** workflow reads this and, for each name, reads `{name}_PILL_LABEL` to build the nav. Updated automatically by each private repo’s sync workflow when they register.

- **`{repo_name}_PILL_LABEL`**  
  One per subsite. GitHub variable names allow only letters, numbers, and underscores, so hyphens in the repo name are stored as underscores (e.g. `discogs_collection_PILL_LABEL` for repo `discogs-collection`). The build-root-index workflow converts back when generating links. Subpath/URL is the real repo name (e.g. `/discogs-collection/`). Set/updated by each private repo’s sync workflow.

## What each private repo must do

1. **Deploy workflow**  
   - Build its site.  
   - Push content into **this** repo under a folder named **like the repo** (e.g. `discogs-collection/`).  
   - Do **not** overwrite this repo’s root `index.html`; only add/update its own subfolder.

2. **Sync workflow** (e.g. `sync-variables-pages-repo.yml`)  
   - Runs on schedule and/or `workflow_dispatch`.  
   - Reads the private repo’s pill label (e.g. variable `PAGES_SUBPATH_LABEL`).  
   - Calls the GitHub API to create/update **this** repo’s variable `{repo_name}_PILL_LABEL`.  
   - Ensures this repo’s `PRIVATE_REPOS` includes that repo name (read → add if missing → write).  
   - Uses the same PAT as deploy: **`PAGES_DEPLOY_TOKEN`** (needs **Actions variables read/write** on **this** repo in addition to contents push).

## This repo’s workflows

- **Build root index** (`.github/workflows/build-root-index.yml`)  
  Runs on push to `main` and on `workflow_dispatch`. Reads `PRIVATE_REPOS` and each `{repo}_PILL_LABEL`, generates `index.html`, and commits and pushes if changed. So when a private repo pushes subsite content, the push triggers this and the root nav stays in sync with variables.

## Adding a new private subsite

1. In the new repo: add a deploy workflow that pushes its build output to this repo under a folder named like the repo (e.g. `my-new-app/`).  
2. In the new repo: add the sync workflow (copy from e.g. `discogs-collection`), set `PAGES_REPO` to your Pages repo, and use the same **`PAGES_DEPLOY_TOKEN`** secret as for deploy (PAT needs contents + Actions variables read/write on the Pages repo).  
3. Run the sync workflow once (or wait for schedule). It will set `{repo_name}_PILL_LABEL` and add the repo to `PRIVATE_REPOS` here.  
4. No change needed in this repo’s config; the build-root-index workflow discovers subsites from `PRIVATE_REPOS` and variable names.

# Contentstack automation

## Overview

- **`npm run automate:manifest`** — Creates content types from [`scripts/content-types.manifest.json`](scripts/content-types.manifest.json) (if missing) and runs **seed** `entries`. Resolves `__REF__` and `__TAX_TERMS__` placeholders; records entry UIDs in memory in manifest order.
- **`npm run automate:entries:periodic`** — **Does not** create content types. For each `contentTypes[]` item with `periodic.enabled`, creates `count` new entries (default **1**) from `periodic.entryTemplate` or the last seed entry, with a **unique** `title`. Resolves `__REF__` via the Management API (`first` / `latest` entry per referenced type).

Requires **Node.js 20+** (`node --env-file=.env`).

## Manifest

- **`useDefaultTitleSchema: true`** — Adds the standard unique `title` text field, then any **`fields[]`** expanded to real CMA schema ([shorthand module](scripts/lib/schema-from-fields.mjs)).
- **`schema[]`** — If set, used as-is (full override); no automatic title field unless included.
- **Order** — Referenced content types must appear **before** types that use `__REF__:their_uid:first|latest`.
- **`periodic`** — Optional block:
  - `enabled: true`
  - **`count`** — optional **number**. If set (e.g. `1`), it **overrides** both **`CONTENTSTACK_PERIODIC_COUNT`** and **`defaults.periodicCount`**. Omit `count` to use env (*highest priority among globals*), then `defaults.periodicCount`, then `1`.
  - `entryTemplate` — optional; falls back to last item in `entries[]`.
- **`periodicOnly: true`** — Skipped by `automate:manifest` bootstrap (types created elsewhere).

### Shorthand `fields` (`data_type`)

Supported shorthand: `text`, `textarea`, `markdown` (emitted as CMA `text` + `field_metadata.markdown`), `number`, `boolean`, `date` (emitted as CMA `isodate`), `link`, `file`, `json_rte` / `json`, `rich_text`, `reference`, `group`, `blocks`, `taxonomy` (see env below).

Unsupported or stack-specific shapes: use full **`schema[]`** on the content type.

### Placeholders (seed entries)

| Pattern | Meaning |
|---------|---------|
| `__REF__:<content_type_uid>:first` | First entry UID recorded for that type in this bootstrap run |
| `__REF__:<content_type_uid>:latest` | Latest entry UID in this run |
| `__TAX_TERMS__:<field_uid>` | Expands to term UIDs from env `CONTENTSTACK_TAXONOMY_TERMS_<FIELDUID>` (uppercase, non-alphanumerics → `_`), comma-separated |

### Taxonomy fields

For each taxonomy field `uid` (e.g. `categories`):

- `CONTENTSTACK_TAXONOMY_UID_CATEGORIES` — taxonomy definition UID in the stack, **or** set a single `CONTENTSTACK_TAXONOMY_UID` if one taxonomy applies to all shorthand fields.
- `CONTENTSTACK_TAXONOMY_TERMS_CATEGORIES` — comma-separated **term** UIDs for seed/periodic payloads using `__TAX_TERMS__:categories`.

### Environment variables (scripts)

Variables you **do not use** can be omitted. **`Recommended`** rows should match your stack even though the scripts supply fallbacks. **`Optional`** rows are for specific features only (e.g. taxonomy env when you have no taxonomy fields).

**Required** (any `npm run automate:*` that talks to the CMA):

| Variable | Purpose |
|----------|---------|
| `CONTENTSTACK_MANAGEMENT_TOKEN` | Management token |
| `VITE_CONTENTSTACK_API_KEY` or `CONTENTSTACK_API_KEY` | Stack API key |
| `VITE_CONTENTSTACK_ENVIRONMENT` or `CONTENTSTACK_PUBLISH_ENVIRONMENT` | Publish target + environment filters |

**Recommended** (not validated as “missing” by the scripts, but you should set them for your stack; defaults only match some stacks):

| Variable | Purpose |
|----------|---------|
| `CONTENTSTACK_MANAGEMENT_HOST` | CMA base for your region; see [`scripts/lib/cma.mjs`](scripts/lib/cma.mjs) (`https://api.contentstack.io` if unset) |
| `CONTENTSTACK_BRANCH` | Branch uid (`main`, etc.); if unset, no `branch` header is sent |
| `CONTENTSTACK_LOCALE` | Entry locale; defaults to `en-us` if unset |

**Optional** (feature toggles / only when needed):

| Variable | Purpose |
|----------|---------|
| `CONTENTSTACK_MANIFEST_PATH` | Override path to manifest JSON |
| `CONTENTSTACK_PERIODIC_COUNT` | Entries per `periodic.enabled` type per run when manifest **`periodic.count` is omitted** |
| `CONTENTSTACK_MANIFEST_SKIP_SEEDS` | `true`: bootstrap without seed POSTs (see manifest `skipSeedEntries`) |
| `CONTENTSTACK_MANIFEST_SKIP_DUPLICATE_SEEDS` | Not `false`: skip duplicate seed titles and hydrate refs (see **Idempotency**) |
| `CONTENTSTACK_AUTO_ENTRY_TITLE` | **`automate:entry`** title override |
| `CONTENTSTACK_TAXONOMY_UID_*` / `CONTENTSTACK_TAXONOMY_TERMS_*` | Taxonomy shorthand / `__TAX_TERMS__` only (see **Taxonomy fields**) |

## Front-end / Launch

**Optional:** set **`VITE_CONTENTSTACK_CONTENT_TYPE_UIDS`** to a comma-separated list of types to list; if **omitted**, the app defaults to **`top_url_lines`** only. Mirror the same in **Launch** when you use it.

## GitHub Actions (every 10 minutes, UTC)

Workflow: [`.github/workflows/contentstack-periodic-entries.yml`](.github/workflows/contentstack-periodic-entries.yml).

The workflow runs **`npm run automate:entries:periodic:ci`** (no `--env-file=.env`; the runner has no `.env` file). Locally use **`npm run automate:entries:periodic`** with a `.env` file.

### Repository secrets vs environment secrets (GitHub)

Under **Settings → Secrets and variables → Actions**, GitHub shows two different ideas:

| UI area | What it is | Used by this repo’s periodic workflow? |
|---------|------------|----------------------------------------|
| **Repository secrets** | Encrypted values available to workflows on this repo | **Yes.** The YAML reads `${{ secrets.NAME }}` from here. |
| **Environment secrets** (e.g. “production”) | Secrets tied to a named [GitHub Environment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) | **No** — the workflow does not set `environment: …` on the job, so “This environment has no secrets” is **normal**, not a missing configuration. |

**What the periodic job actually needs** (as repository secrets): management token, stack API key (`CONTENTSTACK_API_KEY` or `VITE_CONTENTSTACK_API_KEY`), publish/environment uid (`CONTENTSTACK_PUBLISH_ENVIRONMENT` or `VITE_CONTENTSTACK_ENVIRONMENT`), plus any optional names you added to the workflow `env` block (host, branch, locale, manifest path, periodic count).

**What it does *not* read:** Delivery API variables (`VITE_CONTENTSTACK_DELIVERY_TOKEN`, `VITE_CONTENTSTACK_DELIVERY_HOST`, etc.). Those are for the **Vite app / Launch** build only. Storing them as repository secrets is optional and does not affect whether **`automate:entries:periodic:ci`** succeeds.

**Annotations:** A successful run may still show a GitHub notice about Node versions used *by* `actions/checkout` and `actions/setup-node`. That is separate from your workflow’s `node-version: '20'` for `npm ci` / the script; it does not mean the job failed.

Configure repository **Secrets** — use these **exact** names (or edit the workflow):

- **`CONTENTSTACK_MANAGEMENT_TOKEN`** (required)
- **`CONTENTSTACK_API_KEY`** *or* **`VITE_CONTENTSTACK_API_KEY`** (stack API key; add at least one)
- **`CONTENTSTACK_PUBLISH_ENVIRONMENT`** *or* **`VITE_CONTENTSTACK_ENVIRONMENT`** (required for publish; add at least one)

Recommended in `.env` for local runs (optional on the workflow unless you add them to `env:`):

- `CONTENTSTACK_MANAGEMENT_HOST`, `CONTENTSTACK_BRANCH`, `CONTENTSTACK_LOCALE`

Optional workflow extras (only if you add them to the workflow `env` block):

- `CONTENTSTACK_MANIFEST_PATH`, `CONTENTSTACK_PERIODIC_COUNT`, `CONTENTSTACK_MANIFEST_SKIP_SEEDS`, `CONTENTSTACK_MANIFEST_SKIP_DUPLICATE_SEEDS`

Cron `*/10 * * * *` runs in **UTC**. Use `workflow_dispatch` for a manual test.

**Write volume** — Every 10 minutes produces many entries over time; watch **Management API rate limits** and stack hygiene (retention / cleanup).

### Contentstack Automation Hub (alternative to GitHub `schedule`)

If you prefer running on a timer **inside Contentstack** (or GitHub’s cron is slow or unavailable), use **[Automation Hub](https://www.contentstack.com/docs/developers/automation-hub-guides/about-automation-hub)** so the **same** GitHub workflow still executes (same `npm` script and **repository secrets**).

**Pattern**

1. **Trigger:** [Scheduler by Automate](https://www.contentstack.com/docs/developers/automation-hub-connectors/scheduler-by-automation-hub) — set your interval (e.g. every 10 minutes) in the Automation Hub UI.
2. **Action:** [HTTP Action](https://www.contentstack.com/docs/developers/automation-hub-connectors/http-action) — **POST** to the GitHub **workflow dispatch** API so only `workflow_dispatch` runs (not a duplicate custom script).

**HTTP Action settings**

| Field | Value |
|-------|--------|
| Method | `POST` |
| URL | `https://api.github.com/repos/<owner>/<repo>/actions/workflows/contentstack-periodic-entries.yml/dispatches` |
| Headers | `Accept: application/vnd.github+json`, `Content-Type: application/json`, `Authorization: Bearer <GITHUB_PAT>` |
| Body (JSON) | `{"ref":"main"}` (use your default branch name if not `main`) |

Replace `<owner>` / `<repo>` (e.g. `DiveshKumarChordia` / `top-url-website-making`). The workflow **file name** (`contentstack-periodic-entries.yml`) is valid as the workflow identifier in this API. In the HTTP Action, turn on **Throw error status** (or equivalent) for 4xx/5xx so failed dispatches show in Automation Hub execution logs.

**GitHub token**

- Create a **fine-grained PAT** with **Actions: Read and write** on this repository, or a **classic** PAT with `repo` / workflow scope as required by your org policy.
- Store the PAT in Automation Hub (connector **Account** / **secrets**), not in the repo.

**Avoid double runs**

If Automation Hub fires on the same cadence as GitHub’s `schedule` cron, you will create **twice** as many entries. Either:

- Rely on **Automation Hub only** and remove or comment out the `schedule:` block in [`.github/workflows/contentstack-periodic-entries.yml`](.github/workflows/contentstack-periodic-entries.yml), **or**
- Keep GitHub cron and do **not** add a parallel Automation Hub schedule.

**Purely native alternative (advanced)**

You can chain **Contentstack Management — Entries** actions (create/publish) in Automation Hub without GitHub, but that **does not** run [`scripts/periodic-entries-from-manifest.mjs`](scripts/periodic-entries-from-manifest.mjs) or read [`scripts/content-types.manifest.json`](scripts/content-types.manifest.json); you would re-implement each content type and payload in the UI. The **HTTP → GitHub dispatch** approach keeps one source of truth.

## Management token scope

Token must allow **content type create** (bootstrap), **entry create** and **publish**, branch access, and taxonomy assignment if used.

## Modular blocks entry shape

Manifest Shorthand entries may use `{ "block_type": "hero", ... }`; the script converts them to Contentstack’s `{ "hero": { ... } }` shape before POST.

## Idempotency

- Re-running **`automate:manifest`** skips existing content types. Seed **`entries`** run again by default; duplicate **unique** `title` values return 422.
- **Default behavior:** if `CONTENTSTACK_MANIFEST_SKIP_DUPLICATE_SEEDS` is not `false`, duplicate-title seeds are **skipped** and the in-memory `__REF__` registry is **hydrated** from existing entries on that type (so later types in the manifest can still resolve references).
- **Content types only:** set `skipSeedEntries: true` on the manifest root or **`CONTENTSTACK_MANIFEST_SKIP_SEEDS=true`** to never POST seed entries.
- **`automate:entries:periodic`** always uses fresh titles.

## References

- [Content Management API](https://www.contentstack.com/docs/developers/apis/content-management-api)
- [JSON schema for creating a content type](https://www.contentstack.com/docs/developers/create-content-types/json-schema-for-creating-a-content-type)

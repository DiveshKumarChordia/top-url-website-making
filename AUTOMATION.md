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
  - `count` — optional; falls back to `defaults.periodicCount` or **`CONTENTSTACK_PERIODIC_COUNT`** env.
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

| Variable | Purpose |
|----------|---------|
| `CONTENTSTACK_MANAGEMENT_TOKEN` | Required |
| `VITE_CONTENTSTACK_API_KEY` or `CONTENTSTACK_API_KEY` | Stack API key |
| `CONTENTSTACK_MANAGEMENT_HOST` | CMA base (often `https://api.contentstack.io`) |
| `CONTENTSTACK_BRANCH` | e.g. `main` |
| `CONTENTSTACK_LOCALE` | e.g. `en-us` |
| `VITE_CONTENTSTACK_ENVIRONMENT` or `CONTENTSTACK_PUBLISH_ENVIRONMENT` | Publish + list filters |
| `CONTENTSTACK_MANIFEST_PATH` | Optional path to manifest JSON |
| `CONTENTSTACK_PERIODIC_COUNT` | Default repeat count for periodic when `periodic.count` omitted |

## Front-end / Launch

Set **`VITE_CONTENTSTACK_CONTENT_TYPE_UIDS`** to a comma-separated list of every type you want listed (e.g. `demo_plain_text,demo_json_rte,...`). Mirror the same in **Launch** env vars.

## GitHub Actions (every 10 minutes, UTC)

Workflow: [`.github/workflows/contentstack-periodic-entries.yml`](.github/workflows/contentstack-periodic-entries.yml).

Configure repository **Secrets** (names must match or edit the workflow):

- `CONTENTSTACK_MANAGEMENT_TOKEN` (required)
- `CONTENTSTACK_API_KEY` **or** `VITE_CONTENTSTACK_API_KEY`
- `CONTENTSTACK_PUBLISH_ENVIRONMENT` **or** `VITE_CONTENTSTACK_ENVIRONMENT`
- Optional: `CONTENTSTACK_MANAGEMENT_HOST`, `CONTENTSTACK_BRANCH`, `CONTENTSTACK_LOCALE`, `CONTENTSTACK_MANIFEST_PATH`, `CONTENTSTACK_PERIODIC_COUNT`

Cron `*/10 * * * *` runs in **UTC**. Use `workflow_dispatch` for a manual test.

**Write volume** — Every 10 minutes produces many entries over time; watch **Management API rate limits** and stack hygiene (retention / cleanup).

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

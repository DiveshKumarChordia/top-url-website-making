# Top URL lines — Contentstack front-end

Vite + React app that lists **published** entries for one or more content types through the [Content Delivery API](https://www.contentstack.com/docs/developers/apis/content-delivery-api). The home page includes a small **Three.js** hero (React Three Fiber) for decoration. If you omit `VITE_CONTENTSTACK_CONTENT_TYPE_UIDS`, the app defaults to a single type: **`top_url_lines`**. The repo’s [`.env.example`](.env.example) targets the demo manifest types: `demo_plain_text`, `demo_json_rte`, `demo_reference`, `demo_group`, `demo_blocks` (align this list with what exists in your stack).

## Local setup

1. Copy environment template and fill in values from your stack (never commit `.env`):

   ```bash
   cp .env.example .env
   ```

2. **Environment variables**

   Anything you **do not use** can stay unset. **Optional** below means “not required for that workflow” (for example you can ignore every `CONTENTSTACK_*` line if you never run `npm run automate:*`).

   **Front-end** (`npm run dev`, `npm run build`, Contentstack Launch) — values are `VITE_*` and are embedded in the client bundle.

   *Required*

   | Variable | Where to find it |
   |----------|------------------|
   | `VITE_CONTENTSTACK_API_KEY` | Stack API key |
   | `VITE_CONTENTSTACK_DELIVERY_TOKEN` | Stack → Settings → Tokens → **Delivery Tokens** |
   | `VITE_CONTENTSTACK_ENVIRONMENT` | Environment uid (e.g. `production`) from **Settings → Environments** |
   | `VITE_CONTENTSTACK_DELIVERY_HOST` | **Content Delivery URL** from Stack → Settings → Stack. Must match that URL exactly, with **no trailing slash** (e.g. `https://cdn.contentstack.io`). |

   *Optional*

   | Variable | Purpose |
   |----------|---------|
   | `VITE_CONTENTSTACK_CONTENT_TYPE_UIDS` | Comma-separated content type UIDs to list. If **omitted**, the app defaults to **`top_url_lines`**. Use the demo list in [`.env.example`](.env.example) only if those types exist in your stack. |

   **Automation** (`npm run automate:*` with Node 20+ and `node --env-file=.env`) — **skip entirely** if you only build or host the site.

   *Required when using automation*

   | Variable | Purpose |
   |----------|---------|
   | `CONTENTSTACK_MANAGEMENT_TOKEN` | CMA management token |
   | `CONTENTSTACK_API_KEY` or `VITE_CONTENTSTACK_API_KEY` | Stack API key (either name) |
   | `CONTENTSTACK_PUBLISH_ENVIRONMENT` or `VITE_CONTENTSTACK_ENVIRONMENT` | Target environment uid for publish / API filters |

   *Recommended — always set these to match **your** stack; the CLI only marks them “optional” because it falls back if missing (wrong host / branch / locale will still break behavior at runtime)*

   | Variable | Purpose |
   |----------|---------|
   | `CONTENTSTACK_MANAGEMENT_HOST` | CMA base URL for your region (e.g. `https://api.contentstack.io`; same default as in code if unset) |
   | `CONTENTSTACK_BRANCH` | Branch uid your token uses (e.g. `main`); if unset, the branch header is omitted |
   | `CONTENTSTACK_LOCALE` | Locale for entry payloads (e.g. `en-us`; code defaults to `en-us` if unset) |

   *Optional — only when you need that feature*

   | Variable | Purpose |
   |----------|---------|
   | `CONTENTSTACK_MANIFEST_PATH` | Custom manifest path (default `scripts/content-types.manifest.json`) |
   | `CONTENTSTACK_PERIODIC_COUNT` | Batch size per `periodic.enabled` type when manifest `periodic.count` is omitted |
   | `CONTENTSTACK_MANIFEST_SKIP_SEEDS` | `true` = bootstrap without POSTing seed entries |
   | `CONTENTSTACK_MANIFEST_SKIP_DUPLICATE_SEEDS` | Duplicate seed titles: skip + hydrate refs unless set to `false` |
   | `CONTENTSTACK_AUTO_ENTRY_TITLE` | Fixed title for `npm run automate:entry` only |
   | `CONTENTSTACK_TAXONOMY_UID_*` / `CONTENTSTACK_TAXONOMY_TERMS_*` | Only if you use taxonomy shorthand or `__TAX_TERMS__` placeholders ([AUTOMATION.md](./AUTOMATION.md)) |

   Full commented template: **[`.env.example`](.env.example)**. Secrets, placeholders, and cron: **[AUTOMATION.md](./AUTOMATION.md)**.

3. **Publish content** — The Delivery API returns only **published** entries. Unpublished items will not appear until you publish them to the environment you set in `VITE_CONTENTSTACK_ENVIRONMENT`.

4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

5. Other scripts:

   ```bash
   npm run lint      # ESLint
   npm run preview   # local preview of production build (after build)
   ```

6. Production build:

   ```bash
   npm run build
   ```

   Output is written to **`dist/`**.

### Security note

`VITE_*` variables are embedded in the client bundle. The delivery token is visible in the browser. Use a read-only delivery token and accept this tradeoff for static hosting, or add a server-side proxy later if you need to hide credentials.

## Architecture & automation (overview)

The GitHub periodic workflow uses **repository** secrets only; if **environment** secrets (per deployment environment) are empty in Settings, that is expected—see **[AUTOMATION.md — Repository vs environment secrets](AUTOMATION.md#repository-secrets-vs-environment-secrets-github)**.

Typical use cases:

| Flow | When to use it |
|------|----------------|
| **Local / one-off bootstrap** | Run `npm run automate:manifest` to create missing content types from the manifest and **seed** entries (references, taxonomy placeholders). |
| **Scheduled or manual entries** | Run `npm run automate:entries:periodic`, the GitHub Action, or trigger the same workflow from **Contentstack Automation Hub** (HTTP POST → `workflow_dispatch`) — see **[AUTOMATION.md — Automation Hub](AUTOMATION.md#contentstack-automation-hub-alternative-to-github-schedule)**. |
| **Contentstack Launch** | Connect the repo; build outputs `dist/`; set `VITE_*` for the Delivery API so the app lists **published** entries. |
| **Demo / load-style churn** | Periodic job + `CONTENTSTACK_PERIODIC_COUNT` (see below) — watch [Management API](https://www.contentstack.com/docs/developers/apis/content-management-api) limits and clean up test data. |

### Periodic run: how many entries?

For each content type in [`scripts/content-types.manifest.json`](scripts/content-types.manifest.json) with `periodic.enabled`, the script creates **N** entries per **workflow run**, where **N** is resolved in this order:

1. **`periodic.count`** in the manifest — if this property is a **number**, it wins and **ignores** `CONTENTSTACK_PERIODIC_COUNT`.
2. Otherwise **`CONTENTSTACK_PERIODIC_COUNT`** (e.g. GitHub Actions secret).
3. Otherwise **`defaults.periodicCount`** in the manifest.
4. Otherwise **1**.

**This repo’s demo manifest omits `periodic.count`**, so `CONTENTSTACK_PERIODIC_COUNT` (or `defaults.periodicCount`) applies. If you **add** a numeric `periodic.count` on a content type, it overrides the secret for that type only.

Example write volume: **3** enabled types × **20** entries × **12** runs/hour (cron every 5 min) ⇒ **720** new entries/hour until you lower the secret, add per-type `periodic.count`, or change the schedule.

### Diagrams (Mermaid)

The fenced `mermaid` blocks below render as graphics on **[GitHub’s README page](https://github.com/DiveshKumarChordia/top-url-website-making/blob/main/README.md)**. If your preview only shows the raw `sequenceDiagram` / `flowchart` lines, the file is still valid — your viewer simply does not support Mermaid (common in IDEs and some hosts). Paste the block into [mermaid.live](https://mermaid.live) to view or export an image.

### Sequence: GitHub Actions → Contentstack

Plain steps (same idea as the diagram): GitHub Actions starts the periodic npm script → script reads manifest + env/secrets → for each `periodic.enabled` type, create and publish **N** entries via CMA → job exits; the app sees new entries through the Delivery API after publish.

```mermaid
sequenceDiagram
  autonumber
  participant GH as GitHub Actions
  participant Run as npm periodic script
  participant CMA as Contentstack CMA
  participant Site as Vite app (Delivery API)

  GH->>Run: schedule or workflow_dispatch
  Run->>Run: read manifest + env / secrets
  loop Each content type with periodic.enabled
    Run->>CMA: create entry + publish (× N per type)
    CMA-->>Run: entry UID
  end
  Run-->>GH: exit 0
  Note over Site: After publish, entries appear when VITE env points at same stack/env
```

### Flow: local vs CI vs browser

Plain relationships: the manifest feeds **bootstrap** (`automate:manifest` → CMA) and **periodic** runs (**`automate:entries:periodic`** locally, **`automate:entries:periodic:ci`** in GitHub Actions → same Node script). **`automate:entry`** posts one entry via CMA without the manifest loop. The Vite app only **reads** published data via the Delivery API.

```mermaid
flowchart TB
  subgraph Manifest["scripts/content-types.manifest.json"]
    CT[contentTypes + periodic blocks]
  end

  subgraph Bootstrap["Bootstrap (types + seeds)"]
    M[npm run automate:manifest]
    M --> CMA1[Contentstack CMA]
  end

  subgraph Periodic["Periodic (entries only)"]
    L[npm run automate:entries:periodic]
    W[npm run automate:entries:periodic:ci]
    L --> CMA2[Contentstack CMA]
    W --> CMA2
  end

  subgraph OneOff["Single entry optional"]
    O[npm run automate:entry]
    O --> CMA3[Contentstack CMA]
  end

  subgraph App["Front-end"]
    V[npm run dev / build]
    V --> DLA[Delivery API read-only]
  end

  CT --> M
  CT --> L
  CT --> W
  CMA1 --> DLA
  CMA2 --> DLA
  CMA3 --> DLA
```

Details, secrets, and placeholders: **[AUTOMATION.md](./AUTOMATION.md)**.

## Contentstack Launch

1. Push this repo to GitHub or Bitbucket.
2. In Contentstack, open **Launch** → **New project** → **Import from a Git repository**.
3. Connect the repo and branch (e.g. `main`). Set **root directory** to the repo root unless this app lives in a monorepo subfolder.
4. Build settings:

   | Setting | Value |
   |---------|--------|
   | Install | `npm ci` or `npm install` |
   | Build | `npm run build` |
   | Output directory | `dist` |

5. In Launch **Environment variables**, set the **four required** `VITE_CONTENTSTACK_*` keys (`API_KEY`, `DELIVERY_TOKEN`, `ENVIRONMENT`, `DELIVERY_HOST`). Add **`VITE_CONTENTSTACK_CONTENT_TYPE_UIDS`** only if you want types other than the default `top_url_lines`; it is **optional**.
6. Use Node **20** (or current LTS) in the project settings if the default Node version fails the build.

Optional: trigger redeploys when content publishes (webhook, GitHub Action, or Launch deploy hook). For **multi-field manifests**, **`npm run automate:manifest`**, **`npm run automate:entries:periodic`** (every **5** minutes via [`.github/workflows/contentstack-periodic-entries.yml`](.github/workflows/contentstack-periodic-entries.yml); optional **Delivery** GET warm-up step), and taxonomy/reference placeholders, see **[AUTOMATION.md](./AUTOMATION.md)**.

## References

- [Launch overview](https://www.contentstack.com/docs/developers/launch)
- [Launch quick start (generic CSR)](https://www.contentstack.com/docs/developers/launch/quick-start-generic-csr)

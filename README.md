# Top URL lines — Contentstack front-end

Minimal Vite + React site that lists entries from the Contentstack content type **`top_url_lines`** via the [Content Delivery API](https://www.contentstack.com/docs/developers/apis/content-delivery-api).

## Local setup

1. Copy environment template and fill in values from your stack (never commit `.env`):

   ```bash
   cp .env.example .env
   ```

2. **Variables**

   | Variable | Where to find it |
   |----------|-------------------|
   | `VITE_CONTENTSTACK_API_KEY` | Stack API key |
   | `VITE_CONTENTSTACK_DELIVERY_TOKEN` | Stack → Settings → Tokens → **Delivery Tokens** |
   | `VITE_CONTENTSTACK_ENVIRONMENT` | Environment uid (e.g. `production`) from **Settings → Environments** |
   | `VITE_CONTENTSTACK_DELIVERY_HOST` | **Content Delivery URL** from Stack → Settings → Stack (no trailing slash) |

3. **Publish content** — The Delivery API returns only **published** entries. Unpublished items will not appear until you publish them to the environment you set in `VITE_CONTENTSTACK_ENVIRONMENT`.

4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

5. Production build:

   ```bash
   npm run build
   ```

   Output is written to **`dist/`**.

### Security note

`VITE_*` variables are embedded in the client bundle. The delivery token is visible in the browser. Use a read-only delivery token and accept this tradeoff for static hosting, or add a server-side proxy later if you need to hide credentials.

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

5. Add the same four **`VITE_CONTENTSTACK_*`** variables in Launch **Environment variables** for production builds.
6. Use Node **20** (or current LTS) in the project settings if the default Node version fails the build.

Optional: trigger redeploys when content publishes (webhook, GitHub Action, or Launch deploy hook).

## References

- [Launch overview](https://www.contentstack.com/docs/developers/launch)
- [Launch quick start (generic CSR)](https://www.contentstack.com/docs/developers/launch/quick-start-generic-csr)

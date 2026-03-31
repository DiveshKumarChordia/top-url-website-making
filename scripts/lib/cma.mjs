/**
 * Contentstack Content Management API helpers (Node 18+ fetch).
 */

export function optionalEnv(name, fallback = '') {
  const v = process.env[name]
  if (v == null || String(v).trim() === '') return fallback
  return String(v).trim()
}

export function requireEnv(name) {
  const v = process.env[name]
  if (!v || String(v).trim() === '') {
    console.error(`Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return v.trim()
}

export function loadStackAuth() {
  const apiKey =
    optionalEnv('CONTENTSTACK_API_KEY') ||
    optionalEnv('VITE_CONTENTSTACK_API_KEY')
  if (!apiKey) {
    console.error(
      'Missing stack API key: set CONTENTSTACK_API_KEY or VITE_CONTENTSTACK_API_KEY',
    )
    process.exit(1)
  }
  const token = requireEnv('CONTENTSTACK_MANAGEMENT_TOKEN')
  let base = optionalEnv('CONTENTSTACK_MANAGEMENT_HOST', 'https://api.contentstack.io')
  base = base.replace(/\/$/, '')
  const branch = optionalEnv('CONTENTSTACK_BRANCH')
  const locale = optionalEnv('CONTENTSTACK_LOCALE', 'en-us')
  const publishEnv =
    optionalEnv('CONTENTSTACK_PUBLISH_ENVIRONMENT') ||
    optionalEnv('VITE_CONTENTSTACK_ENVIRONMENT')
  if (!publishEnv) {
    console.error(
      'Missing publish target: set CONTENTSTACK_PUBLISH_ENVIRONMENT or VITE_CONTENTSTACK_ENVIRONMENT',
    )
    process.exit(1)
  }

  return { apiKey, token, base, branch, locale, publishEnv }
}

export function managementHeaders(apiKey, token, branch) {
  const h = {
    api_key: apiKey,
    authorization: token,
    'Content-Type': 'application/json',
  }
  if (branch) h.branch = branch
  return h
}

export function defaultTitleOnlySchema() {
  return [
    {
      data_type: 'text',
      display_name: 'Title',
      field_metadata: {
        _default: true,
        version: 3,
      },
      mandatory: true,
      uid: 'title',
      unique: true,
      multiple: false,
      non_localizable: false,
    },
  ]
}

export function defaultContentTypeOptions() {
  return {
    is_page: false,
    singleton: false,
    sub_title: [],
    title: 'title',
  }
}

export async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

export async function contentTypeExists(base, headers, uid) {
  const url = `${base}/v3/content_types/${uid}`
  const res = await fetch(url, { method: 'GET', headers })
  return res.ok
}

export async function createContentType(base, headers, { uid, title, schema }) {
  const url = `${base}/v3/content_types`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content_type: {
        title,
        uid,
        schema,
        options: defaultContentTypeOptions(),
      },
    }),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

export async function createEntry(base, headers, contentTypeUid, entryFields, locale) {
  const q = locale ? `?locale=${encodeURIComponent(locale)}` : ''
  const url = `${base}/v3/content_types/${contentTypeUid}/entries${q}`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ entry: entryFields }),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

export async function publishEntry(
  base,
  headers,
  contentTypeUid,
  entryUid,
  locale,
  publishEnv,
) {
  const url = `${base}/v3/content_types/${contentTypeUid}/entries/${entryUid}/publish`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      entry: {
        environments: [publishEnv],
        locales: [locale],
      },
      locale,
    }),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

/**
 * List entries (Management API). Uses environment when provided to scope results.
 */
export async function listEntries(
  base,
  headers,
  contentTypeUid,
  { locale, environment, limit = 10, desc, asc } = {},
) {
  const params = new URLSearchParams()
  if (locale) params.set('locale', locale)
  if (environment) params.set('environment', environment)
  if (limit != null) params.set('limit', String(limit))
  if (desc) params.set('desc', desc)
  if (asc) params.set('asc', asc)
  const q = params.toString()
  const url = `${base}/v3/content_types/${contentTypeUid}/entries${q ? `?${q}` : ''}`
  const res = await fetch(url, { method: 'GET', headers })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

export async function getLatestEntryUid(
  base,
  headers,
  contentTypeUid,
  locale,
  environment,
) {
  const { ok, body } = await listEntries(base, headers, contentTypeUid, {
    locale,
    environment,
    limit: 1,
    desc: 'updated_at',
  })
  if (!ok || !Array.isArray(body.entries) || body.entries.length === 0) {
    return null
  }
  return body.entries[0]?.uid ?? null
}

export async function getFirstEntryUid(
  base,
  headers,
  contentTypeUid,
  locale,
  environment,
) {
  const { ok, body } = await listEntries(base, headers, contentTypeUid, {
    locale,
    environment,
    limit: 1,
    asc: 'created_at',
  })
  if (!ok || !Array.isArray(body.entries) || body.entries.length === 0) {
    return null
  }
  return body.entries[0]?.uid ?? null
}

export async function createAndPublishEntry(
  base,
  headers,
  contentTypeUid,
  entryFields,
  locale,
  publishEnv,
) {
  const created = await createEntry(base, headers, contentTypeUid, entryFields, locale)
  if (!created.ok) {
    return { ok: false, step: 'create', ...created }
  }
  const entryUid = created.body.entry?.uid
  if (!entryUid) {
    return {
      ok: false,
      step: 'create',
      status: created.status,
      body: created.body,
      message: 'missing entry.uid',
    }
  }
  const published = await publishEntry(
    base,
    headers,
    contentTypeUid,
    entryUid,
    locale,
    publishEnv,
  )
  if (!published.ok) {
    return { ok: false, step: 'publish', entryUid, ...published }
  }
  return { ok: true, entryUid, body: published.body }
}

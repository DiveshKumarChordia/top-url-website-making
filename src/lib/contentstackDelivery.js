/**
 * Contentstack Delivery API helpers (browser + shared with warm-up scripts patterns).
 */

export function getConfig() {
  const apiKey = import.meta.env.VITE_CONTENTSTACK_API_KEY
  const deliveryToken = import.meta.env.VITE_CONTENTSTACK_DELIVERY_TOKEN
  const environment = import.meta.env.VITE_CONTENTSTACK_ENVIRONMENT
  let deliveryHost = import.meta.env.VITE_CONTENTSTACK_DELIVERY_HOST ?? ''

  deliveryHost = deliveryHost.replace(/\/$/, '')

  return { apiKey, deliveryToken, environment, deliveryHost }
}

export function parseContentTypeUids() {
  const raw =
    import.meta.env.VITE_CONTENTSTACK_CONTENT_TYPE_UIDS ?? 'top_url_lines'
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function buildEntriesUrl(deliveryHost, environment, contentTypeUid) {
  const base = `${deliveryHost}/v3/content_types/${contentTypeUid}/entries`
  const params = new URLSearchParams()
  if (environment) params.set('environment', environment)
  const q = params.toString()
  return q ? `${base}?${q}` : base
}

export function buildEntryDetailUrl(
  deliveryHost,
  environment,
  contentTypeUid,
  entryUid,
) {
  const base = `${deliveryHost}/v3/content_types/${contentTypeUid}/entries/${entryUid}`
  const params = new URLSearchParams()
  if (environment) params.set('environment', environment)
  const q = params.toString()
  return q ? `${base}?${q}` : base
}

export function deliveryResponseMessage(body, res) {
  const msg =
    body.error_message ??
    body.error ??
    `${res.status} ${res.statusText || 'Request failed'}`
  return typeof msg === 'string' ? msg : JSON.stringify(msg)
}

/** Delivery 404/422 often means the content type uid does not exist on this stack. */
export function isMissingContentTypeError(res, message) {
  if (res.status === 404 || res.status === 422) return true
  const m = message.toLowerCase()
  if (m.includes('content type') && m.includes('not found')) return true
  if (m.includes('was not found')) return true
  return false
}

export function deliveryHeaders(apiKey, deliveryToken) {
  return {
    api_key: apiKey,
    access_token: deliveryToken,
  }
}

/**
 * @param {ReturnType<typeof getConfig>} config
 * @param {string} contentTypeUid
 * @param {string} entryUid
 */
export async function fetchEntryDetail(config, contentTypeUid, entryUid) {
  const { apiKey, deliveryToken, environment, deliveryHost } = config
  if (!apiKey || !deliveryToken || !deliveryHost) {
    return {
      ok: false,
      status: 0,
      error: 'Missing VITE_CONTENTSTACK_* configuration.',
      entry: null,
    }
  }
  const url = buildEntryDetailUrl(
    deliveryHost,
    environment,
    contentTypeUid,
    entryUid,
  )
  const res = await fetch(url, {
    headers: deliveryHeaders(apiKey, deliveryToken),
  })
  const body = await res.json().catch(() => ({}))
  const entry = body.entry ?? null
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: deliveryResponseMessage(body, res),
      entry,
    }
  }
  return { ok: true, status: res.status, error: null, entry }
}

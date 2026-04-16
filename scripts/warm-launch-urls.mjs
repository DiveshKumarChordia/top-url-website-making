/**
 * GET each Launch URL for entries: /entry/:contentTypeUid/:entryUid
 * Uses the same Delivery list endpoints as the Vite app. Does not multiply by
 * CONTENTSTACK_WARMUP_GET_COUNT (one GET per entry page per run).
 *
 * Env: LAUNCH_SITE_URL (optional — skip if unset), VITE_CONTENTSTACK_DELIVERY_HOST,
 * VITE_CONTENTSTACK_DELIVERY_TOKEN, VITE_CONTENTSTACK_API_KEY (or CONTENTSTACK_API_KEY),
 * VITE_CONTENTSTACK_ENVIRONMENT, VITE_CONTENTSTACK_CONTENT_TYPE_UIDS (optional).
 * Optional: LAUNCH_ENTRY_WARMUP_MAX — max entry URLs to hit (0 = unlimited).
 */

import process from 'node:process'

function optionalEnv(name, fallback = '') {
  const v = process.env[name]
  if (v == null || String(v).trim() === '') return fallback
  return String(v).trim()
}

function normalizeBase(url) {
  return url.replace(/\/$/, '')
}

function buildEntriesUrl(deliveryHost, environment, contentTypeUid) {
  const base = `${deliveryHost}/v3/content_types/${contentTypeUid}/entries`
  const params = new URLSearchParams()
  if (environment) params.set('environment', environment)
  const q = params.toString()
  return q ? `${base}?${q}` : base
}

function deliveryErrorHint(body) {
  const msg = body?.error_message ?? body?.error
  if (typeof msg === 'string' && msg.trim()) return msg.trim()
  try {
    return JSON.stringify(body?.errors ?? body).slice(0, 500)
  } catch {
    return ''
  }
}

function deliveryHeadersWarm(apiKey, accessToken, branch) {
  const h = {
    api_key: apiKey,
    access_token: accessToken,
  }
  if (branch) h.branch = branch
  return h
}

async function deliveryGet(url, apiKey, accessToken, branch) {
  const res = await fetch(url, {
    headers: deliveryHeadersWarm(apiKey, accessToken, branch),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

async function warmUrl(url) {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(90_000),
  })
  return { ok: res.ok, status: res.status }
}

async function main() {
  const launchBaseRaw = optionalEnv('LAUNCH_SITE_URL')
  if (!launchBaseRaw) {
    console.log(
      'warm-launch-urls: LAUNCH_SITE_URL unset — skip (nothing to warm).',
    )
    console.log(
      'Add secret LAUNCH_SITE_URL on this GitHub Environment (Settings → Environments → your env → Environment secrets), e.g. https://your-launch-site.example.com — same URL as in Launch “Open site”.',
    )
    return
  }

  const deliveryHost = optionalEnv('VITE_CONTENTSTACK_DELIVERY_HOST').replace(
    /\/$/,
    '',
  )
  const apiKey =
    optionalEnv('VITE_CONTENTSTACK_API_KEY') ||
    optionalEnv('CONTENTSTACK_API_KEY')
  const accessToken = optionalEnv('VITE_CONTENTSTACK_DELIVERY_TOKEN')
  const environment =
    optionalEnv('VITE_CONTENTSTACK_ENVIRONMENT') ||
    optionalEnv('CONTENTSTACK_PUBLISH_ENVIRONMENT')
  const branch =
    optionalEnv('CONTENTSTACK_BRANCH') || optionalEnv('VITE_CONTENTSTACK_BRANCH')

  if (!deliveryHost || !apiKey || !accessToken) {
    console.log(
      'warm-launch-urls: missing Delivery env (host / API key / token) — skip entry URL enumeration.',
    )
    const launchBase = normalizeBase(launchBaseRaw)
    const { ok, status } = await warmUrl(launchBase)
    console.log(`GET home ${launchBase} → HTTP ${status}${ok ? '' : ' (expected if only warming home)'}`)
    return
  }

  const launchBase = normalizeBase(launchBaseRaw)
  const maxRaw = optionalEnv('LAUNCH_ENTRY_WARMUP_MAX')
  let maxEntries = null
  if (maxRaw && /^\d+$/.test(maxRaw)) {
    maxEntries = Number.parseInt(maxRaw, 10)
  }

  const uidsRaw = optionalEnv('VITE_CONTENTSTACK_CONTENT_TYPE_UIDS', 'top_url_lines')
  const contentTypeUids = uidsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const entryTuples = []
  for (const uid of contentTypeUids) {
    const url = buildEntriesUrl(deliveryHost, environment, uid)
    const { ok, status, body } = await deliveryGet(
      url,
      apiKey,
      accessToken,
      branch,
    )
    if (!ok) {
      const hint = deliveryErrorHint(body)
      console.warn(
        `warm-launch-urls: Delivery list ${uid} failed HTTP ${status}${hint ? ` — ${hint}` : ''}`,
      )
      continue
    }
    const entries = Array.isArray(body.entries) ? body.entries : []
    for (const e of entries) {
      if (e?.uid) entryTuples.push({ ct: uid, entryUid: String(e.uid) })
      if (maxEntries != null && entryTuples.length >= maxEntries) break
    }
    if (maxEntries != null && entryTuples.length >= maxEntries) break
  }

  const targets = []
  for (const { ct, entryUid } of entryTuples) {
    const path = `/entry/${encodeURIComponent(ct)}/${encodeURIComponent(entryUid)}`
    targets.push(`${launchBase}${path}`)
  }

  console.log(`warm-launch-urls: ${entryTuples.length} entry page(s)`)

  if (entryTuples.length === 0 && contentTypeUids.length > 0) {
    console.warn(
      'warm-launch-urls: No entries were listed. Usually this means VITE_CONTENTSTACK_CONTENT_TYPE_UIDS does not match ' +
        'content types that exist on this stack (422/404), or the environment uid is wrong. ' +
        'Set the same comma-separated UIDs you use in Launch for the app (e.g. top_url_lines).',
    )
  }

  let failed = 0
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    const { ok, status } = await warmUrl(t)
    if (!ok) {
      failed += 1
      console.warn(`warm-launch-urls: GET failed ${status} ${i + 1}/${targets.length} ${t}`)
    } else {
      console.log(`warm-launch-urls: OK ${i + 1}/${targets.length} HTTP ${status}`)
    }
  }

  if (failed > 0) {
    console.warn(
      `warm-launch-urls: ${failed} of ${targets.length} GET(s) were non-OK (see warnings above)`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

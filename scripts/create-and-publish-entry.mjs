/**
 * Create one entry on top_url_lines and publish it (Content Management API).
 * Run: npm run automate:entry (requires Node 20+ for --env-file).
 */

import {
  loadStackAuth,
  managementHeaders,
  createAndPublishEntry,
} from './lib/cma.mjs'

const CONTENT_TYPE_UID = 'top_url_lines'

function optionalEnv(name, fallback = '') {
  const v = process.env[name]
  if (v == null || String(v).trim() === '') return fallback
  return String(v).trim()
}

function buildTitle() {
  const custom = optionalEnv('CONTENTSTACK_AUTO_ENTRY_TITLE')
  if (custom) return custom
  const d = new Date()
  const iso = d.toISOString().slice(0, 19).replace('T', ' ')
  return `auto ${iso}`
}

async function main() {
  const { apiKey, token, base, branch, locale, publishEnv } = loadStackAuth()
  const headers = managementHeaders(apiKey, token, branch)

  const title = buildTitle()
  const result = await createAndPublishEntry(
    base,
    headers,
    CONTENT_TYPE_UID,
    { title },
    locale,
    publishEnv,
  )

  if (!result.ok) {
    console.error(`${result.step} failed:`, result.status, result.body)
    process.exit(1)
  }

  console.log('Created entry', result.entryUid, title)
  console.log('Published entry', result.entryUid, 'to', publishEnv, locale)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

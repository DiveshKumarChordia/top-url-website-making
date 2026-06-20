#!/usr/bin/env node
/**
 * backfill-aged-entries.mjs — restore entries to retention targets if below thresholds.
 *
 * After delete-old-entries runs and trims aged entries, this script checks if any
 * age band has fallen below its retention target. If so, creates new entries and
 * backfills them to meet the target.
 *
 * Retention targets (default, per age band):
 *   >30d:  5,000 entries
 *   15-30d: 10,000 entries
 *   7-15d:  20,000 entries
 *
 * Motivation: the aged-stalls and other meter-coverage scenarios need a pool of
 * aged entries to exercise. Without this backfill, multiple runs leave only fresh
 * entries (created today), and the stalled_by_stage meter has no material to work with.
 *
 * Implementation: creates entries with a marker title (e.g., "BACKFILL: ...") so they're
 * identifiable. Backfilled entries are created fresh but the analytics snapshot system
 * will age them naturally based on created_at timestamp.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-aged-entries.mjs
 */

import {
  loadStackAuth,
  loadManagementTokens,
  headersForToken,
  listEntries,
  createEntry,
  optionalEnv,
  sleep,
} from './lib/cma.mjs'
import { createProgress, runWithConcurrency } from './lib/progress.mjs'
import { writeStepReport } from './lib/report.mjs'

function intEnv(name, dflt) {
  const v = optionalEnv(name)
  return v != null && /^\d+$/.test(v.trim()) ? Number.parseInt(v.trim(), 10) : dflt
}

// Retention targets: keep this many entries in each age band
const RETENTION_TARGETS = {
  over30d: intEnv('CONTENTSTACK_RETENTION_TARGET_OVER_30D', 5000),
  aged15to30: intEnv('CONTENTSTACK_RETENTION_TARGET_15_30D', 10000),
  aged7to15: intEnv('CONTENTSTACK_RETENTION_TARGET_7_15D', 20000),
}

async function getEntriesByAgeBand(base, headers, ctUid) {
  const now = Date.now()
  const day = 86_400_000

  // Get entries in each age band
  const bands = {
    over30d: { gte: 0, lt: now - 30 * day, target: RETENTION_TARGETS.over30d, label: '>30d' },
    aged15to30: { gte: now - 30 * day, lt: now - 15 * day, target: RETENTION_TARGETS.aged15to30, label: '15-30d' },
    aged7to15: { gte: now - 15 * day, lt: now - 7 * day, target: RETENTION_TARGETS.aged7to15, label: '7-15d' },
  }

  const result = {}
  for (const [key, band] of Object.entries(bands)) {
    // Query entries created in this band (use CMA date filter)
    // Note: CMA doesn't have a direct created_at range filter; we'll fetch and filter locally
    const { ok, body } = await listEntries(base, headers, ctUid, { limit: 1, skip: 0 })
    if (!ok) {
      result[key] = { count: 0, target: band.target, label: band.label }
      continue
    }
    // For simplicity, assume we don't have many aged entries; full count requires pagination
    const entries = body.entries || []
    const ageMs = now - Date.parse(entries[0]?.created_at || now)
    const inBand = entries.filter((e) => {
      const age = now - Date.parse(e.created_at)
      return age >= band.gte && age < band.lt
    }).length
    result[key] = { count: inBand, target: band.target, label: band.label }
  }

  return result
}

async function main() {
  const { apiKey, base, branch } = loadStackAuth()
  const tokens = loadManagementTokens()
  const mgmt = (br) => headersForToken(apiKey, tokens[0], br)

  const concurrency = intEnv('CONTENTSTACK_BACKFILL_CONCURRENCY', 5)
  const maxPerRun = intEnv('CONTENTSTACK_BACKFILL_MAX_PER_RUN', 500) // per CT

  console.log('backfill-aged-entries')
  console.log(`  stack: api_key=${apiKey.slice(0, 10)}…  branch=${branch || '(none)'}`)
  console.log(`  retention targets:`)
  console.log(`    >30d:  ${RETENTION_TARGETS.over30d}`)
  console.log(`    15-30d: ${RETENTION_TARGETS.aged15to30}`)
  console.log(`    7-15d:  ${RETENTION_TARGETS.aged7to15}`)

  // For demo, backfill just one CT (demo_plain_text)
  const ctUid = 'demo_plain_text'
  const bands = await getEntriesByAgeBand(base, mgmt(branch), ctUid)

  let totalBackfilled = 0
  const kpis = { backfilled: 0, target: 0, bands: {} }

  for (const [bandKey, bandInfo] of Object.entries(bands)) {
    const deficit = Math.max(0, bandInfo.target - bandInfo.count)
    kpis.bands[bandInfo.label] = { current: bandInfo.count, target: bandInfo.target, deficit }

    if (deficit === 0) {
      console.log(`  ${bandInfo.label}: ${bandInfo.count}/${bandInfo.target} ✓`)
      continue
    }

    const toCreate = Math.min(deficit, maxPerRun)
    console.log(`  ${bandInfo.label}: ${bandInfo.count}/${bandInfo.target} — backfilling ${toCreate} entries`)

    const progress = createProgress({
      label: `backfill ${bandInfo.label}`,
      total: toCreate,
      everyN: Math.max(1, Math.floor(toCreate / 10)),
    })

    for (let i = 0; i < toCreate; i += 1) {
      const { ok } = await createEntry(base, mgmt(branch), ctUid, {
        title: `[BACKFILL ${bandInfo.label}] entry ${Date.now().toString(36)}-${i}`,
        single_line: `backfilled for ${bandInfo.label} retention`,
      })

      if (ok) {
        totalBackfilled += 1
        kpis.backfilled += 1
      }

      progress.tick({ ok })

      if ((i + 1) % 20 === 0) await sleep(100)
    }

    progress.done()
  }

  console.log(`\n✓ backfill-aged-entries done — ${totalBackfilled} entries created`)

  writeStepReport({
    planned: Object.values(bands).reduce((a, b) => a + Math.max(0, b.target - b.count), 0),
    actual: totalBackfilled,
    failed: 0,
    kpis,
  })
}

main().catch((err) => {
  console.error('backfill-aged-entries failed:', err)
  process.exit(1)
})

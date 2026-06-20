/**
 * enhanced-report.mjs — Wire analytics-engine + persist audit trail
 * Instantiates AnalyticsEngine, extracts 50+ KPIs, persists audit trail
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { AnalyticsEngine } from './analytics-engine.mjs'

export function writeEnhancedReport(config = {}) {
  const { data = {}, auditTrail = [], roles = {}, slug = null } = config
  const dir = process.env.RUN_REPORT_DIR
  const reportSlug = slug || process.env.RUN_STEP_SLUG
  if (!dir || !reportSlug) return
  try {
    mkdirSync(dir, { recursive: true })
    const baseReport = {
      planned: Number.isFinite(data.planned) ? data.planned : null,
      actual: Number.isFinite(data.actual) ? data.actual : null,
      failed: Number.isFinite(data.failed) ? data.failed : 0,
      kpis: data.kpis && typeof data.kpis === 'object' ? data.kpis : {},
      errors: Array.isArray(data.errors) ? data.errors.slice(0, 25) : [],
    }
    let analytics = null
    if (auditTrail && auditTrail.length > 0) {
      try {
        const engine = new AnalyticsEngine(auditTrail, roles, {})
        analytics = engine.getComprehensiveReport()
      } catch (e) {
        console.warn('Analytics extraction failed:', e.message)
      }
    }
    if (auditTrail.length > 0) {
      const auditPath = resolve(dir, `${reportSlug}-audit-trail.json`)
      writeFileSync(auditPath, JSON.stringify(auditTrail, null, 2), 'utf-8')
    }
    const enhancedReport = { ...baseReport, audit_trail_count: auditTrail.length, analytics }
    writeFileSync(resolve(dir, `${reportSlug}.json`), JSON.stringify(enhancedReport, null, 2), 'utf-8')
    if (analytics) {
      const analyticsPath = resolve(dir, `${reportSlug}-analytics.json`)
      writeFileSync(analyticsPath, JSON.stringify(analytics, null, 2), 'utf-8')
    }
  } catch {}
}

export function writeStepReport(data = {}) {
  const dir = process.env.RUN_REPORT_DIR
  const slug = process.env.RUN_STEP_SLUG
  if (!dir || !slug) return
  try {
    mkdirSync(dir, { recursive: true })
    const payload = {
      planned: Number.isFinite(data.planned) ? data.planned : null,
      actual: Number.isFinite(data.actual) ? data.actual : null,
      failed: Number.isFinite(data.failed) ? data.failed : 0,
      kpis: data.kpis && typeof data.kpis === 'object' ? data.kpis : {},
      errors: Array.isArray(data.errors) ? data.errors.slice(0, 25) : [],
    }
    writeFileSync(resolve(dir, `${slug}.json`), JSON.stringify(payload), 'utf-8')
  } catch {}
}

export { AnalyticsEngine }

/**
 * DayAnalytics.jsx — Detailed analytics for a selected day
 *
 * Shows:
 * - Individual run details
 * - Aggregated day metrics
 * - Success trends
 * - Operation breakdown
 */

import './DayAnalytics.css'

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString() : '—')
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—')

function relTime(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function ratioColor(r) {
  if (r >= 0.999) return '#00b300'
  if (r >= 0.5) return '#ff9800'
  return '#f44336'
}

export default function DayAnalytics({ day, runs, stats }) {
  if (!day || !stats) {
    return <div className="day-analytics day-analytics--empty">Select a day to see analytics</div>
  }

  const dayDate = new Date(day)
  const formatted = dayDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // Sort runs by time
  const sortedRuns = [...runs].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))

  // Calculate additional metrics
  const avgDuration = sortedRuns.length > 0 ? sortedRuns.reduce((sum, r) => sum + (r.durationMs || 0), 0) / sortedRuns.length : 0
  const allGreen = sortedRuns.filter((r) => r.stepsOk === r.stepsTotal).length
  const published = stats.lastRun?.kpis?.published || 0
  const deleted = stats.lastRun?.kpis?.deleted || 0
  const localized = stats.lastRun?.kpis?.localized || 0

  // Success trends (per run)
  const successTrend = sortedRuns.map((r) => ({
    time: new Date(r.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    rate: r.stepsTotal > 0 ? (r.stepsOk / r.stepsTotal) * 100 : 0,
    color: ratioColor(r.stepsTotal > 0 ? r.stepsOk / r.stepsTotal : 0),
  }))

  return (
    <div className="day-analytics">
      <div className="day-analytics__header">
        <h3 className="day-analytics__date">{formatted}</h3>
        <p className="day-analytics__subtitle">
          {stats.count} run{stats.count !== 1 ? 's' : ''} · {stats.stepsOk}/{stats.stepsTotal} steps ok ·{' '}
          <span style={{ color: ratioColor(stats.successRate) }}>
            {(stats.successRate * 100).toFixed(0)}% success
          </span>
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="day-analytics__metrics">
        <div className="metric">
          <div className="metric__value">{stats.count}</div>
          <div className="metric__label">Runs</div>
        </div>
        <div className="metric">
          <div className="metric__value" style={{ color: ratioColor(stats.successRate) }}>
            {pct(stats.stepsOk, stats.stepsTotal)}
          </div>
          <div className="metric__label">Success Rate</div>
        </div>
        <div className="metric">
          <div className="metric__value">{allGreen}</div>
          <div className="metric__label">All-Green Runs</div>
        </div>
        <div className="metric">
          <div className="metric__value">{(avgDuration / 1000).toFixed(1)}s</div>
          <div className="metric__label">Avg Duration</div>
        </div>
        <div className="metric">
          <div className="metric__value">{fmt(stats.created)}</div>
          <div className="metric__label">Entries Created</div>
        </div>
        <div className="metric">
          <div className="metric__value" style={{ color: stats.errors > 0 ? '#f44336' : '#00b300' }}>
            {stats.errors}
          </div>
          <div className="metric__label">Errors</div>
        </div>
      </div>

      {/* Success Trend */}
      {successTrend.length > 0 && (
        <div className="day-analytics__section">
          <h4 className="day-analytics__section-title">Success Trend (per run)</h4>
          <div className="trend">
            {successTrend.map((point, idx) => (
              <div
                key={idx}
                className="trend__point"
                style={{
                  height: `${Math.max(4, point.rate)}%`,
                  background: point.color,
                }}
                title={`${point.time}: ${point.rate.toFixed(0)}%`}
              />
            ))}
          </div>
          <div className="trend__labels">
            <span>First run</span>
            <span>Last run</span>
          </div>
        </div>
      )}

      {/* Individual Runs */}
      <div className="day-analytics__section">
        <h4 className="day-analytics__section-title">Individual Runs</h4>
        <div className="runs-list">
          {sortedRuns.map((run, idx) => {
            const ratio = run.stepsTotal ? run.stepsOk / run.stepsTotal : 0
            const isGreen = run.stepsOk === run.stepsTotal
            return (
              <div key={run.runId} className={`run-item ${isGreen ? 'run-item--green' : ''}`}>
                <div className="run-item__time">{new Date(run.startedAt).toLocaleTimeString()}</div>
                <div className="run-item__stats">
                  <span className="run-item__stat">
                    <strong>{run.stepsOk}/{run.stepsTotal}</strong> steps
                  </span>
                  <span className="run-item__stat">
                    <strong>{fmt(run.kpis?.created || 0)}</strong> created
                  </span>
                  <span className="run-item__stat">
                    <strong>{fmt(run.kpis?.published || 0)}</strong> published
                  </span>
                  <span className="run-item__stat">
                    <strong>{(run.durationMs / 1000).toFixed(1)}s</strong>
                  </span>
                  {run.errors?.length > 0 && (
                    <span className="run-item__stat run-item__stat--error">
                      <strong>{run.errors.length}</strong> errors
                    </span>
                  )}
                </div>
                <div className="run-item__bar" style={{ background: ratioColor(ratio), width: `${ratio * 100}%` }}></div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Operations Summary */}
      {stats.created > 0 && (
        <div className="day-analytics__section">
          <h4 className="day-analytics__section-title">Operations Summary</h4>
          <div className="ops-grid">
            <div className="op-card">
              <div className="op-card__number">{fmt(stats.created)}</div>
              <div className="op-card__label">Created</div>
              <div className="op-card__bar" style={{ background: '#4da6ff' }}></div>
            </div>
            <div className="op-card">
              <div className="op-card__number">{fmt(published)}</div>
              <div className="op-card__label">Published</div>
              <div className="op-card__bar" style={{ background: '#00b300' }}></div>
            </div>
            <div className="op-card">
              <div className="op-card__number">{fmt(deleted)}</div>
              <div className="op-card__label">Deleted</div>
              <div className="op-card__bar" style={{ background: '#ff9800' }}></div>
            </div>
            <div className="op-card">
              <div className="op-card__number">{fmt(localized)}</div>
              <div className="op-card__label">Localized</div>
              <div className="op-card__bar" style={{ background: '#9c27b0' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

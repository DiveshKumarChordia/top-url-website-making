import { useEffect, useMemo, useState } from 'react'
import './RunsDashboard.css'

// Where the rolling run history lives. drive-all appends each run to
// public/run-history.json (committed back by CI); override with
// VITE_RUN_HISTORY_URL if you serve it elsewhere (e.g. a run-data branch raw URL).
const HISTORY_URL =
  import.meta.env.VITE_RUN_HISTORY_URL || '/run-history.json'

function relTime(iso) {
  if (!iso) return '—'
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

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString() : '—')

function ratioColor(r) {
  if (r >= 0.999) return 'var(--ok)'
  if (r >= 0.5) return 'var(--warn)'
  return 'var(--bad)'
}

export default function RunsDashboard() {
  const [runs, setRuns] = useState(null) // null = loading
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetch(HISTORY_URL, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => alive && setRuns(Array.isArray(data) ? data : []))
      .catch((e) => alive && (setError(e.message), setRuns([])))
    return () => {
      alive = false
    }
  }, [])

  const agg = useMemo(() => {
    const list = runs || []
    const sorted = [...list].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
    const kpis = {}
    let stepsOk = 0
    let stepsTotal = 0
    let durSum = 0
    let plannedTotal = 0
    let actualTotal = 0
    const errors = []
    for (const r of sorted) {
      stepsOk += r.stepsOk || 0
      stepsTotal += r.stepsTotal || 0
      durSum += r.durationMs || 0
      for (const [k, v] of Object.entries(r.kpis || {})) {
        if (typeof v === 'number') kpis[k] = (kpis[k] || 0) + v
      }
      for (const s of r.steps || []) {
        if (Number.isFinite(s.planned)) plannedTotal += s.planned
        if (Number.isFinite(s.actual)) actualTotal += s.actual
      }
      for (const e of r.errors || []) {
        errors.push({ ...e, at: r.startedAt, runId: r.runId, instance: r.instance })
      }
    }
    const fullyGreen = sorted.filter((r) => r.stepsTotal && r.stepsOk === r.stepsTotal).length
    return {
      sorted,
      kpis,
      stepsOk,
      stepsTotal,
      stepRate: stepsTotal ? stepsOk / stepsTotal : 0,
      runRate: sorted.length ? fullyGreen / sorted.length : 0,
      avgDurMs: sorted.length ? durSum / sorted.length : 0,
      plannedTotal,
      actualTotal,
      errors: errors.reverse().slice(0, 60),
      last: sorted[sorted.length - 1] || null,
    }
  }, [runs])

  if (runs === null) return <div className="runs"><p className="runs__muted">Loading run history…</p></div>

  if (!runs.length) {
    return (
      <div className="runs">
        <h1 className="runs__h1">Automation Runs</h1>
        <p className="runs__muted">
          No runs recorded yet{error ? ` (${error})` : ''}. The dashboard reads{' '}
          <code>{HISTORY_URL}</code>, which the GitHub Actions cron appends to on
          each <code>drive-all</code> run.
        </p>
      </div>
    )
  }

  const chartRuns = agg.sorted.slice(-50)
  const cards = [
    { label: 'Runs', value: fmt(agg.sorted.length) },
    { label: 'Entries created', value: fmt(agg.kpis.created || 0) },
    { label: 'Entries deleted', value: fmt(agg.kpis.deleted || 0) },
    { label: 'Localized', value: fmt(agg.kpis.localized || 0) },
    { label: 'Churn cases ok', value: fmt(agg.kpis.casesOk || 0) },
    { label: 'Churn failed', value: fmt(agg.kpis.casesFailed || 0), bad: (agg.kpis.casesFailed || 0) > 0 },
  ]

  return (
    <div className="runs">
      <header className="runs__head">
        <h1 className="runs__h1">Automation Runs</h1>
        <p className="runs__sub">
          {agg.sorted.length} runs · last {relTime(agg.last?.startedAt)} on{' '}
          <code>{agg.last?.instance || 'local'}</code> ·{' '}
          <strong style={{ color: ratioColor(agg.stepRate) }}>
            {(agg.stepRate * 100).toFixed(0)}%
          </strong>{' '}
          steps ok · avg {(agg.avgDurMs / 1000).toFixed(1)}s
        </p>
      </header>

      <section className="runs__cards">
        {cards.map((c) => (
          <div key={c.label} className={`kpi ${c.bad ? 'kpi--bad' : ''}`}>
            <div className="kpi__value">{c.value}</div>
            <div className="kpi__label">{c.label}</div>
          </div>
        ))}
      </section>

      <section className="runs__panel">
        <h2 className="runs__h2">Step success per run <span className="runs__hint">(last {chartRuns.length})</span></h2>
        <div className="bars" role="img" aria-label="Step success ratio per run">
          {chartRuns.map((r) => {
            const ratio = r.stepsTotal ? r.stepsOk / r.stepsTotal : 0
            return (
              <div
                key={r.runId}
                className="bars__bar"
                style={{ height: `${Math.max(4, ratio * 100)}%`, background: ratioColor(ratio) }}
                title={`${r.startedAt} · ${r.stepsOk}/${r.stepsTotal} ok · ${(r.durationMs / 1000).toFixed(1)}s · ${r.instance}`}
              />
            )
          })}
        </div>
      </section>

      <section className="runs__panel">
        <h2 className="runs__h2">Planned vs actual <span className="runs__hint">(all runs, instrumented steps)</span></h2>
        <PlannedVsActual planned={agg.plannedTotal} actual={agg.actualTotal} />
      </section>

      <section className="runs__panel">
        <h2 className="runs__h2">Recent runs</h2>
        <div className="runs__tablewrap">
          <table className="runs__table">
            <thead>
              <tr><th>When</th><th>Mode</th><th>Instance</th><th>Steps</th><th>Created</th><th>Deleted</th><th>Localized</th><th>Errors</th><th>Time</th></tr>
            </thead>
            <tbody>
              {[...agg.sorted].reverse().slice(0, 25).map((r) => {
                const ratio = r.stepsTotal ? r.stepsOk / r.stepsTotal : 0
                return (
                  <tr key={r.runId}>
                    <td title={r.startedAt}>{relTime(r.startedAt)}</td>
                    <td>{r.mode}{r.dryRun ? ' (dry)' : ''}</td>
                    <td><code>{r.instance}</code></td>
                    <td><span style={{ color: ratioColor(ratio) }}>{r.stepsOk}/{r.stepsTotal}</span></td>
                    <td>{fmt(r.kpis?.created ?? '—')}</td>
                    <td>{fmt(r.kpis?.deleted ?? '—')}</td>
                    <td>{fmt(r.kpis?.localized ?? '—')}</td>
                    <td className={r.errors?.length ? 'runs__err' : ''}>{r.errors?.length || 0}</td>
                    <td>{(r.durationMs / 1000).toFixed(1)}s</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="runs__panel">
        <h2 className="runs__h2">⚠️ Error audit log <span className="runs__hint">(latest {agg.errors.length})</span></h2>
        {agg.errors.length === 0 ? (
          <p className="runs__muted">No errors recorded. ✅</p>
        ) : (
          <div className="runs__tablewrap">
            <table className="runs__table">
              <thead><tr><th>When</th><th>Step</th><th>Case</th><th>Message</th></tr></thead>
              <tbody>
                {agg.errors.map((e, i) => (
                  <tr key={i}>
                    <td title={e.at}>{relTime(e.at)}</td>
                    <td>{e.step}</td>
                    <td>{e.label || '—'}</td>
                    <td className="runs__msg">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function PlannedVsActual({ planned, actual }) {
  const max = Math.max(planned, actual, 1)
  const Bar = ({ label, value, color }) => (
    <div className="pva__row">
      <span className="pva__label">{label}</span>
      <div className="pva__track">
        <div className="pva__fill" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <span className="pva__val">{fmt(value)}</span>
    </div>
  )
  const gap = planned ? Math.round((actual / planned) * 100) : 0
  return (
    <div className="pva">
      <Bar label="Planned" value={planned} color="var(--accent)" />
      <Bar label="Actual" value={actual} color="var(--ok)" />
      <p className="runs__hint">{gap}% of planned operations completed</p>
    </div>
  )
}

import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import './App.css'

const HeroCanvas = lazy(() => import('./components/HeroCanvas.jsx'))

const ENTRY_META = new Set([
  'uid',
  'title',
  'locale',
  'tags',
  'ACL',
  '_in_progress',
  'publish_details',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  '_version',
  '_content_type_uid',
])

function getConfig() {
  const apiKey = import.meta.env.VITE_CONTENTSTACK_API_KEY
  const deliveryToken = import.meta.env.VITE_CONTENTSTACK_DELIVERY_TOKEN
  const environment = import.meta.env.VITE_CONTENTSTACK_ENVIRONMENT
  let deliveryHost = import.meta.env.VITE_CONTENTSTACK_DELIVERY_HOST ?? ''

  deliveryHost = deliveryHost.replace(/\/$/, '')

  return { apiKey, deliveryToken, environment, deliveryHost }
}

function parseContentTypeUids() {
  const raw =
    import.meta.env.VITE_CONTENTSTACK_CONTENT_TYPE_UIDS ?? 'top_url_lines'
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function buildEntriesUrl(deliveryHost, environment, contentTypeUid) {
  const base = `${deliveryHost}/v3/content_types/${contentTypeUid}/entries`
  const params = new URLSearchParams()
  if (environment) params.set('environment', environment)
  const q = params.toString()
  return q ? `${base}?${q}` : base
}

function formatUpdatedAt(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return null
  }
}

function extraFields(entry) {
  const out = {}
  for (const [k, v] of Object.entries(entry)) {
    if (k.startsWith('_') || ENTRY_META.has(k)) continue
    out[k] = v
  }
  return out
}

function EntryCard({ entry }) {
  const [copied, setCopied] = useState(false)
  const extras = extraFields(entry)
  const hasExtras = Object.keys(extras).length > 0
  const updated = formatUpdatedAt(entry.updated_at)

  const copyUid = useCallback(() => {
    const t = String(entry.uid ?? '')
    if (!t || !navigator.clipboard?.writeText) return
    void navigator.clipboard.writeText(t).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }, [entry.uid])

  return (
    <li className="entry-card">
      <div className="entry-card__main">
        <h3 className="entry-card__title">
          {entry.title != null && entry.title !== ''
            ? entry.title
            : '(no title)'}
        </h3>
        {updated ? (
          <p className="entry-card__meta">Updated {updated}</p>
        ) : null}
        <div className="entry-card__uid-row">
          <code className="entry-card__uid" title={entry.uid}>
            {entry.uid}
          </code>
          <button
            type="button"
            className="entry-card__copy"
            onClick={copyUid}
            aria-label="Copy entry UID"
          >
            {copied ? 'Copied' : 'Copy UID'}
          </button>
        </div>
      </div>
      {hasExtras ? (
        <details className="entry-card__details">
          <summary className="entry-card__summary">All fields</summary>
          <pre className="entry-card__pre">
            {JSON.stringify(extras, null, 2)}
          </pre>
        </details>
      ) : null}
    </li>
  )
}

function LoadingSkeleton({ count }) {
  return (
    <div className="skeleton-stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton skeleton--section">
          <div className="skeleton__line skeleton__line--short" />
          <div className="skeleton__line" />
          <div className="skeleton__line" />
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { environment: envUid } = getConfig()

  const reloadEntries = useCallback(async () => {
    const { apiKey, deliveryToken, environment, deliveryHost } = getConfig()

    if (!apiKey || !deliveryToken || !deliveryHost) {
      setLoading(false)
      setError(
        'Missing configuration. Copy .env.example to .env and set VITE_CONTENTSTACK_* variables.',
      )
      setSections([])
      return
    }

    const contentTypeUids = parseContentTypeUids()

    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(
        contentTypeUids.map(async (uid) => {
          const url = buildEntriesUrl(deliveryHost, environment, uid)
          const res = await fetch(url, {
            headers: {
              api_key: apiKey,
              access_token: deliveryToken,
            },
          })
          const body = await res.json().catch(() => ({}))
          if (!res.ok) {
            const msg =
              body.error_message ||
              body.error ||
              `${res.status} ${res.statusText || 'Request failed'}`
            throw new Error(
              `${uid}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`,
            )
          }
          const list = Array.isArray(body.entries) ? body.entries : []
          const sorted = [...list].sort((a, b) => {
            const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0
            const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0
            return tb - ta
          })
          return { contentTypeUid: uid, entries: sorted }
        }),
      )
      setSections(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entries')
      setSections([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadEntries()
  }, [reloadEntries])

  const contentTypeUids = parseContentTypeUids()
  const totalEntries = sections.reduce((n, s) => n + s.entries.length, 0)

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <div className="site-header__brand">
            <span className="site-header__logo" aria-hidden="true" />
            <div>
              <p className="site-header__title">Contentstack</p>
              <p className="site-header__subtitle">Delivery preview</p>
            </div>
          </div>
          <div className="site-header__actions">
            <button
              type="button"
              className="site-header__refresh"
              onClick={() => void reloadEntries()}
              disabled={loading}
              aria-busy={loading}
              aria-label="Reload entries from Contentstack"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            {envUid ? (
              <span className="env-badge" title="VITE_CONTENTSTACK_ENVIRONMENT">
                {envUid}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <section className="hero-canvas-wrap" aria-label="Decorative 3D graphic">
        <Suspense
          fallback={<div className="hero-canvas hero-canvas--fallback" />}
        >
          <HeroCanvas />
        </Suspense>
      </section>

      <main className="page">
        <div className="page__intro">
          <h1 className="page__headline">Entries</h1>
          <p className="page__lede">
            Live data from your stack for{' '}
            <span className="page__types">
              {contentTypeUids.map((uid, i) => (
                <span key={uid} className="page__type-chip">
                  {i > 0 ? ' · ' : ''}
                  <code>{uid}</code>
                </span>
              ))}
            </span>
          </p>
          {!loading && !error ? (
            <dl className="stats">
              <div className="stats__item">
                <dt className="stats__label">Content types</dt>
                <dd className="stats__value">{contentTypeUids.length}</dd>
              </div>
              <div className="stats__item">
                <dt className="stats__label">Entries</dt>
                <dd className="stats__value">{totalEntries}</dd>
              </div>
            </dl>
          ) : null}
        </div>

        {loading ? <LoadingSkeleton count={Math.min(contentTypeUids.length, 4)} /> : null}

        {error ? (
          <div className="banner banner--error" role="alert">
            <strong className="banner__title">Something went wrong</strong>
            <p className="banner__text">{error}</p>
          </div>
        ) : null}

        {!loading && !error && totalEntries === 0 ? (
          <div className="banner banner--neutral">
            <strong className="banner__title">No entries yet</strong>
            <p className="banner__text">
              Publish content to this environment or check your delivery token,
              environment uid, and content type list in{' '}
              <code>VITE_CONTENTSTACK_CONTENT_TYPE_UIDS</code>.
            </p>
          </div>
        ) : null}

        {!loading &&
          !error &&
          sections.map(({ contentTypeUid, entries }) => (
            <section key={contentTypeUid} className="ct-panel">
              <div className="ct-panel__header">
                <h2 className="ct-panel__title">
                  <code className="ct-panel__uid">{contentTypeUid}</code>
                </h2>
                <span className="ct-panel__badge">{entries.length}</span>
              </div>
              {entries.length > 0 ? (
                <ul className="entry-grid">
                  {entries.map((entry) => (
                    <EntryCard key={entry.uid} entry={entry} />
                  ))}
                </ul>
              ) : (
                <p className="ct-panel__empty">No entries for this type.</p>
              )}
            </section>
          ))}
      </main>

      <footer className="site-footer">
        <p>Powered by Contentstack Delivery API · Read-only</p>
      </footer>
    </>
  )
}

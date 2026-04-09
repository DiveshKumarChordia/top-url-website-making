import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { deriveExcerptFromExtras } from './lib/entryExcerpt.js'
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

function deliveryResponseMessage(body, res) {
  const msg =
    body.error_message ??
    body.error ??
    `${res.status} ${res.statusText || 'Request failed'}`
  return typeof msg === 'string' ? msg : JSON.stringify(msg)
}

/** Delivery 404/422 often means the content type uid does not exist on this stack. */
function isMissingContentTypeError(res, message) {
  if (res.status === 404 || res.status === 422) return true
  const m = message.toLowerCase()
  if (m.includes('content type') && m.includes('not found')) return true
  if (m.includes('was not found')) return true
  return false
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

function formatRelativeOrAbsolute(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const diffMs = Date.now() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 45) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return formatUpdatedAt(iso)
}

function humanizeContentTypeUid(uid) {
  return uid
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function extraFields(entry) {
  const out = {}
  for (const [k, v] of Object.entries(entry)) {
    if (k.startsWith('_') || ENTRY_META.has(k)) continue
    out[k] = v
  }
  return out
}

function DigestItem({ entry, contentTypeUid }) {
  const [copied, setCopied] = useState(false)
  const extras = extraFields(entry)
  const hasExtras = Object.keys(extras).length > 0
  const excerpt = deriveExcerptFromExtras(extras)
  const updated = formatRelativeOrAbsolute(entry.updated_at)
  const typeLabel = humanizeContentTypeUid(contentTypeUid)
  const title =
    entry.title != null && String(entry.title).trim() !== ''
      ? String(entry.title)
      : 'Untitled entry'

  const copyUid = useCallback(() => {
    const t = String(entry.uid ?? '')
    if (!t || !navigator.clipboard?.writeText) return
    void navigator.clipboard.writeText(t).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }, [entry.uid])

  return (
    <li className="digest-item">
      <div className="digest-item__head">
        <span className="digest-badge">{typeLabel}</span>
        {updated ? (
          <time
            className="digest-item__time"
            dateTime={entry.updated_at ?? undefined}
            title={formatUpdatedAt(entry.updated_at) ?? undefined}
          >
            {updated}
          </time>
        ) : null}
      </div>
      <h2 className="digest-item__title">{title}</h2>
      {excerpt ? <p className="digest-item__excerpt">{excerpt}</p> : null}
      <div className="digest-item__actions">
        <button
          type="button"
          className="digest-item__copy"
          onClick={copyUid}
          aria-label="Copy entry UID"
        >
          {copied ? 'Copied' : 'Copy UID'}
        </button>
      </div>
      {hasExtras ? (
        <details className="digest-item__details">
          <summary className="digest-item__summary">Details</summary>
          <pre className="digest-item__pre">
            {JSON.stringify(extras, null, 2)}
          </pre>
        </details>
      ) : null}
    </li>
  )
}

function DigestSkeleton({ count }) {
  return (
    <div className="digest-skeleton-stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="digest-skeleton">
          <div className="digest-skeleton__line digest-skeleton__line--short" />
          <div className="digest-skeleton__line" />
          <div className="digest-skeleton__line digest-skeleton__line--med" />
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [skippedTypes, setSkippedTypes] = useState([])
  const [digestFilter, setDigestFilter] = useState(null)
  const { environment: envUid } = getConfig()

  const reloadEntries = useCallback(async () => {
    const { apiKey, deliveryToken, environment, deliveryHost } = getConfig()

    if (!apiKey || !deliveryToken || !deliveryHost) {
      setLoading(false)
      setError(
        'Missing configuration. Copy .env.example to .env and set VITE_CONTENTSTACK_* variables.',
      )
      setSections([])
      setSkippedTypes([])
      return
    }

    const contentTypeUids = parseContentTypeUids()

    setLoading(true)
    setError(null)
    setSkippedTypes([])
    try {
      const okSections = []
      const skipped = []

      for (const uid of contentTypeUids) {
        const url = buildEntriesUrl(deliveryHost, environment, uid)
        const res = await fetch(url, {
          headers: {
            api_key: apiKey,
            access_token: deliveryToken,
          },
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = deliveryResponseMessage(body, res)
          if (isMissingContentTypeError(res, msg)) {
            skipped.push({ uid, detail: msg })
            continue
          }
          throw new Error(`${uid}: ${msg}`)
        }
        const list = Array.isArray(body.entries) ? body.entries : []
        const sorted = [...list].sort((a, b) => {
          const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0
          const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0
          return tb - ta
        })
        okSections.push({ contentTypeUid: uid, entries: sorted })
      }

      setSections(okSections)
      setSkippedTypes(skipped)

      if (okSections.length === 0 && contentTypeUids.length > 0) {
        const allSkipped = skipped.length === contentTypeUids.length
        setError(
          allSkipped
            ? 'None of the configured content types exist on this stack. Run npm run automate:manifest for this stack, or set VITE_CONTENTSTACK_CONTENT_TYPE_UIDS to types that exist.'
            : 'No content could be loaded for the configured types.',
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entries')
      setSections([])
      setSkippedTypes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadEntries()
  }, [reloadEntries])

  useEffect(() => {
    const loaded = new Set(sections.map((s) => s.contentTypeUid))
    if (digestFilter != null && !loaded.has(digestFilter)) {
      setDigestFilter(null)
    }
  }, [sections, digestFilter])

  const contentTypeUids = parseContentTypeUids()
  const filterUids = useMemo(
    () =>
      contentTypeUids.filter((uid) =>
        sections.some((s) => s.contentTypeUid === uid),
      ),
    [contentTypeUids, sections],
  )
  const totalEntries = sections.reduce((n, s) => n + s.entries.length, 0)

  const digestItems = useMemo(() => {
    const rows = sections.flatMap((s) =>
      s.entries.map((e) => ({
        entry: e,
        contentTypeUid: s.contentTypeUid,
        key: `${s.contentTypeUid}:${e.uid}`,
      })),
    )
    rows.sort((a, b) => {
      const ta = a.entry.updated_at
        ? new Date(a.entry.updated_at).getTime()
        : 0
      const tb = b.entry.updated_at
        ? new Date(b.entry.updated_at).getTime()
        : 0
      return tb - ta
    })
    return rows
  }, [sections])

  const filteredDigest = useMemo(() => {
    if (digestFilter == null) return digestItems
    return digestItems.filter((r) => r.contentTypeUid === digestFilter)
  }, [digestItems, digestFilter])

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <div className="site-header__brand">
            <span className="site-header__logo" aria-hidden="true" />
            <div>
              <p className="site-header__title">Contentstack</p>
              <p className="site-header__subtitle">Stack digest</p>
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

      <main className="page">
        <div className="page__intro">
          <h1 className="page__headline">Latest updates</h1>
          <p className="page__lede">
            Published content from your stack, newest first—like a lightweight
            changelog across your selected types. Use Refresh after automation
            or publishes to reload.
          </p>
          {!loading && !error ? (
            <p className="page__intro-meta" aria-live="polite">
              {skippedTypes.length > 0 ? (
                <>
                  <strong>{sections.length}</strong> of{' '}
                  <strong>{contentTypeUids.length}</strong> types loaded ·{' '}
                </>
              ) : (
                <>
                  <strong>{contentTypeUids.length}</strong> types ·{' '}
                </>
              )}
              <strong>{totalEntries}</strong> entries
            </p>
          ) : null}
        </div>

        {!loading && !error && totalEntries > 0 ? (
          <div
            className="digest-filters"
            role="group"
            aria-label="Filter by content type"
          >
            <button
              type="button"
              className={
                digestFilter == null
                  ? 'digest-filter digest-filter--active'
                  : 'digest-filter'
              }
              onClick={() => setDigestFilter(null)}
            >
              All
            </button>
            {filterUids.map((uid) => (
              <button
                key={uid}
                type="button"
                className={
                  digestFilter === uid
                    ? 'digest-filter digest-filter--active'
                    : 'digest-filter'
                }
                onClick={() => setDigestFilter(uid)}
              >
                {humanizeContentTypeUid(uid)}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? <DigestSkeleton count={5} /> : null}

        {error ? (
          <div className="banner banner--error" role="alert">
            <strong className="banner__title">Something went wrong</strong>
            <p className="banner__text">{error}</p>
          </div>
        ) : null}

        {!loading && !error && skippedTypes.length > 0 ? (
          <div className="banner banner--neutral" role="status">
            <strong className="banner__title">Some types are not on this stack</strong>
            <p className="banner__text">
              Skipped:{' '}
              {skippedTypes.map((s) => s.uid).join(', ')}. Run{' '}
              <code>npm run automate:manifest</code> for this stack, or remove them
              from <code>VITE_CONTENTSTACK_CONTENT_TYPE_UIDS</code>.
            </p>
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

        {!loading && !error && filteredDigest.length > 0 ? (
          <ol className="digest-feed">
            {filteredDigest.map(({ entry, contentTypeUid, key }) => (
              <DigestItem
                key={key}
                entry={entry}
                contentTypeUid={contentTypeUid}
              />
            ))}
          </ol>
        ) : null}

        {!loading && !error && totalEntries > 0 && filteredDigest.length === 0 ? (
          <p className="digest-empty-filter">No entries for this type.</p>
        ) : null}

        <section className="hero-canvas-wrap" aria-label="Decorative 3D graphic">
          <Suspense
            fallback={<div className="hero-canvas hero-canvas--fallback" />}
          >
            <HeroCanvas />
          </Suspense>
        </section>
      </main>

      <footer className="site-footer">
        <p>Read-only preview · Contentstack Delivery API</p>
      </footer>
    </>
  )
}

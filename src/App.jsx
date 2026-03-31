import { useEffect, useState } from 'react'
import './App.css'

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

export default function App() {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const { apiKey, deliveryToken, environment, deliveryHost } = getConfig()

    if (!apiKey || !deliveryToken || !deliveryHost) {
      setLoading(false)
      setError(
        'Missing configuration. Copy .env.example to .env and set VITE_CONTENTSTACK_* variables.',
      )
      return
    }

    const contentTypeUids = parseContentTypeUids()

    async function load() {
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
            return { contentTypeUid: uid, entries: list }
          }),
        )
        setSections(results)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load entries')
        setSections([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const contentTypeUids = parseContentTypeUids()
  const totalEntries = sections.reduce((n, s) => n + s.entries.length, 0)

  return (
    <main className="page">
      <header className="header">
        <h1>Contentstack entries</h1>
        <p className="lede">
          Delivery API — content types:{' '}
          {contentTypeUids.map((uid, i) => (
            <span key={uid}>
              {i > 0 ? ', ' : ''}
              <code>{uid}</code>
            </span>
          ))}
          {contentTypeUids.length > 1 && (
            <span className="lede__hint">
              {' '}
              (set <code>VITE_CONTENTSTACK_CONTENT_TYPE_UIDS</code> as a
              comma-separated list)
            </span>
          )}
        </p>
      </header>

      {loading && <p className="status">Loading…</p>}

      {error && (
        <div className="message message--error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && totalEntries === 0 && (
        <div className="message">
          No entries returned. Publish entries to the configured environment, or
          check your delivery token, environment uid, and content type UIDs.
        </div>
      )}

      {!loading &&
        !error &&
        sections.map(({ contentTypeUid, entries }) => (
          <section key={contentTypeUid} className="ct-section">
            <h2 className="ct-section__heading">
              <code>{contentTypeUid}</code>
              <span className="ct-section__count">{entries.length} entries</span>
            </h2>
            {entries.length > 0 ? (
              <ol className="entry-list">
                {entries.map((entry) => (
                  <li key={entry.uid} className="entry-list__item">
                    <span className="entry-list__title">
                      {entry.title != null && entry.title !== ''
                        ? entry.title
                        : '(no title)'}
                    </span>
                    <span className="entry-list__uid">{entry.uid}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ct-section__empty">No entries for this type.</p>
            )}
          </section>
        ))}
    </main>
  )
}

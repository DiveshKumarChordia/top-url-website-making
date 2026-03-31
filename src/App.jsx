import { useEffect, useState } from 'react'
import './App.css'

const CONTENT_TYPE_UID = 'top_url_lines'

function getConfig() {
  const apiKey = import.meta.env.VITE_CONTENTSTACK_API_KEY
  const deliveryToken = import.meta.env.VITE_CONTENTSTACK_DELIVERY_TOKEN
  const environment = import.meta.env.VITE_CONTENTSTACK_ENVIRONMENT
  let deliveryHost = import.meta.env.VITE_CONTENTSTACK_DELIVERY_HOST ?? ''

  deliveryHost = deliveryHost.replace(/\/$/, '')

  return { apiKey, deliveryToken, environment, deliveryHost }
}

function buildEntriesUrl(deliveryHost, environment) {
  const base = `${deliveryHost}/v3/content_types/${CONTENT_TYPE_UID}/entries`
  const params = new URLSearchParams()
  if (environment) params.set('environment', environment)
  const q = params.toString()
  return q ? `${base}?${q}` : base
}

export default function App() {
  const [entries, setEntries] = useState([])
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

    const url = buildEntriesUrl(deliveryHost, environment)

    async function load() {
      setLoading(true)
      setError(null)
      try {
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
          throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
        }
        const list = Array.isArray(body.entries) ? body.entries : []
        setEntries(list)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load entries')
        setEntries([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <main className="page">
      <header className="header">
        <h1>Top URL lines</h1>
        <p className="lede">
          Entries from Contentstack content type <code>{CONTENT_TYPE_UID}</code>
          .
        </p>
      </header>

      {loading && <p className="status">Loading…</p>}

      {error && (
        <div className="message message--error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="message">
          No entries returned. Publish entries to the configured environment, or
          check your delivery token and environment name.
        </div>
      )}

      {!loading && entries.length > 0 && (
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
      )}
    </main>
  )
}

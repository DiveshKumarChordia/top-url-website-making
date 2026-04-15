import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deriveExcerptFromExtras } from '../lib/entryExcerpt.js'
import {
  fetchEntryDetail,
  getConfig,
} from '../lib/contentstackDelivery.js'
import {
  extraFields,
  formatRelativeOrAbsolute,
  formatUpdatedAt,
  humanizeContentTypeUid,
} from '../lib/entryFormat.js'

export default function EntryPage() {
  const { contentTypeUid: ctParam, entryUid: uidParam } = useParams()
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const config = getConfig()
    if (!ctParam || !uidParam) {
      setLoading(false)
      setError('Missing route parameters.')
      setEntry(null)
      return
    }
    setLoading(true)
    setError(null)
    const result = await fetchEntryDetail(config, ctParam, uidParam)
    if (!result.ok) {
      setEntry(null)
      if (result.status === 404) {
        setError(
          'This entry was not found or is not published to the configured environment.',
        )
      } else {
        setError(result.error ?? 'Failed to load entry.')
      }
    } else {
      setEntry(result.entry)
      if (!result.entry) {
        setError('No entry payload returned.')
      }
    }
    setLoading(false)
  }, [ctParam, uidParam])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async Delivery fetch for route params
    void load()
  }, [load])

  const config = getConfig()
  const missingEnv =
    !config.apiKey || !config.deliveryToken || !config.deliveryHost

  if (missingEnv) {
    return (
      <main className="page page--entry">
        <div className="banner banner--error" role="alert">
          <strong className="banner__title">Configuration</strong>
          <p className="banner__text">
            Copy .env.example to .env and set VITE_CONTENTSTACK_* variables.
          </p>
        </div>
        <p className="page__back">
          <Link to="/">← Back to entries</Link>
        </p>
      </main>
    )
  }

  const title =
    entry &&
    entry.title != null &&
    String(entry.title).trim() !== ''
      ? String(entry.title)
      : 'Untitled entry'
  const extras = entry ? extraFields(entry) : {}
  const hasExtras = Object.keys(extras).length > 0
  const excerpt = entry ? deriveExcerptFromExtras(extras) : null
  const typeLabel = ctParam
    ? humanizeContentTypeUid(ctParam)
    : ''
  const updated = entry
    ? formatRelativeOrAbsolute(entry.updated_at)
    : null

  return (
    <main className="page page--entry">
      <p className="page__back">
        <Link to="/">← Entries</Link>
      </p>

      {loading ? (
        <div className="entry-detail-skeleton" aria-busy="true" aria-label="Loading">
          <div className="digest-skeleton__line digest-skeleton__line--short" />
          <div className="digest-skeleton__line" />
          <div className="digest-skeleton__line digest-skeleton__line--med" />
        </div>
      ) : null}

      {!loading && error ? (
        <div className="banner banner--error" role="alert">
          <strong className="banner__title">Could not load entry</strong>
          <p className="banner__text">{error}</p>
          <p className="banner__text">
            <Link to="/">Return to home</Link>
          </p>
        </div>
      ) : null}

      {!loading && !error && entry ? (
        <article className="entry-detail">
          <header className="entry-detail__head">
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
          </header>
          <h1 className="entry-detail__title">{title}</h1>
          {excerpt ? (
            <p className="entry-detail__excerpt">{excerpt}</p>
          ) : null}
          <p className="entry-detail__meta">
            <span className="entry-detail__uid-label">UID</span>{' '}
            <code className="entry-detail__uid">{String(entry.uid)}</code>
          </p>
          {hasExtras ? (
            <details className="digest-item__details" open>
              <summary className="digest-item__summary">Fields</summary>
              <pre className="digest-item__pre">
                {JSON.stringify(extras, null, 2)}
              </pre>
            </details>
          ) : null}
        </article>
      ) : null}
    </main>
  )
}

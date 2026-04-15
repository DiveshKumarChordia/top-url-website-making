import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { deriveExcerptFromExtras } from '../lib/entryExcerpt.js'
import {
  extraFields,
  formatRelativeOrAbsolute,
  formatUpdatedAt,
  humanizeContentTypeUid,
} from '../lib/entryFormat.js'

export function DigestItem({ entry, contentTypeUid }) {
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

  const entryPath = `/entry/${encodeURIComponent(contentTypeUid)}/${encodeURIComponent(String(entry.uid ?? ''))}`

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
      <h2 className="digest-item__title">
        <Link className="digest-item__title-link" to={entryPath}>
          {title}
        </Link>
      </h2>
      {excerpt ? <p className="digest-item__excerpt">{excerpt}</p> : null}
      <div className="digest-item__actions">
        <Link className="digest-item__view" to={entryPath}>
          Open page
        </Link>
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

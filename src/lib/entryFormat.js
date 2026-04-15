export const ENTRY_META = new Set([
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

export function formatUpdatedAt(iso) {
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

export function formatRelativeOrAbsolute(iso) {
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

export function humanizeContentTypeUid(uid) {
  return uid
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function extraFields(entry) {
  const out = {}
  for (const [k, v] of Object.entries(entry)) {
    if (k.startsWith('_') || ENTRY_META.has(k)) continue
    out[k] = v
  }
  return out
}

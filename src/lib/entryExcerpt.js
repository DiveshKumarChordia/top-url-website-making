const DEFAULT_MAX = 180

/**
 * @param {string} s
 * @param {number} max
 */
export function truncateExcerpt(s, max = DEFAULT_MAX) {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

function jsonRteToPlain(node) {
  if (!node || typeof node !== 'object') return ''
  let out = ''
  if (typeof node.text === 'string') out += node.text
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      out += jsonRteToPlain(c)
    }
  }
  return out
}

/**
 * @param {unknown} v
 * @param {number} depth
 * @returns {string}
 */
function extractFromValue(v, depth) {
  if (depth > 5) return ''
  if (v == null) return ''
  if (typeof v === 'string') {
    const t = v.trim()
    return t
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)

  if (Array.isArray(v)) {
    for (const item of v) {
      const t = extractFromValue(item, depth + 1)
      if (t) return t
    }
    return ''
  }

  if (typeof v === 'object') {
    if (v.type === 'doc' && Array.isArray(v.children)) {
      return jsonRteToPlain(v)
    }
    for (const val of Object.values(v)) {
      const t = extractFromValue(val, depth + 1)
      if (t) return t
    }
  }

  return ''
}

/**
 * Plain-language excerpt from Delivery entry "body" fields (not uid/meta).
 * @param {Record<string, unknown>} extras from extraFields(entry)
 * @returns {string | null}
 */
export function deriveExcerptFromExtras(extras) {
  for (const v of Object.values(extras)) {
    const raw = extractFromValue(v, 0)
    if (raw) return truncateExcerpt(raw)
  }
  return null
}

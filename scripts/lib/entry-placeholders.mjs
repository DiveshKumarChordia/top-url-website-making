/**
 * Placeholders:
 * - __REF__:<content_type_uid>:first|latest
 * - __TAX_TERMS__:<field_uid> — expands from env CONTENTSTACK_TAXONOMY_TERMS_<FIELDUID> (uppercase, safe)
 */

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function envKeyForTaxTerms(fieldUid) {
  return `CONTENTSTACK_TAXONOMY_TERMS_${String(fieldUid).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
}

function taxTermsFromEnv(fieldUid) {
  const raw = process.env[envKeyForTaxTerms(fieldUid)] || ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const REF_RE = /^__REF__:([^:]+):(first|latest)$/
const TAX_RE = /^__TAX_TERMS__:([^:]+)$/

export class EntryUidRegistry {
  /** @type {Map<string, { first?: string, latest?: string }>} */
  #byCt = new Map()

  record(contentTypeUid, entryUid) {
    const cur = this.#byCt.get(contentTypeUid) || {}
    if (!cur.first) cur.first = entryUid
    cur.latest = entryUid
    this.#byCt.set(contentTypeUid, cur)
  }

  resolve(contentTypeUid, which) {
    const cur = this.#byCt.get(contentTypeUid)
    if (!cur) {
      throw new Error(
        `__REF__ placeholder: no entry recorded for content type "${contentTypeUid}". Create referenced type first in manifest order.`,
      )
    }
    const uid = which === 'first' ? cur.first : cur.latest
    if (!uid) {
      throw new Error(
        `__REF__ placeholder: ${which} missing for "${contentTypeUid}"`,
      )
    }
    return uid
  }
}

function normalizeModularBlockItem(block) {
  if (
    block &&
    typeof block === 'object' &&
    typeof block.block_type === 'string'
  ) {
    const { block_type, ...rest } = block
    return { [block_type]: rest }
  }
  return block
}

function normalizeModularBlocksInValue(value) {
  if (!Array.isArray(value)) return value
  return value.map((item) => normalizeModularBlockItem(item))
}

/**
 * Convert flat block_type rows to Contentstack blocks shape when applicable.
 * @param {object} entry
 */
export function normalizeBlocksEntryShape(entry) {
  if (!entry || typeof entry !== 'object') return entry
  const out = { ...entry }
  for (const key of Object.keys(out)) {
    out[key] = normalizeModularBlocksInValue(out[key])
  }
  return out
}

/**
 * @param {unknown} value
 * @param {EntryUidRegistry} registry
 */
function resolveValue(value, registry) {
  if (typeof value === 'string') {
    const refM = value.match(REF_RE)
    if (refM) {
      return registry.resolve(refM[1], refM[2])
    }
    const taxM = value.match(TAX_RE)
    if (taxM) {
      return taxTermsFromEnv(taxM[1])
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveValue(v, registry))
  }
  if (value && typeof value === 'object') {
    const o = {}
    for (const k of Object.keys(value)) {
      o[k] = resolveValue(value[k], registry)
    }
    return o
  }
  return value
}

/**
 * @param {object} entryFields
 * @param {EntryUidRegistry} registry
 */
export function resolveEntryPlaceholders(entryFields, registry) {
  const cloned = deepClone(entryFields)
  const shaped = normalizeBlocksEntryShape(cloned)
  return resolveValue(shaped, registry)
}

/**
 * Resolve placeholders; __REF__ uses resolveRef(ctUid, first|latest) when registry
 * does not have the value (e.g. periodic job across processes).
 * @param {object} entryFields
 * @param {EntryUidRegistry} registry
 * @param {(ctUid: string, which: 'first'|'latest') => Promise<string|null>} [fetchRef]
 */
export async function resolveEntryPlaceholdersAsync(
  entryFields,
  registry,
  fetchRef,
) {
  const shaped = normalizeBlocksEntryShape(deepClone(entryFields))

  async function resolveOne(value) {
    if (typeof value === 'string') {
      const refM = value.match(REF_RE)
      if (refM) {
        const ct = refM[1]
        const which = refM[2]
        try {
          return registry.resolve(ct, which)
        } catch {
          if (fetchRef) {
            const uid = await fetchRef(ct, which)
            if (!uid) {
              throw new Error(
                `__REF__ could not resolve ${ct}:${which} (no entry found)`,
              )
            }
            return uid
          }
          throw new Error(
            `__REF__ could not resolve ${ct}:${which} (registry miss and no fetchRef)`,
          )
        }
      }
      const taxM = value.match(TAX_RE)
      if (taxM) {
        return taxTermsFromEnv(taxM[1])
      }
      return value
    }
    if (Array.isArray(value)) {
      return Promise.all(value.map((v) => resolveOne(v)))
    }
    if (value && typeof value === 'object') {
      const o = {}
      for (const k of Object.keys(value)) {
        o[k] = await resolveOne(value[k])
      }
      return o
    }
    return value
  }

  return resolveOne(shaped)
}

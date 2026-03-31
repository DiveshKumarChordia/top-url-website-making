/**
 * Expand manifest shorthand `fields[]` into Contentstack CMA schema definitions.
 * @see https://www.contentstack.com/docs/developers/create-content-types/json-schema-for-creating-a-content-type
 */

function optionalEnv(name) {
  const v = process.env[name]
  if (v == null || String(v).trim() === '') return ''
  return String(v).trim()
}

function taxonomyUidEnvKey(fieldUid) {
  const safe = String(fieldUid).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()
  return `CONTENTSTACK_TAXONOMY_UID_${safe}`
}

export function resolveTaxonomyUidForField(fieldUid) {
  const specific = optionalEnv(taxonomyUidEnvKey(fieldUid))
  if (specific) return specific
  return optionalEnv('CONTENTSTACK_TAXONOMY_UID')
}

function baseField(f, data_type, extra = {}) {
  const display_name = f.display_name || f.uid
  return {
    data_type,
    display_name,
    uid: f.uid,
    mandatory: Boolean(f.mandatory),
    multiple: Boolean(f.multiple),
    non_localizable: Boolean(f.non_localizable),
    ...extra,
  }
}

function expandOneField(f) {
  if (!f?.uid) throw new Error('Each field needs uid')
  const type = f.data_type || f.type
  if (!type) throw new Error(`Field ${f.uid}: missing data_type`)

  switch (type) {
    case 'text':
      return baseField(f, 'text', {
        field_metadata: f.field_metadata || {
          version: 3,
        },
      })
    case 'textarea':
      return baseField(f, 'text', {
        field_metadata: {
          version: 3,
          multiline: true,
          ...(f.field_metadata || {}),
        },
      })
    case 'markdown':
      return baseField(f, 'text', {
        field_metadata: {
          description: '',
          markdown: true,
          version: 3,
          ...(f.field_metadata || {}),
        },
      })
    case 'number':
      return baseField(f, 'number', {
        field_metadata: f.field_metadata || {},
      })
    case 'boolean':
      return baseField(f, 'boolean', {
        field_metadata: f.field_metadata || {},
      })
    case 'date':
      return baseField(f, 'isodate', {
        startDate: f.startDate ?? null,
        endDate: f.endDate ?? null,
        field_metadata: {
          description: '',
          default_value: '',
          ...(f.field_metadata || {}),
        },
      })
    case 'link':
      return baseField(f, 'link', {
        field_metadata: f.field_metadata || {},
      })
    case 'file':
      return baseField(f, 'file', {
        field_metadata: f.field_metadata || {},
      })
    case 'json_rte':
    case 'json': {
      return baseField(f, 'json', {
        field_metadata: {
          allow_json_rte: true,
          ...(f.field_metadata || {}),
        },
      })
    }
    case 'rich_text':
      return baseField(f, 'rich_text', {
        field_metadata: f.field_metadata || {},
      })
    case 'reference': {
      const refTo = f.reference_to
      if (!refTo)
        throw new Error(`reference field ${f.uid}: set reference_to (content type uid)`)
      const reference_to = Array.isArray(refTo) ? refTo : [refTo]
      return baseField(f, 'reference', {
        reference_to,
        field_metadata: f.field_metadata || {},
      })
    }
    case 'group': {
      const nested = f.schema || f.fields
      if (!Array.isArray(nested)) {
        throw new Error(
          `group field ${f.uid}: schema[] or fields[] array required`,
        )
      }
      const schema = nested.map((item) => expandOneField(item))
      return baseField(f, 'group', {
        schema,
        field_metadata: f.field_metadata || {},
      })
    }
    case 'blocks': {
      const blocksSpec = f.blocks
      if (!Array.isArray(blocksSpec)) {
        throw new Error(`blocks field ${f.uid}: blocks[] required`)
      }
      const blocks = blocksSpec.map((b) => {
        if (!b.uid) throw new Error('Each block needs uid')
        const nested = b.schema || b.fields
        if (!Array.isArray(nested)) {
          throw new Error(`block ${b.uid}: schema[] or fields[] required`)
        }
        const schema = nested.map((item) => expandOneField(item))
        return {
          title: b.title || b.display_name || b.uid,
          uid: b.uid,
          schema,
        }
      })
      // CMA requires Modular Blocks (data_type blocks) to be multiple: true
      return baseField({ ...f, multiple: true }, 'blocks', { blocks })
    }
    case 'taxonomy': {
      const taxonomy_uid =
        f.taxonomy_uid || resolveTaxonomyUidForField(f.uid)
      if (!taxonomy_uid) {
        throw new Error(
          `taxonomy field ${f.uid}: set taxonomy_uid on the field or env ${taxonomyUidEnvKey(f.uid)} / CONTENTSTACK_TAXONOMY_UID`,
        )
      }
      return baseField(f, 'taxonomy', {
        taxonomy_uid,
        field_metadata: f.field_metadata || {},
      })
    }
    default:
      throw new Error(
        `Unsupported shorthand data_type "${type}" on field ${f.uid}. Use full schema[] on the content type instead.`,
      )
  }
}

/**
 * @param {object[]} fields
 * @returns {object[]}
 */
export function expandFields(fields) {
  if (!fields || fields.length === 0) return []
  return fields.map((item) => expandOneField(item))
}

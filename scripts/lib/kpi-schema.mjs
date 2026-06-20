/**
 * kpi-schema.mjs — Standard KPI field definitions
 * Ensures consistent metrics across all automation scripts
 */

export const KPI_SCHEMA = {
  created: { type: 'number', description: 'Entries created', default: 0 },
  deleted: { type: 'number', description: 'Entries deleted', default: 0 },
  published: { type: 'number', description: 'Entries published', default: 0 },
  unpublished: { type: 'number', description: 'Entries unpublished', default: 0 },
  localized: { type: 'number', description: 'Entries localized', default: 0 },
  transitioned: { type: 'number', description: 'Workflow transitions', default: 0 },
  deletedOver30d: { type: 'number', description: 'Deleted from >30d band', default: 0 },
  deleted15to30d: { type: 'number', description: 'Deleted from 15-30d band', default: 0 },
  deleted7to15d: { type: 'number', description: 'Deleted from 7-15d band', default: 0 },
  deferred: { type: 'number', description: 'Deletes deferred', default: 0 },
  already: { type: 'number', description: 'Already localized', default: 0 },
  localizeFailed: { type: 'number', description: 'Localization failures', default: 0 },
  publishFailed: { type: 'number', description: 'Publish failures', default: 0 },
  transitionsSkipped: { type: 'number', description: 'Skipped transitions', default: 0 },
  branchesCreated: { type: 'number', description: 'Branches created', default: 0 },
  branchesDeleted: { type: 'number', description: 'Branches deleted', default: 0 },
  branchEntries: { type: 'number', description: 'Entries in branches', default: 0 },
  secondWaveEntries: { type: 'number', description: 'Post-attach entries', default: 0 },
  branchLocalized: { type: 'number', description: 'Branch localizations', default: 0 },
  branchDeleted: { type: 'number', description: 'Branch/locale deletions', default: 0 },
  dynCtCreated: { type: 'number', description: 'Dynamic CTs created', default: 0 },
  dynCtEntries: { type: 'number', description: 'Entries in dynamic CTs', default: 0 },
  workflowBranchAdds: { type: 'number', description: 'Workflow branch additions', default: 0 },
  publishRules: { type: 'number', description: 'Multi-branch publish rules', default: 0 },
  churnAllWf: { type: 'number', description: 'Workflows churned', default: 0 },
  churnBranch: { type: 'number', description: 'Branches churned', default: 0 },
  churnLocale: { type: 'number', description: 'Locales churned', default: 0 },
  churnDetach: { type: 'number', description: 'CT detach cycles', default: 0 },
  churnDisable: { type: 'number', description: 'WF disable cycles', default: 0 },
  churnRestore: { type: 'number', description: 'Entries restored', default: 0 },
  casesOk: { type: 'number', description: 'Churn cases successful', default: 0 },
  casesFailed: { type: 'number', description: 'Churn cases failed', default: 0 },
  editedPostPublish: { type: 'number', description: 'Edit-after-publish', default: 0 },
  entriesCreated: { type: 'number', description: 'No-workflow CT entries', default: 0 },
  publishedByB: { type: 'number', description: 'Multi-actor publishes', default: 0 },
  invited: { type: 'number', description: 'Users invited', default: 0 },
  inviteFailed: { type: 'number', description: 'Failed invites', default: 0 },
  capHit: { type: 'number', description: 'Entry cap hits', default: 0 },
  failed: { type: 'number', description: 'Create failures', default: 0 },
  localeTargets: { type: 'number', description: 'Locale targets', default: null },
}

export function createNormalizedKPIs(partial = {}) {
  const kpis = {}
  Object.entries(KPI_SCHEMA).forEach(([key, schema]) => {
    kpis[key] = partial[key] ?? schema.default
  })
  return kpis
}

export function validateKPIs(kpis) {
  const errors = []
  Object.entries(KPI_SCHEMA).forEach(([key, schema]) => {
    if (kpis[key] !== undefined && kpis[key] !== null) {
      if (schema.type === 'number' && typeof kpis[key] !== 'number') {
        errors.push(`${key}: expected number, got ${typeof kpis[key]}`)
      }
    }
  })
  return { valid: errors.length === 0, errors }
}

export function getKPIDescription(key) {
  return KPI_SCHEMA[key]?.description || key
}

export function getAllKPIKeys() {
  return Object.keys(KPI_SCHEMA)
}

export function groupKPIsByCategory() {
  return {
    'Entry Lifecycle': ['created', 'deleted', 'published', 'unpublished', 'localized', 'transitioned'],
    'Trimming & Retention': ['deletedOver30d', 'deleted15to30d', 'deleted7to15d', 'deferred'],
    'Localization': ['already', 'localizeFailed'],
    'Publishing': ['publishFailed', 'transitionsSkipped'],
    'Branches': ['branchesCreated', 'branchesDeleted', 'branchEntries', 'secondWaveEntries', 'branchLocalized', 'branchDeleted'],
    'Dynamic CTs': ['dynCtCreated', 'dynCtEntries'],
    'Workflows': ['workflowBranchAdds', 'publishRules'],
    'Churn & Orphans': ['churnAllWf', 'churnBranch', 'churnLocale', 'churnDetach', 'churnDisable', 'churnRestore', 'casesOk', 'casesFailed'],
    'Meter Coverage': ['editedPostPublish', 'entriesCreated', 'publishedByB'],
    'Users & Roles': ['invited', 'inviteFailed'],
    'Capacity': ['capHit'],
    'Failures': ['failed'],
  }
}

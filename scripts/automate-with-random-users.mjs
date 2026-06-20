#!/usr/bin/env node
/**
 * automate-with-random-users.mjs — Run automation with random test users per operation
 *
 * Each operation (create entry, delete entry, transition, etc.) uses a different
 * random user from the pool. Ensures proper auth SDK CMS role validation.
 *
 * Usage:
 *   node --env-file=.env scripts/automate-with-random-users.mjs
 *   node --env-file=.env scripts/automate-with-random-users.mjs --users 10 --operations 50
 */

import { optionalEnv, loadStackAuth, managementHeaders, loadManagementTokens, sleep } from './lib/cma.mjs'
import { createMultipleTestUsers } from './lib/user-factory.mjs'
import { UserPool } from './lib/gmail-utils.mjs'
import { writeStepReport } from './lib/report.mjs'

function intEnv(name, dflt) {
  const v = optionalEnv(name)
  return v && /^\d+$/.test(v.trim()) ? Number.parseInt(v.trim(), 10) : dflt
}

/**
 * Perform operation with random user
 */
async function performOperationWithRandomUser(operation, userPool, context) {
  const user = userPool.getRandomUser()

  console.log(`\n[${operation.name}] User: ${user.email.split('+')[0]}+...`)

  try {
    const result = await operation.handler(user, context)
    console.log(`  ✓ Success`)
    return { ok: true, user: user.email, operation: operation.name, result }
  } catch (e) {
    console.error(`  ✗ Failed: ${e.message}`)
    return { ok: false, user: user.email, operation: operation.name, error: e.message }
  }
}

/**
 * Example operations
 */
const createOperations = (base, apiKey, orgUid, stackApiKey) => [
  {
    name: 'create-entry',
    handler: async (user, ctx) => {
      // Simulate entry creation
      const response = await fetch(`${base}/v3/content_types/${ctx.contentTypeUid}/entries`, {
        method: 'POST',
        headers: {
          authorization: user.authtoken || 'mgmt-token',
          api_key: stackApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entry: {
            title: `Entry by ${user.email.split('@')[0]}`,
            body: `Created at ${new Date().toISOString()}`,
          },
        }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    },
  },

  {
    name: 'list-entries',
    handler: async (user, ctx) => {
      const response = await fetch(`${base}/v3/content_types/${ctx.contentTypeUid}/entries?limit=10`, {
        method: 'GET',
        headers: {
          authorization: user.authtoken || 'mgmt-token',
          api_key: stackApiKey,
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    },
  },

  {
    name: 'list-assets',
    handler: async (user, ctx) => {
      const response = await fetch(`${base}/v3/assets?limit=10`, {
        method: 'GET',
        headers: {
          authorization: user.authtoken || 'mgmt-token',
          api_key: stackApiKey,
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    },
  },

  {
    name: 'get-content-types',
    handler: async (user, ctx) => {
      const response = await fetch(`${base}/v3/content_types`, {
        method: 'GET',
        headers: {
          authorization: user.authtoken || 'mgmt-token',
          api_key: stackApiKey,
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    },
  },

  {
    name: 'get-org-users',
    handler: async (user, ctx) => {
      const response = await fetch(`${base}/v4/organizations/${orgUid}/share/users?limit=100`, {
        method: 'GET',
        headers: {
          authorization: user.authtoken || 'mgmt-token',
          api_key: apiKey,
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    },
  },

  {
    name: 'get-org-roles',
    handler: async (user, ctx) => {
      const response = await fetch(`${base}/v4/organizations/${orgUid}/roles`, {
        method: 'GET',
        headers: {
          authorization: user.authtoken || 'mgmt-token',
          api_key: apiKey,
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    },
  },
]

/**
 * Main automation flow
 */
async function main() {
  const userCount = intEnv('CONTENTSTACK_USER_COUNT', 5)
  const operationCount = intEnv('CONTENTSTACK_OPERATION_COUNT', 20)

  const baseEmail = optionalEnv('CONTENTSTACK_TEST_USER_EMAIL')
  const orgUid = optionalEnv('CONTENTSTACK_ORG_UID')
  const stackApiKey = optionalEnv('CONTENTSTACK_API_KEY')

  const { apiKey, base, branch } = loadStackAuth()
  const tokens = loadManagementTokens()
  const mgmtHeaders = managementHeaders(apiKey, tokens[0], branch)

  console.log('=== Automated Testing with Random Users ===\n')
  console.log(`📊 Configuration:`)
  console.log(`  Users to create: ${userCount}`)
  console.log(`  Operations per user: ${operationCount}`)
  console.log(`  Base email: ${baseEmail || '(not set)'}`)
  console.log(`  Org: ${orgUid || '(not set)'}`)

  if (!baseEmail || !orgUid) {
    throw new Error('Missing CONTENTSTACK_TEST_USER_EMAIL or CONTENTSTACK_ORG_UID')
  }

  // 1. Create user pool
  console.log(`\n🏭 Phase 1: Creating test users...`)
  const userPool = await createMultipleTestUsers(userCount, {
    baseEmail,
    orgUid,
  })

  const createdUsers = userPool.getAllUsers()
  if (createdUsers.length === 0) {
    throw new Error('Failed to create any test users')
  }

  // 2. Get content type (for operations)
  console.log(`\n📋 Phase 2: Fetching content types...`)
  const ctRes = await fetch(`${base}/v3/content_types?limit=1`, {
    method: 'GET',
    headers: mgmtHeaders,
  })
  const ctBody = await ctRes.json()
  const contentTypeUid = ctBody.content_types?.[0]?.uid

  if (!contentTypeUid) {
    console.warn('  ⚠ No content types found, operations will be limited')
  }

  // 3. Run operations with random users
  console.log(`\n🎯 Phase 3: Running operations with random users...`)
  const operations = createOperations(base, apiKey, orgUid, stackApiKey)
  const operationResults = []

  for (let i = 0; i < operationCount; i++) {
    const operation = operations[Math.floor(Math.random() * operations.length)]
    const result = await performOperationWithRandomUser(operation, userPool, {
      contentTypeUid,
    })

    operationResults.push(result)

    // Small delay between operations
    if (i < operationCount - 1) {
      await sleep(200)
    }

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`\n  Progress: ${i + 1}/${operationCount} operations completed`)
    }
  }

  // 4. Summarize results
  console.log(`\n📊 Phase 4: Results`)
  const successful = operationResults.filter((r) => r.ok).length
  const failed = operationResults.filter((r) => !r.ok).length

  console.log(`  ✓ Successful: ${successful}/${operationCount}`)
  console.log(`  ✗ Failed: ${failed}/${operationCount}`)

  // 5. User distribution
  console.log(`\n👥 User Distribution:`)
  const userOps = {}
  operationResults.forEach((r) => {
    if (!userOps[r.user]) userOps[r.user] = 0
    userOps[r.user]++
  })

  Object.entries(userOps).forEach(([email, count]) => {
    console.log(`  ${email.split('+')[0]}+...: ${count} operations`)
  })

  // 6. Operation distribution
  console.log(`\n📋 Operation Distribution:`)
  const opCounts = {}
  operationResults.forEach((r) => {
    if (!opCounts[r.operation]) opCounts[r.operation] = { ok: 0, failed: 0 }
    if (r.ok) opCounts[r.operation].ok++
    else opCounts[r.operation].failed++
  })

  Object.entries(opCounts).forEach(([opName, counts]) => {
    const total = counts.ok + counts.failed
    console.log(`  ${opName}: ${counts.ok}/${total} successful`)
  })

  // 7. Write report
  const report = {
    timestamp: new Date().toISOString(),
    configuration: {
      users_created: createdUsers.length,
      operations_performed: operationCount,
      base_email: baseEmail,
      organization: orgUid,
    },
    results: {
      successful,
      failed,
      success_rate: `${Math.round((successful / operationCount) * 100)}%`,
    },
    user_distribution: userOps,
    operation_distribution: opCounts,
    details: operationResults,
  }

  await writeStepReport('automate-with-random-users', report)

  console.log(`\n✅ Automation completed!`)
  console.log(`Report saved to step-reports/`)
}

main().catch((err) => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})

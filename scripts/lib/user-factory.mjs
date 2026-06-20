/**
 * user-factory.mjs — Create test users with proper CMS role assignment
 *
 * Ensures users follow auth SDK CMS role rules:
 * - Must have explicit stack-level RBAC role
 * - Must have org-level membership
 * - Proper role hierarchy (Owner > Admin > Content Manager > Developer > Member)
 */

import {
  optionalEnv,
  loadStackAuth,
  managementHeaders,
  loadManagementTokens,
  tryLoadUserSessionHeaders,
  getCurrentUser,
  inviteUserToOrganization,
  listOrganizationRoles,
  listStackRoles,
  shareStack,
  ensureUserHasCMSRole,
  sleep,
} from './cma.mjs'
import {
  generateUniqueEmail,
  parseNameFromEmail,
  UserPool,
  UserIterator,
} from './gmail-utils.mjs'

/**
 * Create a new test user with CMS roles
 *
 * @param {object} options - Configuration
 *   - baseEmail: Base email for plus addressing
 *   - orgUid: Organization UID
 *   - orgRoleUid: Organization role UID (default: member)
 *   - stackRoleUid: Stack role UID (default: developer)
 *   - orgHeaders: Headers for org API calls
 *   - stackHeaders: Headers for stack API calls
 *
 * @returns {object} User object with email, password, authtoken, etc.
 */
export async function createTestUser(options = {}) {
  const {
    baseEmail = optionalEnv('CONTENTSTACK_TEST_USER_EMAIL'),
    orgUid = optionalEnv('CONTENTSTACK_ORG_UID'),
    orgRoleUid = null,
    stackRoleUid = null,
  } = options

  if (!baseEmail) {
    throw new Error('Missing baseEmail or CONTENTSTACK_TEST_USER_EMAIL')
  }
  if (!orgUid) {
    throw new Error('Missing orgUid or CONTENTSTACK_ORG_UID')
  }

  const { apiKey, base, branch } = loadStackAuth()
  const tokens = loadManagementTokens()
  const mgmtHeaders = {
    authorization: tokens[0],
    api_key: apiKey,
  }

  // Get user session headers for org API calls
  let userHeaders
  try {
    userHeaders = await tryLoadUserSessionHeaders(base, apiKey, branch)
  } catch (e) {
    console.warn('Could not load user session headers, using management token')
  }

  const headers = userHeaders || mgmtHeaders

  // 1. Generate unique email
  const uniqueEmail = generateUniqueEmail(baseEmail)
  const { firstName, lastName } = parseNameFromEmail(uniqueEmail)
  console.log(`\n📧 Creating user: ${uniqueEmail}`)

  // 2. Get org roles if not provided
  let finalOrgRoleUid = orgRoleUid
  if (!finalOrgRoleUid) {
    const { ok: rOk, body: rBody } = await listOrganizationRoles(base, headers, orgUid)
    if (!rOk || !Array.isArray(rBody?.roles)) {
      throw new Error('Could not fetch organization roles')
    }
    const memberRole = rBody.roles.find((r) => r.domain === 'organization' && r.name === 'member')
    if (!memberRole) {
      throw new Error('Organization has no member role')
    }
    finalOrgRoleUid = memberRole.uid
    console.log(`  Org role: ${memberRole.name} (${memberRole.uid})`)
  }

  // 3. Get stack roles if not provided
  let finalStackRoleUid = stackRoleUid
  if (!finalStackRoleUid) {
    const { ok: sOk, body: sBody } = await listStackRoles(base, mgmtHeaders)
    if (!sOk || !Array.isArray(sBody?.roles)) {
      throw new Error('Could not fetch stack roles')
    }
    // Prefer Developer role, fallback to first non-admin role
    const devRole = sBody.roles.find(
      (r) => r.name?.toLowerCase() === 'developer' && !/(admin|owner)/i.test(r.name)
    )
    const nonAdminRole = sBody.roles.find((r) => !/(admin|owner)/i.test(r.name))
    finalStackRoleUid = (devRole || nonAdminRole || sBody.roles[0]).uid
    console.log(
      `  Stack role: ${devRole?.name || nonAdminRole?.name || sBody.roles[0].name} (${finalStackRoleUid})`
    )
  }

  // 4. Invite user to organization
  console.log(`  Inviting to organization...`)
  const inviteResponse = await inviteUserToOrganization(base, headers, orgUid, {
    emails: [uniqueEmail],
    roles: { [uniqueEmail]: [finalOrgRoleUid] },
  })

  const orgInvitation = inviteResponse.body?.org_invitations?.[0]
  if (!orgInvitation) {
    throw new Error('Failed to invite user to organization')
  }

  const { user_uid, acceptance_token } = orgInvitation
  console.log(`  ✓ Invited to org (user_uid: ${user_uid})`)

  // 5. Wait a moment for user creation to complete
  await sleep(500)

  // 6. Ensure user has stack role (calls shareStack with user session)
  console.log(`  Assigning stack role...`)
  const shareOk = await ensureUserHasCMSRole(base, headers, mgmtHeaders, uniqueEmail)
  if (!shareOk) {
    console.warn(`  ⚠ Could not auto-assign stack role, will need manual assignment`)
  } else {
    console.log(`  ✓ Stack role assigned`)
  }

  // 7. Generate password (for simulated activation)
  const password = generateSecurePassword()

  // 8. Return user object
  const user = {
    email: uniqueEmail,
    password,
    firstName,
    lastName,
    user_uid,
    org_uid: orgUid,
    org_role_uid: finalOrgRoleUid,
    stack_role_uid: finalStackRoleUid,
    acceptance_token,
    created_at: new Date().toISOString(),
    status: 'pending_activation', // Will be activated when needed
  }

  console.log(`  ✓ User created successfully`)
  return user
}

/**
 * Create multiple test users
 *
 * @param {number} count - Number of users to create
 * @param {object} options - Options for createTestUser
 *
 * @returns {UserPool} Pool containing all created users
 */
export async function createMultipleTestUsers(count = 5, options = {}) {
  const { baseEmail = optionalEnv('CONTENTSTACK_TEST_USER_EMAIL') } = options

  if (!baseEmail) {
    throw new Error('Missing baseEmail')
  }

  const pool = new UserPool(baseEmail)

  console.log(`\n🏭 Creating ${count} test users...`)

  for (let i = 0; i < count; i++) {
    try {
      console.log(`\n[${i + 1}/${count}]`)
      const user = await createTestUser(options)

      // Note: In real scenario, we'd login to get authtoken
      // For now, mark as created but not activated
      pool.addUser(user.email, user.password, null, user.user_uid, user.org_uid)

      // Small delay between creations
      if (i < count - 1) {
        await sleep(1000)
      }
    } catch (e) {
      console.error(`  ✗ Failed to create user ${i + 1}: ${e.message}`)
    }
  }

  console.log(`\n✓ Created ${pool.getAllUsers().length}/${count} users`)
  console.log(`Pool stats:`, pool.getStats())

  return pool
}

/**
 * Generate secure password
 */
function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * Activate user and get authtoken
 * (Requires email reading or direct activation endpoint)
 *
 * @param {object} user - User object from createTestUser
 * @param {string} perishableToken - Activation token from email
 * @param {object} options - API options
 *
 * @returns {object} Updated user with authtoken
 */
export async function activateUserAndLogin(user, perishableToken, options = {}) {
  const { apiKey, base, branch } = loadStackAuth()
  const tokens = loadManagementTokens()
  const mgmtHeaders = {
    authorization: tokens[0],
    api_key: apiKey,
  }

  console.log(`\n🔐 Activating user: ${user.email}`)

  // 1. Activate user (set password)
  const activateRes = await fetch(`${base}/v3/user/accept/${perishableToken}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...mgmtHeaders,
    },
    body: JSON.stringify({
      user: {
        password: user.password,
        password_confirmation: user.password,
        org_uid: user.org_uid,
      },
    }),
  })

  if (!activateRes.ok) {
    throw new Error(`User activation failed: ${await activateRes.text()}`)
  }

  console.log(`  ✓ User activated`)

  // 2. Login to get authtoken
  const loginRes = await fetch(`${base}/v3/user-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: { email: user.email, password: user.password },
    }),
  })

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${await loginRes.text()}`)
  }

  const loginData = await loginRes.json()
  const authtoken = loginData.user?.authtokens?.[0]

  if (!authtoken) {
    throw new Error('No authtoken returned from login')
  }

  console.log(`  ✓ Login successful`)

  // Update user object with authtoken
  user.authtoken = authtoken
  user.status = 'active'

  return user
}

/**
 * Get headers for user (auth token or management token)
 *
 * @param {object} user - User object
 * @param {string} fallback - Fallback token if user has no authtoken
 *
 * @returns {object} Headers for API calls
 */
export function getUserHeaders(user, fallback = null) {
  if (user.authtoken) {
    return {
      'Content-Type': 'application/json',
      Authorization: user.authtoken,
    }
  }

  if (fallback) {
    return {
      'Content-Type': 'application/json',
      authorization: fallback,
    }
  }

  throw new Error('User not activated (no authtoken) and no fallback token provided')
}

/**
 * Example usage:
 *
 * // Create single user
 * const user = await createTestUser({
 *   baseEmail: 'divesh.k@contentstack.com',
 *   orgUid: 'org_123'
 * })
 *
 * // Create multiple users
 * const pool = await createMultipleTestUsers(5, {
 *   baseEmail: 'divesh.k@contentstack.com',
 *   orgUid: 'org_123'
 * })
 *
 * // Get random user
 * const randomUser = pool.getRandomUser()
 *
 * // Activate and login
 * const activatedUser = await activateUserAndLogin(randomUser, perishableToken)
 */

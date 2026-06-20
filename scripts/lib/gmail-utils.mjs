/**
 * gmail-utils.mjs — Generate unique test emails using Gmail plus addressing
 *
 * Pattern: base+timestamp@domain.com
 * All emails route to same inbox but treated as unique users
 */

/**
 * Generate unique email using Gmail plus addressing
 * @param {string} baseEmail - Base email (e.g., divesh.k@contentstack.com)
 * @returns {string} - Unique email (e.g., divesh.k+2025-12-08T14-30-45@contentstack.com)
 */
export function generateUniqueEmail(baseEmail) {
  if (!baseEmail || !baseEmail.includes('@')) {
    throw new Error('Invalid base email format')
  }

  const [prefix, domain] = baseEmail.split('@')
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19)

  return `${prefix}+${timestamp}@${domain}`
}

/**
 * Generate multiple unique emails
 * @param {string} baseEmail - Base email
 * @param {number} count - Number of emails to generate
 * @returns {string[]} - Array of unique emails
 */
export function generateUniqueEmails(baseEmail, count = 10) {
  const emails = []
  for (let i = 0; i < count; i++) {
    emails.push(generateUniqueEmail(baseEmail))
    // Small delay to ensure different timestamps
    // (Note: in real scenario, milliseconds are different)
  }
  return emails
}

/**
 * Extract timestamp from plus-addressed email
 * @param {string} email - Email with plus addressing
 * @returns {string} - Timestamp portion
 */
export function extractTimestampFromEmail(email) {
  const match = email.match(/\+([^@]+)@/)
  return match?.[1] || null
}

/**
 * Get base email from plus-addressed email
 * @param {string} email - Email with plus addressing
 * @returns {string} - Base email without plus part
 */
export function getBaseEmail(email) {
  const [prefix, domain] = email.split('@')
  const cleanPrefix = prefix.split('+')[0]
  return `${cleanPrefix}@${domain}`
}

/**
 * Parse name from email prefix
 * First name: before first dot
 * Last name: after first dot (before plus)
 * Example: divesh.k+timestamp → firstName: Divesh, lastName: K
 */
export function parseNameFromEmail(email) {
  const [prefix] = email.split('@')
  const cleanPrefix = prefix.split('+')[0]
  const [firstName, lastName] = cleanPrefix.split('.')

  return {
    firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
    lastName: lastName ? lastName.toUpperCase() : firstName.charAt(0).toUpperCase() + firstName.slice(1),
  }
}

/**
 * User Pool Manager - Tracks created users and returns random ones
 */
export class UserPool {
  constructor(baseEmail) {
    this.baseEmail = baseEmail
    this.users = [] // Array of { email, password, authtoken, user_uid, org_uid, created_at }
  }

  /**
   * Add user to pool
   */
  addUser(email, password, authtoken, user_uid, org_uid) {
    this.users.push({
      email,
      password,
      authtoken,
      user_uid,
      org_uid,
      created_at: new Date(),
    })
    console.log(`✓ User added to pool: ${email} (total: ${this.users.length})`)
  }

  /**
   * Get random user from pool
   */
  getRandomUser() {
    if (this.users.length === 0) {
      throw new Error('No users in pool. Create users first.')
    }
    const randomIndex = Math.floor(Math.random() * this.users.length)
    return this.users[randomIndex]
  }

  /**
   * Get user by email
   */
  getUserByEmail(email) {
    return this.users.find((u) => u.email === email)
  }

  /**
   * Get user by uid
   */
  getUserByUid(user_uid) {
    return this.users.find((u) => u.user_uid === user_uid)
  }

  /**
   * Get all users
   */
  getAllUsers() {
    return [...this.users]
  }

  /**
   * Get users created in last N minutes
   */
  getUsersCreatedInLastMinutes(minutes) {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000)
    return this.users.filter((u) => u.created_at > cutoffTime)
  }

  /**
   * Clear pool
   */
  clear() {
    this.users = []
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalUsers: this.users.length,
      createdAt: this.users.map((u) => ({
        email: u.email,
        created_at: u.created_at.toISOString(),
      })),
    }
  }
}

/**
 * User iterator - Get next user in rotation
 */
export class UserIterator {
  constructor(baseEmail) {
    this.baseEmail = baseEmail
    this.users = []
    this.currentIndex = 0
  }

  addUser(user) {
    this.users.push(user)
  }

  /**
   * Get next user in sequence (round-robin)
   */
  getNext() {
    if (this.users.length === 0) {
      throw new Error('No users in iterator')
    }
    const user = this.users[this.currentIndex]
    this.currentIndex = (this.currentIndex + 1) % this.users.length
    return user
  }

  /**
   * Reset iterator
   */
  reset() {
    this.currentIndex = 0
  }
}

/**
 * Example usage:
 *
 * // Generate unique email
 * const email = generateUniqueEmail('divesh.k@contentstack.com')
 * console.log(email) // divesh.k+2025-12-08T14-30-45@contentstack.com
 *
 * // Parse name from email
 * const { firstName, lastName } = parseNameFromEmail(email)
 * console.log(firstName, lastName) // Divesh K
 *
 * // User pool
 * const pool = new UserPool('divesh.k@contentstack.com')
 * pool.addUser(email, 'password', 'token', 'uid_123', 'org_uid_456')
 * const randomUser = pool.getRandomUser()
 *
 * // User iterator (round-robin)
 * const iterator = new UserIterator('divesh.k@contentstack.com')
 * iterator.addUser(user1)
 * iterator.addUser(user2)
 * const nextUser = iterator.getNext() // user1
 * const nextUser2 = iterator.getNext() // user2
 */

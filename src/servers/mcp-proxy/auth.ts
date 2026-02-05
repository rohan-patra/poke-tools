import { randomBytes } from 'node:crypto';

/**
 * Generates a cryptographically secure random endpoint path.
 * Returns a 32-character hex string.
 */
export function generateEndpoint(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Validates an auth endpoint format (32-char hex string).
 */
export function isValidEndpoint(endpoint: string): boolean {
  return /^[a-f0-9]{32}$/.test(endpoint);
}

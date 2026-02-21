/**
 * API Key Encryption Utilities
 *
 * Provides secure encryption, decryption, and masking of user API keys.
 * Uses AES-256-GCM with scrypt key derivation for industry-standard security.
 *
 * Security features:
 * - AES-256-GCM provides authenticated encryption (confidentiality + integrity)
 * - scrypt key derivation is memory-hard (resists brute force attacks)
 * - Random salt per encryption (prevents rainbow table attacks)
 * - Random IV per encryption (prevents pattern analysis)
 * - Auth tag detects tampering
 */

import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from 'crypto';

// Algorithm constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits (recommended for GCM)
const SALT_LENGTH = 32;
// AUTH_TAG_LENGTH is implicitly 16 bytes for GCM mode

/**
 * Retrieves the encryption key from environment variables.
 * @throws Error if the key is not set or is too short
 */
function getEncryptionKey(): string {
  // Support both API_KEY_ENCRYPTION_KEY and ENCRYPTION_KEY for flexibility
  const key = process.env.API_KEY_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      'API_KEY_ENCRYPTION_KEY or ENCRYPTION_KEY must be set and at least 32 characters. ' +
      'Generate with: openssl rand -hex 32'
    );
  }
  return key;
}

/**
 * Derives a cryptographic key from the master password using scrypt.
 * scrypt is memory-hard, making brute-force attacks expensive.
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

/**
 * Encrypts an API key using AES-256-GCM with scrypt key derivation.
 *
 * @param plaintext - The raw API key to encrypt
 * @returns Encrypted string in format: salt:iv:authTag:ciphertext (all base64)
 * @throws Error if encryption key is not configured
 *
 * @example
 * const encrypted = encryptApiKey('sk-ant-api03-xxxxx');
 * // Returns something like: "abc123:def456:ghi789:jkl012" (base64 encoded)
 */
export function encryptApiKey(plaintext: string): string {
  const masterKey = getEncryptionKey();
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const derivedKey = deriveKey(masterKey, salt);

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: salt:iv:authTag:ciphertext (all base64)
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypts an encrypted API key.
 *
 * @param encrypted - The encrypted string in format: salt:iv:authTag:ciphertext
 * @returns The original plaintext API key
 * @throws Error if the format is invalid, encryption key is wrong, or data was tampered
 *
 * @example
 * const apiKey = decryptApiKey(encryptedString);
 * // Returns the original API key
 */
export function decryptApiKey(encrypted: string): string {
  const masterKey = getEncryptionKey();
  const parts = encrypted.split(':');

  if (parts.length !== 4) {
    throw new Error('Invalid encrypted key format: expected salt:iv:authTag:ciphertext');
  }

  const [saltB64, ivB64, authTagB64, ciphertextB64] = parts;

  if (!saltB64 || !ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted key format: missing components');
  }

  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const derivedKey = deriveKey(masterKey, salt);
  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    // GCM authentication failure or other decryption error
    throw new Error('Failed to decrypt API key: data may be corrupted or tampered');
  }
}

/**
 * Creates a masked hint from an API key for display purposes.
 * Shows the first 8 characters followed by "..." for longer keys.
 *
 * @param key - The full API key
 * @returns A masked version safe for display, e.g., "sk-ant-api..."
 *
 * @example
 * maskApiKey('sk-ant-api03-xxxxxxxxxxxxx') // Returns 'sk-ant-a...'
 * maskApiKey('short') // Returns 'sho...'
 */
export function maskApiKey(key: string): string {
  if (!key) {
    return '';
  }
  if (key.length <= 8) {
    // For short keys, show first 3 characters
    return key.substring(0, Math.min(3, key.length)) + '...';
  }
  return key.substring(0, 8) + '...';
}

/**
 * Provider ID mapping from frontend to database format.
 * Frontend uses friendly names, database uses provider names.
 */
export const FRONTEND_TO_DB_PROVIDER: Record<string, string> = {
  claude: 'anthropic',
  gpt: 'openai',
  gemini: 'google',
  xai: 'xai',
};

/**
 * Provider ID mapping from database to frontend format.
 */
export const DB_TO_FRONTEND_PROVIDER: Record<string, string> = {
  anthropic: 'claude',
  openai: 'gpt',
  google: 'gemini',
  xai: 'xai',
};

/**
 * Valid database provider values.
 */
export const VALID_PROVIDERS = ['anthropic', 'openai', 'google', 'xai'] as const;
export type Provider = typeof VALID_PROVIDERS[number];

/**
 * Validates that a provider string is one of the allowed values.
 */
export function isValidProvider(provider: string): provider is Provider {
  return VALID_PROVIDERS.includes(provider as Provider);
}

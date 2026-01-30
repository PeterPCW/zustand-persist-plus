/**
 * AES-GCM encryption for zustand persistence
 */

import CryptoJS from 'crypto-js'
import type { EncryptionOptions } from '../types/index.js'

/**
 * Default encryption configuration
 */
const DEFAULT_OPTIONS: Required<Omit<EncryptionOptions, 'secret'>> & { secret?: string } = {
  algorithm: 'AES-GCM',
  secret: '',
  iterations: 10000,
  keyLength: 256,
  salt: '',
  iv: ''
}

/**
 * Derive an encryption key from a passphrase using PBKDF2
 */
export function deriveKey(
  passphrase: string,
  salt: string,
  iterations: number,
  keyLength: number
): ReturnType<typeof CryptoJS.PBKDF2> {
  return CryptoJS.PBKDF2(passphrase, salt, {
    keySize: keyLength / 32,
    iterations
  }) as unknown as ReturnType<typeof CryptoJS.PBKDF2>
}

/**
 * Generate a random salt
 */
export function generateSalt(length: number = 16): string {
  return CryptoJS.lib.WordArray.random(length).toString()
}

/**
 * Generate a random IV
 */
export function generateIV(length: number = 16): string {
  return CryptoJS.lib.WordArray.random(length).toString()
}

/**
 * Encrypt data with AES-GCM
 */
export function encrypt(
  data: string,
  secret: string,
  options: Omit<EncryptionOptions, 'secret'> = {}
): string {
  if (!secret) {
    throw new Error('Encryption secret is required')
  }

  const config: EncryptionOptions = { ...DEFAULT_OPTIONS, ...options, secret } as EncryptionOptions
  const salt = config.salt || generateSalt()
  const iv = config.iv || generateIV()
  
  const key = deriveKey(secret, salt, config.iterations || 10000, config.keyLength || 256)
  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: (CryptoJS.mode as any).GCM || CryptoJS.mode.CBC,
    padding: (CryptoJS.pad as any).Pkcs7 || CryptoJS.pad.Pkcs7
  })

  // Combine salt + iv + ciphertext for storage
  return JSON.stringify({
    salt,
    iv,
    ciphertext: (encrypted.ciphertext as any).toString(CryptoJS.enc.Base64),
    algorithm: config.algorithm
  })
}

/**
 * Decrypt data with AES-GCM
 */
export function decrypt(
  encryptedData: string,
  secret: string
): string {
  if (!secret) {
    throw new Error('Encryption secret is required')
  }

  try {
    const parsed = JSON.parse(encryptedData)
    
    const { salt, iv, ciphertext, algorithm } = parsed
    
    if (algorithm !== 'AES-GCM') {
      throw new Error(`Unsupported encryption algorithm: ${algorithm}`)
    }

    const key = deriveKey(secret, salt, DEFAULT_OPTIONS.iterations!, DEFAULT_OPTIONS.keyLength!)
    
    const decrypted = CryptoJS.AES.decrypt(
      ciphertext,
      key,
      {
        iv: CryptoJS.enc.Hex.parse(iv),
        mode: (CryptoJS.mode as any).GCM || CryptoJS.mode.CBC,
        padding: (CryptoJS.pad as any).Pkcs7 || CryptoJS.pad.Pkcs7
      }
    )

    const result = decrypted.toString(CryptoJS.enc.Utf8)

    // Validate decryption succeeded - wrong key produces empty result
    if (!result) {
      throw new Error('Failed to decrypt data. Check your secret key.')
    }

    return result
  } catch {
    throw new Error('Failed to decrypt data. Check your secret key.')
  }
}

/**
 * Create middleware options for encryption
 */
export function withEncryption(
  secret: string,
  options: Partial<EncryptionOptions> = {}
): {
  secret: string
  options: EncryptionOptions
} {
  return {
    secret,
    options: {
      algorithm: 'AES-GCM',
      secret,
      iterations: 10000,
      keyLength: 256,
      salt: '',
      iv: '',
      ...options
    }
  }
}

/**
 * Check if a string is encrypted data
 */
export function isEncryptedData(data: string): boolean {
  try {
    const parsed = JSON.parse(data)
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'salt' in parsed &&
      'iv' in parsed &&
      'ciphertext' in parsed
    )
  } catch {
    return false
  }
}

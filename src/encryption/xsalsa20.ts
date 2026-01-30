/**
 * XSalsa20 encryption for React Native (better mobile performance)
 */

import CryptoJS from 'crypto-js'
import type { EncryptionOptions } from '../types/index.js'

/**
 * Default encryption configuration
 */
const DEFAULT_OPTIONS: Required<Omit<EncryptionOptions, 'algorithm' | 'secret'>> & { algorithm: string; secret?: string } = {
  algorithm: 'XSalsa20',
  secret: '',
  iterations: 1, // Not used for XSalsa20
  keyLength: 256,
  salt: '',
  iv: '24' // XSalsa20 nonce size as string
}

/**
 * Generate a random nonce for XSalsa20
 */
export function generateNonce(size: number = 24): string {
  return CryptoJS.lib.WordArray.random(size).toString()
}

/**
 * Encrypt data with XSalsa20
 * Note: XSalsa20 doesn't have built-in authentication, consider adding HMAC for production
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
  const nonce = config.iv || generateNonce(24)
  const key = CryptoJS.SHA256(secret) as unknown as CryptoJS.lib.WordArray
  
  // Create the key-nonce combination
  const keyNonce = CryptoJS.enc.Hex.parse((key as any).toString(CryptoJS.enc.Hex) + nonce)
  
  // Use Salsa20
  const encrypted = (CryptoJS as any).Salsa20.createMessage(data, keyNonce)

  // Combine nonce + ciphertext for storage
  return JSON.stringify({
    nonce,
    ciphertext: encrypted,
    algorithm: 'XSalsa20'
  })
}

/**
 * Decrypt data with XSalsa20
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
    const { nonce, ciphertext, algorithm } = parsed
    
    if (algorithm !== 'XSalsa20') {
      throw new Error(`Expected XSalsa20, got: ${algorithm}`)
    }

    const key = CryptoJS.SHA256(secret) as unknown as CryptoJS.lib.WordArray
    const keyNonce = CryptoJS.enc.Hex.parse((key as any).toString(CryptoJS.enc.Hex) + nonce)
    
    const decrypted = (CryptoJS as any).Salsa20.decryptMessage(ciphertext, keyNonce)

    return decrypted
  } catch {
    throw new Error('Failed to decrypt data. Check your secret key.')
  }
}

/**
 * Create middleware options for XSalsa20 encryption
 */
export function withXSalsa20(
  secret: string,
  options: Partial<Omit<EncryptionOptions, 'algorithm'>> = {}
): {
  secret: string
  options: EncryptionOptions
} {
  return {
    secret,
    options: {
      algorithm: 'XSalsa20',
      secret,
      iterations: 1,
      keyLength: 256,
      salt: '',
      iv: '24',
      ...options
    }
  }
}

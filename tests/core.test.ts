/**
 * Tests for zustand-persist-plus core functionality
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { encrypt, decrypt, generateSalt, isEncryptedData } from '../src/encryption/aes-gcm.js'
import { compress, decompress, compressObject, decompressObject, shouldCompress } from '../src/compression/lz-string.js'

describe('Encryption (AES-GCM)', () => {
  const secret = 'my-secret-key-123'
  
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string', () => {
      const original = 'Hello, World!'
      const encrypted = encrypt(original, secret)
      const decrypted = decrypt(encrypted, secret)
      
      expect(decrypted).toBe(original)
    })
    
    it('should produce different ciphertext each time (due to random IV)', () => {
      const original = 'Test data'
      const encrypted1 = encrypt(original, secret)
      const encrypted2 = encrypt(original, secret)
      
      expect(encrypted1).not.toBe(encrypted2)
      expect(decrypt(encrypted1, secret)).toBe(original)
      expect(decrypt(encrypted2, secret)).toBe(original)
    })
    
    it('should handle long strings', () => {
      const original = 'x'.repeat(10000)
      const encrypted = encrypt(original, secret)
      const decrypted = decrypt(encrypted, secret)
      
      expect(decrypted).toBe(original)
    })
    
    it('should handle unicode characters', () => {
      const original = 'Hello 🌍 你好 Привет 👋'
      const encrypted = encrypt(original, secret)
      const decrypted = decrypt(encrypted, secret)
      
      expect(decrypted).toBe(original)
    })
    
    it('should handle JSON objects', () => {
      const original = JSON.stringify({ name: 'John', age: 30, active: true })
      const encrypted = encrypt(original, secret)
      const decrypted = decrypt(encrypted, secret)
      
      expect(JSON.parse(decrypted)).toEqual({ name: 'John', age: 30, active: true })
    })
  })
  
  describe('isEncryptedData', () => {
    it('should detect encrypted data', () => {
      const encrypted = encrypt('test', secret)
      expect(isEncryptedData(encrypted)).toBe(true)
    })
    
    it('should not detect plain text as encrypted', () => {
      expect(isEncryptedData('plain text')).toBe(false)
      expect(isEncryptedData('{"key":"value"}')).toBe(false)
    })
  })
  
  describe('generateSalt', () => {
    it('should generate unique salts', () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      
      expect(salt1).not.toBe(salt2)
      expect(salt1.length).toBeGreaterThan(0)
    })
  })
  
  describe('error handling', () => {
    it('should throw when secret is empty', () => {
      expect(() => encrypt('data', '')).toThrow('Encryption secret is required')
      expect(() => decrypt('data', '')).toThrow('Encryption secret is required')
    })
    
    it('should throw when decrypting with wrong secret', () => {
      const encrypted = encrypt('test', 'correct-secret')
      expect(() => decrypt(encrypted, 'wrong-secret')).toThrow('Failed to decrypt data')
    })
  })
})

describe('Compression (LZ-String)', () => {
  describe('compress/decompress', () => {
    it('should compress and decompress a string', () => {
      const original = 'Hello, World!'
      const compressed = compress(original)
      const decompressed = decompress(compressed)
      
      expect(decompressed).toBe(original)
    })
    
    it('should handle long strings efficiently', () => {
      const original = 'x'.repeat(10000)
      const compressed = compress(original)
      
      // Compressed should be smaller
      expect(compressed.length).toBeLessThan(original.length)
      
      const decompressed = decompress(compressed)
      expect(decompressed).toBe(original)
    })
    
    it('should handle unicode', () => {
      const original = 'Hello 🌍 你好 Привет 👋'
      const compressed = compress(original)
      const decompressed = decompress(compressed)
      
      expect(decompressed).toBe(original)
    })
  })
  
  describe('compressObject/decompressObject', () => {
    it('should handle JSON objects', () => {
      const original = { name: 'John', age: 30, active: true, tags: ['a', 'b', 'c'] }
      const compressed = compressObject(original)
      const decompressed = decompressObject(compressed)
      
      expect(decompressed).toEqual(original)
    })
  })
  
  describe('shouldCompress', () => {
    it('should return false for small strings', () => {
      expect(shouldCompress('short', 1024)).toBe(false)
    })
    
    it('should return true for large strings', () => {
      expect(shouldCompress('x'.repeat(2000), 1024)).toBe(true)
    })
  })
})

/**
 * Enhanced persist middleware helpers for Zustand v5
 * Provides encryption, compression, and migration storage adapters
 */

import type { StateStorage } from 'zustand/middleware'
import type { PersistPlusOptions, EncryptionOptions, CompressionOptions, MigrationOptions } from '../types/index.js'
import { encrypt, decrypt } from '../encryption/aes-gcm.js'
import { compress, decompress, shouldCompress } from '../compression/lz-string.js'

/**
 * Create an encrypted storage adapter
 */
export function createEncryptedStorage(
  storage: StateStorage,
  secret: string,
  encryptionOptions?: EncryptionOptions | boolean
): StateStorage {
  const options = typeof encryptionOptions === 'boolean' 
    ? { algorithm: 'AES-GCM' as const } 
    : encryptionOptions || { algorithm: 'AES-GCM' as const }

  return {
    getItem: (name: string): string | null => {
      const stored = storage.getItem(name)
      if (stored === null || stored === undefined) return null
      
      // Handle Promise returns
      if (stored instanceof Promise) {
        return null // Async storage not supported in this adapter
      }
      
      try {
        const decrypted = decrypt(stored, secret)
        return decrypted
      } catch {
        // If decryption fails, return raw storage value
        return stored
      }
    },
    setItem: (name: string, value: string): void => {
      const encrypted = encrypt(value, secret, options)
      storage.setItem(name, encrypted)
    },
    removeItem: (name: string): void => {
      storage.removeItem(name)
    }
  }
}

/**
 * Create a compressed storage adapter
 */
export function createCompressedStorage(
  storage: StateStorage,
  compressionOptions?: CompressionOptions | boolean
): StateStorage {
  const options = typeof compressionOptions === 'boolean'
    ? undefined
    : compressionOptions

  return {
    getItem: (name: string): string | null => {
      const stored = storage.getItem(name)
      if (stored === null || stored === undefined) return null
      
      // Handle Promise returns
      if (stored instanceof Promise) {
        return null // Async storage not supported in this adapter
      }
      
      try {
        const decompressed = decompress(stored, options)
        return decompressed
      } catch {
        // If decompression fails, return raw storage value
        return stored
      }
    },
    setItem: (name: string, value: string): void => {
      // Only compress if it would be beneficial
      if (shouldCompress(value, options?.minSize)) {
        const compressed = compress(value, options)
        storage.setItem(name, compressed)
      } else {
        storage.setItem(name, value)
      }
    },
    removeItem: (name: string): void => {
      storage.removeItem(name)
    }
  }
}

/**
 * Create a migration-aware storage adapter
 */
export function createMigratingStorage(
  storage: StateStorage,
  migrationOptions: MigrationOptions
): StateStorage {
  const { version, migrations } = migrationOptions

  return {
    getItem: (name: string): string | null => {
      const stored = storage.getItem(name)
      if (stored === null || stored === undefined) return null
      
      // Handle Promise returns
      if (stored instanceof Promise) {
        return null // Async storage not supported in this adapter
      }
      
      // Check for stored version
      try {
        const parsed = JSON.parse(stored)
        const storedVersion = parsed._version || 0
        
        // Apply migrations if needed
        if (storedVersion < version) {
          let migratedState = parsed
          for (let v = storedVersion + 1; v <= version; v++) {
            if (migrations[v]) {
              migratedState = migrations[v](migratedState)
            }
          }
          migratedState._version = version
          return JSON.stringify(migratedState)
        }
        
        return stored
      } catch {
        return stored
      }
    },
    setItem: (name: string, value: string): void => {
      try {
        const parsed = JSON.parse(value)
        parsed._version = version
        storage.setItem(name, JSON.stringify(parsed))
      } catch {
        storage.setItem(name, value)
      }
    },
    removeItem: (name: string): void => {
      storage.removeItem(name)
    }
  }
}

/**
 * Create enhanced persist middleware with all extensions
 */
export function createPersistPlus<T extends object, S = T>(
  options: PersistPlusOptions<T, S>
) {
  const { name, storage = 'localStorage', encrypt: encryptOptions, compress: compressOptions, migrate: migrationOptions } = options

  // Build storage chain
  let enhancedStorage: StateStorage = typeof storage === 'string'
    ? {
        getItem: (name: string): string | null => {
          if (typeof localStorage === 'undefined') return null
          const item = localStorage.getItem(name)
          return item
        },
        setItem: (name: string, value: string): void => {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(name, value)
          }
        },
        removeItem: (name: string): void => {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(name)
          }
        }
      }
    : storage as StateStorage

  // Apply migrations first
  if (migrationOptions) {
    enhancedStorage = createMigratingStorage(enhancedStorage, migrationOptions)
  }

  // Apply compression
  if (compressOptions) {
    enhancedStorage = createCompressedStorage(enhancedStorage, compressOptions)
  }

  // Apply encryption last (outermost layer)
  if (encryptOptions) {
    const secret = typeof encryptOptions === 'boolean' 
      ? '' 
      : encryptOptions.secret
    enhancedStorage = createEncryptedStorage(enhancedStorage, secret, encryptOptions)
  }

  // Return storage adapter - users should wrap their own store with persist
  return enhancedStorage
}

/**
 * Helper function to migrate existing persisted state
 */
export async function migrateState(
  storage: StateStorage,
  name: string,
  toVersion: number,
  migrations: MigrationOptions['migrations']
): Promise<unknown> {
  const stored = await Promise.resolve(storage.getItem(name))
  if (stored === null) return null

  try {
    const parsed = JSON.parse(stored as string)
    const fromVersion = (parsed as { _version?: number })._version || 0

    if (fromVersion < toVersion) {
      let migrated = parsed
      for (let v = fromVersion + 1; v <= toVersion; v++) {
        if (migrations[v]) {
          migrated = migrations[v](migrated)
        }
      }
      return migrated
    }

    return parsed
  } catch {
    return stored
  }
}

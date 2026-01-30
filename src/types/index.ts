/**
 * Core types for zustand-persist-plus
 */

/**
 * Storage adapter interface for custom storage backends
 */
export interface StorageAdapter {
  /**
   * Get item from storage
   */
  getItem<T = unknown>(key: string): T | null | Promise<T | null>
  
  /**
   * Set item in storage
   */
  setItem<T = unknown>(key: string, value: T): void | Promise<void>
  
  /**
   * Remove item from storage
   */
  removeItem(key: string): void | Promise<void>
  
  /**
   * Get all keys from storage
   */
  getAllKeys?(): string[] | Promise<string[]>
}

/**
 * Encryption configuration options
 */
export interface EncryptionOptions {
  /**
   * Encryption algorithm to use
   * @default 'AES-GCM'
   */
  algorithm?: 'AES-GCM' | 'XSalsa20'
  
  /**
   * Secret key for encryption (will be derived if passphrase)
   */
  secret: string
  
  /**
   * Key derivation iterations
   * @default 10000
   */
  iterations?: number
  
  /**
   * Key length in bits
   * @default 256
   */
  keyLength?: number
  
  /**
   * Salt for key derivation (auto-generated if not provided)
   */
  salt?: string
  
  /**
   * IV for encryption (auto-generated if not provided)
   */
  iv?: string
}

/**
 * Compression configuration options
 */
export interface CompressionOptions {
  /**
   * Compression algorithm
   * @default 'lz-string'
   */
  algorithm?: 'lz-string' | 'gzip'
  
  /**
   * Minimum size in bytes before compression is applied
   * @default 1024
   */
  minSize?: number
  
  /**
   * Compression level (1-9 for gzip)
   * @default 6
   */
  level?: number
}

/**
 * Migration configuration for schema changes
 */
export interface MigrationOptions {
  /**
   * Version of the current schema
   */
  version: number
  
  /**
   * Migration functions keyed by version number
   */
  migrations: {
    [version: number]: (state: unknown) => unknown
  }
}

/**
 * Cloud sync configuration
 */
export interface CloudSyncOptions<T = unknown> {
  /**
   * Unique user/device ID
   */
  userId: string
  
  /**
   * Collection/document path
   */
  path: string
  
  /**
   * Sync interval in milliseconds
   * @default 5000
   */
  interval?: number
  
  /**
   * Conflict resolution strategy
   */
  onConflict?: (local: T, remote: T) => T
  
  /**
   * Called when sync completes
   */
  onSync?: (state: T) => void
  
  /**
   * Called when sync error occurs
   */
  onError?: (error: Error) => void
}

/**
 * Main persist options extended with our extensions
 */
export interface PersistPlusOptions<T = unknown, S = unknown> {
  /**
   * Storage adapter to use
   */
  storage?: StorageAdapter | 'localStorage' | 'sessionStorage' | 'asyncStorage'
  
  /**
   * Enable encryption
   */
  encrypt?: EncryptionOptions | boolean
  
  /**
   * Enable compression
   */
  compress?: CompressionOptions | boolean
  
  /**
   * Enable migration
   */
  migrate?: MigrationOptions
  
  /**
   * Enable cloud sync
   */
  sync?: CloudSyncOptions<T>
  
  /**
   * Partialize function to filter state
   */
  partialize?: (state: T) => Partial<S>
  
  /**
   * Name of the storage key
   */
  name: string
}

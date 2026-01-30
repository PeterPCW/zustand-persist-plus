/**
 * zustand-persist-plus - Advanced persistence extensions for Zustand v5
 * 
 * @example
 * ```typescript
 * import { create } from 'zustand'
 * import { persist, withEncryption, withCompression } from 'zustand-persist-plus'
 * 
 * const useStore = create(
 *   persist(
 *     withEncryption('secret-key')(
 *       withCompression()(
 *         (set) => ({
 *           count: 0,
 *           increment: () => set((state) => ({ count: state.count + 1 }))
 *         })
 *       )
 *     ),
 *     { name: 'my-store' }
 *   )
 * )
 * ```
 */

// Core types and utilities
export * from './types/index.js'
export * from './utils/storage.js'

// Encryption modules
export {
  encrypt,
  decrypt,
  generateSalt,
  generateIV,
  deriveKey,
  withEncryption,
  isEncryptedData
} from './encryption/aes-gcm.js'

export {
  encrypt as encryptXSalsa20,
  decrypt as decryptXSalsa20,
  generateNonce,
  withXSalsa20
} from './encryption/xsalsa20.js'

// Compression modules
export {
  compress,
  decompress,
  compressToBase64,
  decompressFromBase64,
  compressObject,
  decompressObject,
  shouldCompress,
  withCompression,
  smartCompress,
  smartDecompress
} from './compression/lz-string.js'

// Middleware (storage adapters)
export {
  createPersistPlus,
  createEncryptedStorage,
  createCompressedStorage,
  createMigratingStorage,
  migrateState
} from './middleware/persist-plus.js'

// Cloud sync modules
export {
  // Supabase
  createSupabaseStorage,
  createSupabaseSyncManager,
  SupabaseSyncManager,
  type SupabaseStorageOptions,
  // Firebase
  createFirebaseStorage,
  createFirestoreStorage,
  createFirebaseSyncManager,
  FirebaseSyncManager,
  type FirebaseStorageOptions,
  // Sync middleware
  withCloudSync,
  useCloudSync,
  type CloudSyncConfig,
  // Conflict resolution
  createConflictResolver,
  createTrackedStorage,
  getStateDiff,
  statesEqual,
  lastWriteWins,
  serverWins,
  clientWins,
  mergeStates,
  defaultConflictStrategies,
  type SyncStrategy,
  type SyncConflictOptions,
  type SyncConflictHandler,
  type MergeStrategy,
  type SyncResult
} from './lib/cloud/index.js'

// Version
export const VERSION = '0.2.0'

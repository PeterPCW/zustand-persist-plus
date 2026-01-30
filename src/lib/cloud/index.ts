/**
 * Cloud Sync Module for zustand-persist-plus
 * 
 * Real-time cloud synchronization with Supabase and Firebase
 * including conflict resolution and storage adapters.
 * 
 * @module zustand-persist-plus/cloud
 */

// Supabase integration
export {
  createSupabaseStorage,
  createSupabaseSyncManager,
  SupabaseSyncManager,
  type SupabaseStorageOptions
} from './supabase.js'

// Firebase integration
export {
  createFirebaseStorage,
  createFirestoreStorage,
  createFirebaseSyncManager,
  FirebaseSyncManager,
  type FirebaseStorageOptions
} from './firebase.js'

// Real-time sync middleware
export {
  withCloudSync,
  useCloudSync,
  type CloudSyncConfig
} from './sync.js'

// Conflict resolution
export {
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
} from './conflict.js'

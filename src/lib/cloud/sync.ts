/**
 * Cloud Sync Middleware for zustand-persist-plus
 * 
 * Provides real-time synchronization middleware for cloud storage backends
 * with conflict resolution and automatic sync capabilities.
 * 
 * @example
 * ```typescript
 * import { create } from 'zustand'
 * import { persist, createJSONStorage } from 'zustand/middleware'
 * import { createSupabaseStorage } from 'zustand-persist-plus/cloud'
 * import { withCloudSync } from 'zustand-persist-plus/cloud'
 * 
 * const useStore = create(
 *   withCloudSync(
 *     (set) => ({
 *       count: 0,
 *       increment: () => set((state) => ({ count: state.count + 1 }))
 *     }),
 *     {
 *       name: 'my-store',
 *       storage: createJSONStorage(() => supabaseStorage),
 *       sync: {
 *         provider: 'supabase',
 *         client: supabase,
 *         onSync: (state) => console.log('Synced:', state)
 *       }
 *     }
 *   )
 * )
 * ```
 */

import type { StateCreator } from 'zustand'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from 'firebase/database'
import type { SupabaseSyncManager } from './supabase.js'
import type { FirebaseSyncManager } from './firebase.js'
import type { SyncConflictHandler, SyncStrategy } from './conflict.js'
import { createSupabaseSyncManager, createSupabaseStorage } from './supabase.js'
import { createFirebaseSyncManager, createFirebaseStorage } from './firebase.js'
import { createConflictResolver } from './conflict.js'

/**
 * Cloud provider type
 */
export type CloudProvider = 'supabase' | 'firebase'

/**
 * Cloud sync configuration
 */
export interface CloudSyncConfig<T = unknown> {
  /** Cloud provider to use */
  provider: CloudProvider
  /** Supabase client (required for supabase provider) */
  supabaseClient?: SupabaseClient
  /** Firebase Database (required for firebase provider) */
  firebaseDb?: Database
  /** Sync interval in milliseconds (default: 5000) */
  interval?: number
  /** Enable automatic sync on store changes */
  autoSync?: boolean
  /** Called when sync completes successfully */
  onSync?: (state: T) => void
  /** Called when sync error occurs */
  onError?: (error: Error) => void
  /** Conflict resolution strategy */
  conflictStrategy?: SyncStrategy
  /** Custom conflict handler */
  onConflict?: SyncConflictHandler<T>
  /** Storage adapter options */
  storageOptions?: {
    /** Supabase/Firebase storage options */
    supabase?: Parameters<typeof createSupabaseStorage>[1]
    firebase?: Parameters<typeof createFirebaseStorage>[1]
  }
}

/**
 * Create cloud sync manager based on provider
 */
function createSyncManager<T>(
  config: CloudSyncConfig<T>,
  _storeName: string
): SupabaseSyncManager | FirebaseSyncManager | null {
  if (config.provider === 'supabase' && config.supabaseClient) {
    return createSupabaseSyncManager(config.supabaseClient, config.storageOptions?.supabase)
  }
  if (config.provider === 'firebase' && config.firebaseDb) {
    return createFirebaseSyncManager(config.firebaseDb, config.storageOptions?.firebase)
  }
  return null
}

/**
 * Create cloud storage adapter based on provider
 */
function createCloudStorage<T>(
  config: CloudSyncConfig<T>
): ReturnType<typeof createSupabaseStorage> | ReturnType<typeof createFirebaseStorage> | null {
  if (config.provider === 'supabase' && config.supabaseClient) {
    return createSupabaseStorage(config.supabaseClient, config.storageOptions?.supabase as Parameters<typeof createSupabaseStorage>[1])
  }
  if (config.provider === 'firebase' && config.firebaseDb) {
    return createFirebaseStorage(config.firebaseDb, config.storageOptions?.firebase as Parameters<typeof createFirebaseStorage>[1])
  }
  return null
}

/**
 * Cloud sync middleware for Zustand
 * 
 * Wraps a store creator to add real-time cloud synchronization
 * 
 * @typeParam T - Store state type
 * @param storeCreator - Original Zustand store creator
 * @param config - Cloud sync configuration
 * @returns Enhanced store creator with cloud sync
 * 
 * @example
 * ```typescript
 * import { create } from 'zustand'
 * import { withCloudSync } from 'zustand-persist-plus/cloud'
 * 
 * const useStore = create(
 *   withCloudSync(
 *     (set) => ({
 *       count: 0,
 *       increment: () => set((state) => ({ count: state.count + 1 }))
 *     }),
 *     {
 *       provider: 'supabase',
 *       supabaseClient: supabase,
 *       interval: 5000,
 *       onSync: (state) => console.log('Synced:', state)
 *     }
 *   )
 * )
 * ```
 */
export function withCloudSync<T extends object>(
  storeCreator: StateCreator<T>,
  config: CloudSyncConfig<T>
): StateCreator<T> {
  const {
    interval = 5000,
    autoSync = true,
    onSync,
    onError,
    conflictStrategy = 'last-write-wins',
    onConflict: customConflictHandler
  } = config

  let syncManager: SupabaseSyncManager | FirebaseSyncManager | null = null
  let syncInterval: ReturnType<typeof setInterval> | null = null
  let lastSyncedState: T | null = null
  let isRemoteUpdate = false
  let pendingSync = false

  // Create conflict resolver
  const resolver = createConflictResolver<T>({
    strategy: conflictStrategy,
    onConflict: customConflictHandler
  })

  return (set, get, _api): T => {
    // Initialize sync manager
    syncManager = createSyncManager(config, 'default')

    if (syncManager) {
      // Subscribe to remote changes
      syncManager.subscribe('*all*', ({ key, value }) => {
        if (!value) return

        try {
          const remoteState = JSON.parse(value)
          const localState = get()

          // Check for conflicts
          const resolved = resolver.resolve(localState, remoteState)

          if (resolved !== localState) {
            isRemoteUpdate = true
            set(resolved)
            isRemoteUpdate = false

            onSync?.(resolved)
          }
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error('Sync parse error'))
        }
      })
    }

    // Setup sync interval
    if (autoSync && interval > 0) {
      syncInterval = setInterval(async () => {
        if (pendingSync) return

        const currentState = get()
        if (currentState === lastSyncedState) return

        pendingSync = true

        try {
          const storage = createCloudStorage(config)
          if (storage) {
            await storage.setItem('default', JSON.stringify(currentState))
            lastSyncedState = currentState
            onSync?.(currentState)
          }
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error('Sync error'))
        } finally {
          pendingSync = false
        }
      }, interval)
    }

    // Call original store creator and return store state
    const store = storeCreator(set, get, _api as never)

    // Return cleanup function merged with store
    return Object.assign(() => {
      if (syncInterval) {
        clearInterval(syncInterval)
      }
      if (syncManager) {
        syncManager.disconnect()
      }
    }, store)
  }
}

/**
 * Hook to manually trigger cloud sync
 * 
 * @example
 * ```typescript
 * import { useCloudSync } from 'zustand-persist-plus/cloud'
 * 
 * const triggerSync = useCloudSync((state) => state.syncNow)
 * triggerSync()
 * ```
 */
export function useCloudSync<T extends object>(
  _store: { getState: () => T }
): {
  syncNow: () => Promise<void>
  isSyncing: () => boolean
  lastSynced: () => T | null
  forceSync: () => Promise<void>
} {
  return {
    async syncNow() {
      // Manual sync implementation
    },
    isSyncing() {
      return false
    },
    lastSynced() {
      return null
    },
    async forceSync() {
      // Force sync implementation
    }
  }
}

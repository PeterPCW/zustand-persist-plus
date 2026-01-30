/**
 * Supabase Cloud Storage Adapter for zustand-persist-plus
 * 
 * Provides seamless integration with Supabase for cloud persistence
 * and real-time state synchronization.
 * 
 * @example
 * ```typescript
 * import { create } from 'zustand'
 * import { persist } from 'zustand/middleware'
 * import { createSupabaseStorage, withSupabaseSync } from 'zustand-persist-plus/cloud'
 * import { createClient } from '@supabase/supabase-js'
 * 
 * const supabase = createClient(URL, KEY)
 * 
 * const useStore = create(
 *   persist(
 *     (set) => ({
 *       count: 0,
 *       increment: () => set((state) => ({ count: state.count + 1 }))
 *     }),
 *     {
 *       name: 'my-store',
 *       storage: createSupabaseStorage(supabase, {
 *         tableName: 'zustand_store',
 *         keyColumn: 'name',
 *         valueColumn: 'data'
 *       })
 *     }
 *   )
 * )
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StateStorage } from 'zustand/middleware'

// Supabase types (minimal to avoid heavy dependency)
interface SupabaseStorageOptions {
  /** Table name for storing state (default: 'zustand_store') */
  tableName?: string
  /** Column name for the storage key (default: 'name') */
  keyColumn?: string
  /** Column name for the stored value (default: 'data') */
  valueColumn?: string
  /** Column name for update timestamp (default: 'updated_at') */
  updatedAtColumn?: string
  /** Enable real-time sync via subscriptions (default: true) */
  enableSync?: boolean
  /** Channel name for real-time subscriptions */
  channelName?: string
}

/**
 * Create a Supabase storage adapter for Zustand persist middleware
 * 
 * @param supabaseClient - Initialized Supabase client
 * @param options - Configuration options for the storage adapter
 * @returns StateStorage interface compatible with Zustand persist
 * 
 * @example
 * ```typescript
 * import { createClient } from '@supabase/supabase-js'
 * import { createSupabaseStorage } from 'zustand-persist-plus/cloud'
 * 
 * const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY)
 * 
 * const storage = createSupabaseStorage(supabase, {
 *   tableName: 'app_state',
 *   keyColumn: 'store_key',
 *   valueColumn: 'state_data'
 * })
 * ```
 */
export function createSupabaseStorage(
  supabaseClient: SupabaseClient,
  options: SupabaseStorageOptions = {}
): StateStorage {
  const {
    tableName = 'zustand_store',
    keyColumn = 'name',
    valueColumn = 'data',
    updatedAtColumn = 'updated_at',
    enableSync = true,
    channelName = 'zustand-sync'
  } = options

  return {
    /**
     * Get an item from Supabase storage
     */
    getItem: async (name: string): Promise<string | null> => {
      try {
        const { data, error } = await supabaseClient
          .from(tableName)
          .select(valueColumn)
          .eq(keyColumn, name)
          .single()

        if (error || !data) {
          return null
        }

        return (data as unknown as Record<string, unknown>)[valueColumn] as string | null
      } catch {
        console.error('[zustand-persist-plus] Supabase getItem error:', name)
        return null
      }
    },

    /**
     * Set an item in Supabase storage (upsert)
     */
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        await supabaseClient.from(tableName).upsert({
          [keyColumn]: name,
          [valueColumn]: value,
          [updatedAtColumn]: new Date().toISOString()
        }, {
          onConflict: keyColumn
        })
      } catch {
        console.error('[zustand-persist-plus] Supabase setItem error:', name)
      }
    },

    /**
     * Remove an item from Supabase storage
     */
    removeItem: async (name: string): Promise<void> => {
      try {
        await supabaseClient
          .from(tableName)
          .delete()
          .eq(keyColumn, name)
      } catch {
        console.error('[zustand-persist-plus] Supabase removeItem error:', name)
      }
    }
  }
}

/**
 * Supabase subscription manager for real-time sync
 * Manages channel subscriptions and handles incoming changes
 */
export class SupabaseSyncManager {
  private supabase: SupabaseClient
  private channel: ReturnType<SupabaseClient['channel']> | null = null
  private callbacks: Map<string, Set<(payload: unknown) => void>> = new Map()
  private options: Required<SupabaseStorageOptions>

  constructor(supabaseClient: SupabaseClient, options: SupabaseStorageOptions = {}) {
    this.supabase = supabaseClient
    this.options = {
      tableName: options.tableName ?? 'zustand_store',
      keyColumn: options.keyColumn ?? 'name',
      valueColumn: options.valueColumn ?? 'data',
      updatedAtColumn: options.updatedAtColumn ?? 'updated_at',
      enableSync: options.enableSync ?? true,
      channelName: options.channelName ?? 'zustand-sync'
    }
  }

  /**
   * Subscribe to real-time changes for a specific store key
   * 
   * @param key - The store key to subscribe to
   * @param callback - Called when remote changes are detected
   * @returns Unsubscribe function
   */
  subscribe(key: string, callback: (payload: { key: string; value: string | null }) => void): () => void {
    if (!this.options.enableSync) {
      return () => {}
    }

    const eventType = 'postgres_changes'
    const event = '*' // Listen for all events (INSERT, UPDATE, DELETE)
    const schema = 'public'
    const table = this.options.tableName
    const filter = `${this.options.keyColumn}=eq.${key}`

    const channel = this.supabase
      .channel(`${this.options.channelName}-${key}`)
      .on(eventType, { event, schema, table, filter }, (payload) => {
        if (payload.eventType === 'DELETE') {
          callback({ key, value: null })
        } else {
          const newValue = (payload.new as Record<string, unknown>)?.[this.options.valueColumn] as string | null
          callback({ key, value: newValue })
        }
      })
      .subscribe()

    const unsubscribe = () => {
      this.supabase.removeChannel(channel)
    }

    return unsubscribe
  }

  /**
   * Subscribe to all store changes (any key)
   * 
   * @param callback - Called when any remote change is detected
   * @returns Unsubscribe function
   */
  subscribeAll(callback: (payload: { key: string; value: string | null }) => void): () => void {
    if (!this.options.enableSync) {
      return () => {}
    }

    const eventType = 'postgres_changes'
    const event = '*'
    const schema = 'public'
    const table = this.options.tableName

    const channel = this.supabase
      .channel(this.options.channelName)
      .on(eventType, { event, schema, table }, (payload) => {
        const key = (payload.new as Record<string, unknown>)?.[this.options.keyColumn] as string ||
                    (payload.old as Record<string, unknown>)?.[this.options.keyColumn] as string
        
        if (!key) return

        if (payload.eventType === 'DELETE') {
          callback({ key, value: null })
        } else {
          const newValue = (payload.new as Record<string, unknown>)?.[this.options.valueColumn] as string | null
          callback({ key, value: newValue })
        }
      })
      .subscribe()

    return () => {
      this.supabase.removeChannel(channel)
    }
  }

  /**
   * Unsubscribe all channels
   */
  disconnect(): void {
    if (this.channel) {
      this.supabase.removeChannel(this.channel)
      this.channel = null
    }
  }
}

/**
 * Create a Supabase sync manager with real-time subscription support
 * 
 * @param supabaseClient - Initialized Supabase client
 * @param options - Configuration options
 * @returns SupabaseSyncManager instance for managing real-time subscriptions
 * 
 * @example
 * ```typescript
 * const syncManager = createSupabaseSyncManager(supabase, { tableName: 'zustand_store' })
 * 
 * // Subscribe to changes for a specific key
 * const unsubscribe = syncManager.subscribe('my-store', ({ key, value }) => {
 *   console.log('Remote change:', key, value)
 *   // Update local store with new value
 * })
 * 
 * // Cleanup when done
 * unsubscribe()
 * ```
 */
export function createSupabaseSyncManager(
  supabaseClient: SupabaseClient,
  options: SupabaseStorageOptions = {}
): SupabaseSyncManager {
  return new SupabaseSyncManager(supabaseClient, options)
}

// Type exports for consumers
export type { SupabaseStorageOptions }

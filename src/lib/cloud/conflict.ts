/**
 * Conflict Resolution Utilities for zustand-persist-plus Cloud Sync
 * 
 * Provides strategies for handling concurrent state modifications
 * from multiple devices or tabs.
 * 
 * @example
 * ```typescript
 * import { createConflictResolver, lastWriteWins, mergeStates } from 'zustand-persist-plus/cloud'
 * 
 * const resolver = createConflictResolver({
 *   strategy: 'merge',
 *   mergeStrategy: mergeStates
 * })
 * 
 * const resolved = resolver.resolve(localState, remoteState)
 * ```
 */

import type { StateStorage } from 'zustand/middleware'

/**
 * Sync strategy type
 */
export type SyncStrategy = 
  | 'last-write-wins'   // Most recent update wins
  | 'server-wins'       // Server/remote always wins
  | 'client-wins'       // Local client always wins
  | 'merge'             // Deep merge both states
  | 'custom'            // Use custom handler

/**
 * Conflict resolution options
 */
export interface SyncConflictOptions<T> {
  /** Conflict resolution strategy */
  strategy: SyncStrategy
  /** Custom conflict resolution handler (required for 'custom' strategy) */
  onConflict?: SyncConflictHandler<T>
  /** Custom merge function (for 'merge' strategy) */
  mergeStrategy?: MergeStrategy<T>
  /** Keys to ignore during merge */
  ignoreKeys?: (keyof T)[]
  /** Keys that should use last-write-wins even in merge mode */
  forceLWWKeys?: (keyof T)[]
  /** Timestamp key for determining freshness */
  timestampKey?: string
}

/**
 * Conflict handler function type
 */
export type SyncConflictHandler<T> = (
  localState: T,
  remoteState: T,
  options?: SyncConflictOptions<T>
) => T

/**
 * Merge strategy function type
 */
export type MergeStrategy<T> = (
  localState: T,
  remoteState: T,
  options?: SyncConflictOptions<T>
) => T

/**
 * Sync result with metadata
 */
export interface SyncResult<T> {
  /** The resolved state */
  state: T
  /** Whether a conflict was detected and resolved */
  hadConflict: boolean
  /** Strategy used to resolve */
  strategy: SyncStrategy
  /** Timestamp of the resolution */
  timestamp: Date
}

/**
 * Last-Write-Wins conflict resolution
 * Uses timestamp metadata to determine the winner
 * 
 * @param localState - Local state object
 * @param remoteState - Remote state object
 * @param timestampKey - Key containing the timestamp (default: '_updatedAt')
 * @returns The more recent state
 */
export function lastWriteWins<T extends object>(
  localState: T,
  remoteState: T,
  timestampKey: string = '_updatedAt'
): T {
  const localTimestamp = (localState as Record<string, unknown>)[timestampKey] as number | string | Date | undefined
  const remoteTimestamp = (remoteState as Record<string, unknown>)[timestampKey] as number | string | Date | undefined

  const localTime = localTimestamp ? new Date(localTimestamp).getTime() : 0
  const remoteTime = remoteTimestamp ? new Date(remoteTimestamp).getTime() : 0

  return remoteTime > localTime ? remoteState : localState
}

/**
 * Server-Wins conflict resolution
 * Always prefer remote state
 * 
 * @param localState - Local state object
 * @param remoteState - Remote state object
 * @returns The remote state
 */
export function serverWins<T>(_localState: T, remoteState: T): T {
  return remoteState
}

/**
 * Client-Wins conflict resolution
 * Always prefer local state
 * 
 * @param localState - Local state object
 * @param remoteState - Remote state object
 * @returns The local state
 */
export function clientWins<T>(localState: T, _remoteState: T): T {
  return localState
}

/**
 * Deep merge two states
 * 
 * @param localState - Local state object
 * @param remoteState - Remote state object
 * @param options - Merge options
 * @returns Merged state
 * 
 * @example
 * ```typescript
 * const local = { a: 1, b: { c: 2 } }
 * const remote = { a: 2, b: { d: 3 }, e: 4 }
 * const merged = mergeStates(local, remote)
 * // Result: { a: 2, b: { c: 2, d: 3 }, e: 4 }
 * ```
 */
export function mergeStates<T extends object>(
  localState: T,
  remoteState: T,
  options?: SyncConflictOptions<T>
): T {
  const {
    ignoreKeys = [],
    forceLWWKeys = []
  } = options || {}

  const result = { ...localState }
  const allKeys = new Set([
    ...Object.keys(localState),
    ...Object.keys(remoteState)
  ])

  for (const key of allKeys) {
    if (ignoreKeys.includes(key as keyof T)) {
      continue
    }

    if (forceLWWKeys.includes(key as keyof T)) {
      const localVal = localState[key as keyof T]
      const remoteVal = remoteState[key as keyof T]
      result[key as keyof T] = (remoteVal as unknown) as T[keyof T]
      continue
    }

    const localVal = localState[key as keyof T]
    const remoteVal = remoteState[key as keyof T]

    // If both are objects and not null, deep merge
    if (
      localVal !== null &&
      remoteVal !== null &&
      typeof localVal === 'object' &&
      typeof remoteVal === 'object' &&
      !Array.isArray(localVal) &&
      !Array.isArray(remoteVal)
    ) {
      result[key as keyof T] = mergeStates(
        localVal as object,
        remoteVal as object
      ) as T[keyof T]
    } else if (remoteVal !== undefined) {
      // Use remote value if it exists (prefer newer data)
      result[key as keyof T] = remoteVal as T[keyof T]
    }
  }

  return result
}

/**
 * Create a conflict resolver with the specified strategy
 * 
 * @param options - Conflict resolution options
 * @returns Conflict resolver functions
 * 
 * @example
 * ```typescript
 * const resolver = createConflictResolver({
 *   strategy: 'merge',
 *   mergeStrategy: mergeStates,
 *   ignoreKeys: ['sessionId', 'lastLogin']
 * })
 * 
 * const result = resolver.resolve(localState, remoteState)
 * ```
 */
export function createConflictResolver<T extends object>(
  options: SyncConflictOptions<T>
): {
  resolve: (localState: T, remoteState: T) => T
  resolveWithResult: (localState: T, remoteState: T) => SyncResult<T>
  setStrategy: (strategy: SyncStrategy) => void
  setCustomHandler: (handler: SyncConflictHandler<T>) => void
} {
  let currentStrategy = options.strategy
  let customHandler = options.onConflict
  let mergeFn = options.mergeStrategy || mergeStates

  const resolveWithResult = (
    localState: T,
    remoteState: T
  ): SyncResult<T> => {
    let resolved: T
    let hadConflict = false

    // Check if states are equal (no conflict)
    const localStr = JSON.stringify(localState)
    const remoteStr = JSON.stringify(remoteState)
    if (localStr === remoteStr) {
      return {
        state: localState,
        hadConflict: false,
        strategy: 'last-write-wins',
        timestamp: new Date()
      }
    }

    hadConflict = true

    switch (currentStrategy) {
      case 'last-write-wins':
        resolved = lastWriteWins(localState, remoteState, options.timestampKey)
        break

      case 'server-wins':
        resolved = serverWins(localState, remoteState)
        break

      case 'client-wins':
        resolved = clientWins(localState, remoteState)
        break

      case 'merge':
        resolved = mergeFn(localState, remoteState, options)
        break

      case 'custom':
        if (customHandler) {
          resolved = customHandler(localState, remoteState, options)
        } else {
          // Fallback to last-write-wins if no custom handler
          resolved = lastWriteWins(localState, remoteState, options.timestampKey)
        }
        break

      default:
        resolved = lastWriteWins(localState, remoteState, options.timestampKey)
    }

    return {
      state: resolved,
      hadConflict,
      strategy: currentStrategy,
      timestamp: new Date()
    }
  }

  return {
    resolve: (localState: T, remoteState: T): T => {
      return resolveWithResult(localState, remoteState).state
    },
    resolveWithResult,
    setStrategy: (strategy: SyncStrategy): void => {
      currentStrategy = strategy
    },
    setCustomHandler: (handler: SyncConflictHandler<T>): void => {
      customHandler = handler
    }
  }
}

/**
 * Default conflict strategies object
 * For easy import and use
 */
export const defaultConflictStrategies = {
  lastWriteWins,
  serverWins,
  clientWins,
  merge: mergeStates
}

/**
 * Compare two states for equality
 * 
 * @param state1 - First state
 * @param state2 - Second state
 * @returns True if states are equal
 */
export function statesEqual<T extends object>(
  state1: T,
  state2: T
): boolean {
  return JSON.stringify(state1) === JSON.stringify(state2)
}

/**
 * Calculate the diff between two states
 * 
 * @param from - Original state
 * @param to - New state
 * @returns Object containing only changed keys
 * 
 * @example
 * ```typescript
 * const diff = getStateDiff(
 *   { a: 1, b: 2, c: 3 },
 *   { a: 1, b: 5, c: 3 }
 * )
 * // Result: { b: 5 }
 * ```
 */
export function getStateDiff<T extends object>(
  from: T,
  to: T
): Partial<T> {
  const diff: Partial<T> = {}
  const allKeys = new Set([
    ...Object.keys(from),
    ...Object.keys(to)
  ])

  for (const key of allKeys) {
    const fromVal = from[key as keyof T]
    const toVal = to[key as keyof T]

    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      diff[key as keyof T] = toVal
    }
  }

  return diff
}

/**
 * Create a storage adapter that tracks changes for conflict detection
 * 
 * @param storage - Base storage adapter
 * @returns Storage adapter with change tracking
 * 
 * @example
 * ```typescript
 * import { createTrackedStorage } from 'zustand-persist-plus/cloud'
 * 
 * const trackedStorage = createTrackedStorage(localStorage)
 * ```
 */
export function createTrackedStorage(
  storage: StateStorage
): StateStorage & {
  getChanges: () => Map<string, { oldValue: unknown; newValue: unknown }>
  clearChanges: () => void
  lastModified: (key: string) => Date | null
} {
  const changes = new Map<string, { oldValue: unknown; newValue: unknown }>()
  const lastModifiedMap = new Map<string, Date>()

  return {
    getItem: async (name: string): Promise<string | null> => {
      return (await storage.getItem(name)) as string | null
    },

    setItem: async (name: string, value: string): Promise<void> => {
      const oldValue = await storage.getItem(name)
      await storage.setItem(name, value)
      
      changes.set(name, {
        oldValue: oldValue ? JSON.parse(oldValue as string) : null,
        newValue: JSON.parse(value)
      })
      lastModifiedMap.set(name, new Date())
    },

    removeItem: async (name: string): Promise<void> => {
      const oldValue = await storage.getItem(name)
      await storage.removeItem(name)
      
      changes.set(name, {
        oldValue: oldValue ? JSON.parse(oldValue as string) : null,
        newValue: null
      })
    },

    getChanges: () => new Map(changes),
    clearChanges: () => {
      changes.clear()
    },
    lastModified: (key: string) => lastModifiedMap.get(key) || null
  }
}

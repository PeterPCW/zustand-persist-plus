# Cloud Sync Documentation

Real-time cloud synchronization for zustand-persist-plus with Supabase and Firebase support.

## Table of Contents

- [Overview](#overview)
- [Supabase Integration](#supabase-integration)
- [Firebase Integration](#firebase-integration)
- [Conflict Resolution](#conflict-resolution)
- [Examples](#examples)
- [Best Practices](#best-practices)

---

## Overview

Cloud sync enables your Zustand stores to synchronize state across multiple devices in real-time using cloud backends.

### Features

- **Real-time sync** - Automatic synchronization when state changes
- **Conflict resolution** - Multiple strategies for handling concurrent updates
- **Offline support** - Local persistence with background sync
- **Multi-provider** - Support for Supabase and Firebase

### Quick Start

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSupabaseStorage } from 'zustand-persist-plus/cloud'

const useStore = create(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 }))
    }),
    {
      name: 'my-store',
      storage: createSupabaseStorage(supabaseClient)
    }
  )
)
```

---

## Supabase Integration

### Setup

```bash
npm install @supabase/supabase-js
```

### Basic Usage

```typescript
import { createClient } from '@supabase/supabase-js'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSupabaseStorage } from 'zustand-persist-plus/cloud'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

const useStore = create(
  persist(
    (set) => ({
      tasks: [],
      addTask: (task) => set((state) => ({
        tasks: [...state.tasks, task]
      })),
      removeTask: (id) => set((state) => ({
        tasks: state.tasks.filter(t => t.id !== id)
      }))
    }),
    {
      name: 'tasks-store',
      storage: createSupabaseStorage(supabase, {
        tableName: 'zustand_state',
        keyColumn: 'store_key',
        valueColumn: 'state_data'
      })
    }
  )
)
```

### Database Schema

Create this table in Supabase:

```sql
CREATE TABLE zustand_store (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE zustand_store ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can read all stores"
  ON zustand_store FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can upsert their stores"
  ON zustand_store FOR ALL
  USING (auth.role() = 'authenticated');
```

### Real-time Subscriptions

```typescript
import { createSupabaseSyncManager } from 'zustand-persist-plus/cloud'

const syncManager = createSupabaseSyncManager(supabase, {
  tableName: 'zustand_store',
  keyColumn: 'name',
  valueColumn: 'data'
})

// Subscribe to changes for a specific store
const unsubscribe = syncManager.subscribe('tasks-store', ({ key, value }) => {
  console.log(`Store "${key}" was updated remotely`)
  if (value) {
    const newState = JSON.parse(value)
    // Update local store with new state
  }
})

// Cleanup
unsubscribe()
```

### Sync Manager API

```typescript
const syncManager = createSupabaseSyncManager(supabase, options)

// Subscribe to a specific store key
const unsubscribe = syncManager.subscribe('store-name', (payload) => {
  console.log('Change:', payload.key, payload.value)
})

// Subscribe to all stores
const unsubscribeAll = syncManager.subscribeAll((payload) => {
  console.log('Any store changed:', payload.key)
})

// Disconnect all subscriptions
syncManager.disconnect()
```

---

## Firebase Integration

### Setup

```bash
npm install firebase
```

### Basic Usage (Realtime Database)

```typescript
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirebaseStorage } from 'zustand-persist-plus/cloud'

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

const useStore = create(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 }))
    }),
    {
      name: 'counter-store',
      storage: createFirebaseStorage(db, {
        path: 'stores/counter'
      })
    }
  )
)
```

### Using Firestore

```typescript
import { getFirestore } from 'firebase/firestore'
import { createFirestoreStorage } from 'zustand-persist-plus/cloud'

const db = getFirestore(app)

const storage = createFirestoreStorage(db, {
  firestorePath: 'zustand/stores',
  enableOffline: true // Enable Firestore offline persistence
})
```

### Sync Manager

```typescript
import { createFirebaseSyncManager } from 'zustand-persist-plus/cloud'

const syncManager = createFirebaseSyncManager(db, {
  path: 'stores',
  enableSync: true
})

// Subscribe to changes
const unsubscribe = syncManager.subscribe('counter-store', ({ key, value }) => {
  console.log('Remote change:', key)
})

// Cleanup
unsubscribe()
```

---

## Conflict Resolution

### Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `last-write-wins` | Most recent update wins | Simple state, single user |
| `server-wins` | Remote/server always wins | Authoritative server |
| `client-wins` | Local client always wins | Offline-first, optimistic |
| `merge` | Deep merge both states | Complex objects |

### Basic Usage

```typescript
import { createConflictResolver } from 'zustand-persist-plus/cloud'

const resolver = createConflictResolver({
  strategy: 'last-write-wins',
  timestampKey: '_updatedAt'
})

const resolved = resolver.resolve(localState, remoteState)
```

### Custom Handler

```typescript
const resolver = createConflictResolver({
  strategy: 'custom',
  onConflict: (local, remote) => {
    // Custom logic
    if (local.lastWriteTime > remote.lastWriteTime) {
      return local
    }
    return remote
  }
})
```

### Merge Strategy

```typescript
import { mergeStates } from 'zustand-persist-plus/cloud'

const resolver = createConflictResolver({
  strategy: 'merge',
  mergeStrategy: mergeStates,
  ignoreKeys: ['sessionId', 'userToken'], // Don't merge these
  forceLWWKeys: ['lastActiveAt'] // Always use newest for these
})
```

### Sync Result

```typescript
const result = resolver.resolveWithResult(localState, remoteState)

console.log(result.hadConflict)    // true if there was a conflict
console.log(result.strategy)       // 'last-write-wins'
console.log(result.timestamp)      // Date of resolution
console.log(result.state)          // Resolved state
```

### State Utilities

```typescript
import { 
  statesEqual, 
  getStateDiff, 
  createTrackedStorage 
} from 'zustand-persist-plus/cloud'

// Check if states are equal
const isEqual = statesEqual(state1, state2)

// Get the diff between states
const diff = getStateDiff(oldState, newState)
// { taskList: [...], userPreferences: {...} }

// Track storage changes
const tracked = createTrackedStorage(localStorage)
tracked.setItem('key', 'value')
const changes = tracked.getChanges()
tracked.clearChanges()
```

---

## Examples

### Complete Supabase Example

```typescript
// store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSupabaseStorage, createSupabaseSyncManager } from 'zustand-persist-plus/cloud'
import { createConflictResolver, mergeStates } from 'zustand-persist-plus/cloud'

const supabase = createClient(URL, KEY)

// Create storage adapter
const storage = createSupabaseStorage(supabase, {
  tableName: 'app_state',
  keyColumn: 'store_name',
  valueColumn: 'state_data'
})

// Create sync manager
const syncManager = createSupabaseSyncManager(supabase, {
  tableName: 'app_state',
  keyColumn: 'store_name',
  valueColumn: 'state_data'
})

// Create conflict resolver
const conflictResolver = createConflictResolver({
  strategy: 'merge',
  mergeStrategy: mergeStates,
  ignoreKeys: ['session']
})

// Subscribe to remote changes
syncManager.subscribe('user-settings', ({ value }) => {
  if (value) {
    const remoteState = JSON.parse(value)
    console.log('Remote update received')
  }
})

// Store definition
interface SettingsState {
  theme: 'light' | 'dark'
  language: string
  notifications: boolean
  updateSettings: (settings: Partial<SettingsState>) => void
}

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      language: 'en',
      notifications: true,
      updateSettings: (newSettings) => set((state) => ({
        ...state,
        ...newSettings
      }))
    }),
    {
      name: 'user-settings',
      storage
    }
  )
)

export { useSettingsStore }
```

### Complete Firebase Example

```typescript
// store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFirebaseStorage, createFirebaseSyncManager } from 'zustand-persist-plus/cloud'
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

const storage = createFirebaseStorage(db, {
  path: 'zustand/stores',
  enableSync: true
})

const syncManager = createFirebaseSyncManager(db, {
  path: 'zustand/stores',
  enableSync: true
})

// Subscribe to all changes
syncManager.subscribeAll(({ key, value }) => {
  console.log(`Store "${key}" changed`)
})

interface TodoState {
  todos: { id: string; text: string; done: boolean }[]
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
}

const useTodoStore = create<TodoState>()(
  persist(
    (set) => ({
      todos: [],
      addTodo: (text) => set((state) => ({
        todos: [...state.todos, { id: crypto.randomUUID(), text, done: false }]
      })),
      toggleTodo: (id) => set((state) => ({
        todos: state.todos.map(todo =>
          todo.id === id ? { ...todo, done: !todo.done } : todo
        )
      }))
    }),
    {
      name: 'todos',
      storage
    }
  )
)

export { useTodoStore }
```

### Multi-Store Sync

```typescript
import { createSupabaseSyncManager } from 'zustand-persist-plus/cloud'

const syncManager = createSupabaseSyncManager(supabase)

// Subscribe to multiple stores
const unsubscribes = ['user-store', 'settings-store', 'cart-store'].map(key => {
  return syncManager.subscribe(key, ({ key, value }) => {
    console.log(`${key} updated:`, value ? JSON.parse(value) : null)
  })
})

// Cleanup all
unsubscribes.forEach(unsub => unsub())
```

---

## Best Practices

### 1. Use Timestamp Keys

Include a timestamp in your state for conflict resolution:

```typescript
const useStore = create(
  persist(
    (set) => ({
      _updatedAt: new Date().toISOString(),
      data: 'value',
      updateData: (value) => set((state) => ({
        data: value,
        _updatedAt: new Date().toISOString()
      }))
    }),
    { name: 'store' }
  )
)
```

### 2. Handle Offline Scenarios

```typescript
import { createPersistPlus } from 'zustand-persist-plus'

const storage = createPersistPlus({
  name: 'store',
  storage: 'localStorage',
  encrypt: true,
  compress: true
})
```

### 3. Limit State Size

Large state objects affect sync performance:

```typescript
// ❌ Bad: Syncing entire cache
const useStore = create(
  persist((set) => ({
    cache: hugeArray // Will be synced entirely
  }), { name: 'cache' })
)

// ✅ Good: Syncing only necessary data
const useStore = create(
  persist((set) => ({
    metadata: { count: 0, lastSync: null }, // Only sync metadata
    cache: hugeArray // Kept local only
  }), { 
    name: 'store',
    partialize: (state) => ({ metadata: state.metadata })
  })
)
```

### 4. Use Partialize for Selective Sync

```typescript
const useStore = create(
  persist(
    (set) => ({
      user: { name: 'John' },
      preferences: { theme: 'dark' },
      tempState: { draft: {} } // Not persisted
    }),
    {
      name: 'app',
      partialize: (state) => ({
        user: state.user,
        preferences: state.preferences
        // tempState is not persisted
      })
    }
  )
)
```

### 5. Debounce Frequent Updates

```typescript
import { debounce } from 'lodash-es'

let pendingUpdate = false

const useStore = create(
  persist(
    (set) => ({
      cursor: { x: 0, y: 0 },
      updateCursor: debounce((x, y) => {
        set({ cursor: { x, y } })
      }, 100)
    }),
    { name: 'cursor-store' }
  )
)
```

### 6. Handle Reconnection

```typescript
import { createSupabaseSyncManager } from 'zustand-persist-plus/cloud'

const syncManager = createSupabaseSyncManager(supabase)

// Handle reconnection
window.addEventListener('online', () => {
  console.log('Back online, resyncing...')
  // Trigger a manual sync
})
```

---

## API Reference

### Supabase Storage

```typescript
createSupabaseStorage(client, options): StateStorage
createSupabaseSyncManager(client, options): SupabaseSyncManager
```

### Firebase Storage

```typescript
createFirebaseStorage(db, options): StateStorage
createFirestoreStorage(db, options): StateStorage
createFirebaseSyncManager(db, options): FirebaseSyncManager
```

### Sync Middleware

```typescript
withCloudSync(storeCreator, config): StateCreator
```

### Conflict Resolution

```typescript
createConflictResolver(options): ConflictResolver
lastWriteWins<T>(local, remote, timestampKey): T
mergeStates<T>(local, remote, options): T
```

---

## Troubleshooting

### Slow Sync Performance

- Reduce state size using `partialize`
- Use compression middleware
- Debounce frequent updates

### Conflicts Not Resolving

- Ensure `_updatedAt` timestamp is being updated
- Check conflict strategy configuration
- Verify custom handler logic

### Real-time Not Working

- Check RLS policies in Supabase
- Verify Firebase security rules
- Ensure subscriptions are active

---

## Changelog

### v0.2.0

- Added Supabase storage adapter
- Added Firebase storage adapter
- Added real-time sync managers
- Added conflict resolution strategies
- Added state diff utilities

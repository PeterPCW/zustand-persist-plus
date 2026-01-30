# Zustand Cloud Sync Research - v0.2.0 Features

**Created:** 2026-01-30
**Author:** Research Beat

## Overview

Research findings for adding Firebase and Supabase cloud sync capabilities to zustand-persist-plus v0.2.0.

---

## Supabase Integration Patterns

### Key Findings from pmndrs/zustand Discussion #2284

**Recommended Approach:**
- Use Zustand persist middleware with custom storage adapter
- Sync changes with Supabase database through the storage layer
- Maintain local state for speed while keeping DB in sync

**Pattern: "Connect to whole table" vs "Simple stores with actions"**
- For Notion-like apps: Connect to whole table for real-time sync
- For simple state: Use actions like `isFavorite` that update both local + DB
- Hybrid approach: Local optimistic updates → sync to Supabase

**Implementation Pattern:**
```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand-persist-plus'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(URL, KEY)

const useStore = create()(
  persist(
    (set, get) => ({
      // State...
    }),
    {
      name: 'store-name',
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          const { data } = await supabase
            .from('zustand_store')
            .select('value')
            .eq('name', name)
            .single()
          return data?.value
        },
        setItem: async (name, value) => {
          await supabase
            .from('zustand_store')
            .upsert({ name, value, updated_at: new Date() })
        },
        removeItem: async (name) => {
          await supabase.from('zustand_store').delete().eq('name', name)
        },
      })),
    }
  )
)
```

### Real-time Sync with Supabase

Supabase provides real-time subscriptions for syncing across devices:

```typescript
// Subscribe to changes
supabase
  .channel('zustand_store')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'zustand_store' 
  }, (payload) => {
    // Handle remote changes
    // Update local store
  })
  .subscribe()
```

**Advantages:**
- PostgreSQL for relational data
- Row Level Security (RLS) for security
- Realtime subscriptions built-in
- Open-source, self-hostable option

---

## Firebase Integration Patterns

### Key Findings from pmndrs/zustand Discussion #477

**Approach:**
- Subscribe to Firebase paths for different components
- Decouple components from data fetching
- Use Zustand as the centralized state layer

**Implementation Pattern:**
```typescript
import { create } from 'zustand'
import { persist } from 'zustand-persist-plus'
import { getDatabase, ref, onValue, set } from 'firebase/database'

const db = getDatabase()

const useStore = create()(
  persist(
    (set) => ({
      // State...
    }),
    {
      name: 'store-name',
      storage: {
        getItem: async (name) => {
          return new Promise((resolve) => {
            const starCountRef = ref(db, `zustand/${name}`)
            onValue(starCountRef, (snapshot) => {
              resolve(snapshot.val())
            })
          })
        },
        setItem: async (name, value) => {
          await set(ref(db, `zustand/${name}`), value)
        },
        removeItem: async (name) => {
          await set(ref(db, `zustand/${name}`), null)
        },
      },
    }
  )
)
```

### Firebase Offline Capabilities

Firebase provides built-in offline persistence:

```typescript
// Enable offline persistence
const db = getDatabase()
enableIndexedDbPersistence(db)
```

**Advantages:**
- Mature offline resilience
- Built-in real-time sync
- Firebase leads in offline capabilities (per Bytebase 2025 comparison)
- Proven scaling for millions of users

---

## Recommended v0.2.0 Implementation

### Phase 1: Storage Adapters

Create factory functions for each provider:

```typescript
// src/lib/cloud/supabase.ts
export function createSupabaseStorage(
  supabaseClient: SupabaseClient,
  options?: { tableName?: string; keyColumn?: string; valueColumn?: string }
): StorageLike {
  const { tableName = 'zustand_store', keyColumn = 'name', valueColumn = 'value' } = options || {}
  
  return {
    getItem: async (name: string): Promise<string | null> => {
      const { data } = await supabase
        .from(tableName)
        .select(valueColumn)
        .eq(keyColumn, name)
        .single()
      return data?.[valueColumn] ?? null
    },
    setItem: async (name: string, value: string): Promise<void> => {
      await supabase.from(tableName).upsert({
        [keyColumn]: name,
        [valueColumn]: value,
        updated_at: new Date().toISOString(),
      })
    },
    removeItem: async (name: string): Promise<void> => {
      await supabase.from(tableName).delete().eq(keyColumn, name)
    },
  }
}

// src/lib/cloud/firebase.ts
export function createFirebaseStorage(
  firebaseDb: Database,
  path: string = 'zustand'
): StorageLike {
  return {
    getItem: async (name: string): Promise<string | null> => {
      const snapshot = await get(ref(firebaseDb, `${path}/${name}`))
      return snapshot.val()
    },
    setItem: async (name: string, value: string): Promise<void> => {
      await set(ref(firebaseDb, `${path}/${name}`), value)
    },
    removeItem: async (name: string): Promise<void> => {
      await set(ref(firebaseDb, `${path}/${name}`), null)
    },
  }
}
```

### Phase 2: Real-time Sync Middleware

```typescript
// src/lib/cloud/sync.ts
export function withCloudSync<T extends State>(
  store: StateCreator<T>,
  options: {
    provider: 'supabase' | 'firebase'
    client: SupabaseClient | Database
    channel?: string
    onSync?: (state: T) => void
  }
): StateCreator<T> {
  return (set, get, api) => {
    // Setup real-time subscription
    // Handle incoming changes
    // Merge with local state
    
    return store(set, get, api)
  }
}
```

### Phase 3: Conflict Resolution

Implement last-write-wins or merge strategies:

```typescript
interface SyncOptions {
  conflictStrategy: 'last-write-wins' | 'merge' | 'server-wins' | 'client-wins'
  mergeStrategy?: (local: any, remote: any, key: string) => any
}
```

---

## Comparison: Supabase vs Firebase

| Feature | Supabase | Firebase |
|---------|----------|----------|
| **Offline resilience** | Limited (needs manual) | Excellent (built-in) |
| **Real-time maturity** | Good (PostgreSQL CDC) | Excellent (WebSocket-native) |
| **Data model** | Relational (SQL) | NoSQL document |
| **Query capability** | Full SQL | Limited |
| **Pricing** | Based on bandwidth | Based on operations |
| **Self-hosting** | Yes (open source) | No (closed source) |
| **Auth integration** | Built-in | Built-in |
| **Type safety** | TypeScript + SQL types | TypeScript SDK |

**Recommendation:**
- Use **Supabase** for: Relational data, complex queries, SQL needs, self-hosting preference
- Use **Firebase** for: Offline-first apps, simple document storage, proven scalability

---

## Files to Create for v0.2.0

1. `src/lib/cloud/supabase.ts` - Supabase storage adapter factory
2. `src/lib/cloud/firebase.ts` - Firebase storage adapter factory
3. `src/lib/cloud/sync.ts` - Real-time sync middleware
4. `src/lib/cloud/conflict.ts` - Conflict resolution utilities
5. `docs/cloud-sync.md` - Documentation with examples

---

## References

- https://github.com/pmndrs/zustand/discussions/2284
- https://github.com/pmndrs/zustand/discussions/477
- https://www.bytebase.com/blog/supabase-vs-firebase/
- https://www.leanware.co/insights/supabase-vs-firebase-complete-comparison-guide

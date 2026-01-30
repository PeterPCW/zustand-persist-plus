# Examples Index

This directory contains practical examples for using zustand-persist-plus.

## Available Examples

| File | Description | Topics |
|------|-------------|--------|
| `CLOUD_SYNC_EXAMPLES.md` | Complete cloud sync examples | Supabase, Firebase, real-time sync, conflict resolution |

## Quick Start

### Supabase with Encryption + Real-time Sync

```typescript
import { create } from 'zustand'
import { persist, createEncryptedStorage } from 'zustand-persist-plus'
import { createSupabaseStorage, withCloudSync } from 'zustand-persist-plus/cloud'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(URL, KEY)

interface AppState {
  data: any
  setData: (data: any) => void
}

const useStore = create<AppState>()(
  persist(
    withCloudSync(
      (set) => ({ data: null, setData: (data) => set({ data }) }),
      { provider: 'supabase', client: supabase }
    ),
    {
      name: 'app-store',
      storage: createSupabaseStorage(supabase),
    }
  )
)
```

### Firebase with Offline Support

```typescript
import { create } from 'zustand'
import { persist } from 'zustand-persist-plus'
import { createFirebaseStorage, withCloudSync } from 'zustand-persist-plus/cloud'
import { getDatabase, enableIndexedDbPersistence } from 'firebase/database'

const db = getDatabase()
enableIndexedDbPersistence(db) // Enable offline

interface AppState {
  todos: Todo[]
  addTodo: (todo: Todo) => void
}

const useStore = create<AppState>()(
  persist(
    (set) => ({ todos: [], addTodo: (todo) => set((s) => ({ todos: [...s.todos, todo] })) }),
    {
      name: 'app-store',
      storage: createFirebaseStorage(db, 'todos'),
    }
  )
)
```

## Cloud Provider Comparison

| Feature | Supabase | Firebase |
|---------|----------|----------|
| **Best for** | SQL queries, self-hosting | Offline-first, real-time |
| **Offline support** | Manual | Built-in |
| **Conflict strategies** | All 4 supported | All 4 supported |

## Common Patterns

1. **Encryption + Cloud** - Wrap cloud storage with `createEncryptedStorage`
2. **Compression + Cloud** - Wrap cloud storage with `createCompressedStorage`
3. **Multi-device sync** - Use `withCloudSync` middleware
4. **Conflict resolution** - Choose strategy: `last-write-wins`, `merge`, `server-wins`, `client-wins`

## Learn More

- [Cloud Sync Documentation](../cloud-sync.md) - Full API reference
- [CLOUD_SYNC_EXAMPLES.md](./CLOUD_SYNC_EXAMPLES.md) - Detailed examples
- [GitHub Repository](https://github.com/yourusername/zustand-persist-plus)

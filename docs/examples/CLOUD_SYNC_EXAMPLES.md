# Cloud Sync Examples

Practical examples for using cloud sync features in zustand-persist-plus.

## Table of Contents

- [Supabase Setup](#supabase-setup)
- [Firebase Setup](#firebase-setup)
- [Real-time Sync](#real-time-sync)
- [Conflict Resolution](#conflict-resolution)
- [Complete Examples](#complete-examples)

---

## Supabase Setup

### Basic Supabase Storage

```typescript
import { create } from 'zustand'
import { persist, createEncryptedStorage } from 'zustand-persist-plus'
import { createSupabaseStorage } from 'zustand-persist-plus/cloud'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// Create store with Supabase persistence
interface AppState {
  user: User | null
  preferences: Preferences
  setUser: (user: User | null) => void
  updatePreferences: (prefs: Partial<Preferences>) => void
}

const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      preferences: { theme: 'dark', notifications: true },
      
      setUser: (user) => set({ user }),
      updatePreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),
    }),
    {
      name: 'app-store',
      storage: createSupabaseStorage(supabase, {
        tableName: 'zustand_state',
        keyColumn: 'store_name',
        valueColumn: 'state_data',
      }),
    }
  )
)
```

### Supabase with Encryption

```typescript
import { create } from 'zustand'
import { persist, createEncryptedStorage } from 'zustand-persist-plus'
import { createSupabaseStorage } from 'zustand-persist-plus/cloud'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// Combine encryption with cloud storage
const secureStorage = createEncryptedStorage(
  createSupabaseStorage(supabase, {
    tableName: 'secure_state',
  }),
  {
    secretKey: process.env.ENCRYPTION_KEY!,
  }
)

interface SecureState {
  apiKey: string | null
  sensitiveData: string | null
  setCredentials: (key: string, data: string) => void
  clearCredentials: () => void
}

const useSecureStore = create<SecureState>()(
  persist(
    (set) => ({
      apiKey: null,
      sensitiveData: null,
      
      setCredentials: (key, data) => set({ apiKey: key, sensitiveData: data }),
      clearCredentials: () => set({ apiKey: null, sensitiveData: null }),
    }),
    {
      name: 'secure-store',
      storage: secureStorage,
    }
  )
)
```

---

## Firebase Setup

### Basic Firebase Realtime Database

```typescript
import { create } from 'zustand'
import { persist } from 'zustand-persist-plus'
import { createFirebaseStorage } from 'zustand-persist-plus/cloud'
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseApp = initializeApp(firebaseConfig)
const db = getDatabase(firebaseApp)

interface TodoState {
  todos: Todo[]
  addTodo: (todo: Todo) => void
  toggleTodo: (id: string) => void
  removeTodo: (id: string) => void
}

const useTodoStore = create<TodoState>()(
  persist(
    (set) => ({
      todos: [],
      
      addTodo: (todo) =>
        set((state) => ({ todos: [...state.todos, todo] })),
      
      toggleTodo: (id) =>
        set((state) => ({
          todos: state.todos.map((t) =>
            t.id === id ? { ...t, completed: !t.completed } : t
          ),
        })),
      
      removeTodo: (id) =>
        set((state) => ({
          todos: state.todos.filter((t) => t.id !== id),
        })),
    }),
    {
      name: 'todo-store',
      storage: createFirebaseStorage(db, 'todos'),
    }
  )
)
```

### Firebase with Firestore

```typescript
import { create } from 'zustand'
import { persist } from 'zustand-persist-plus'
import { createFirestoreStorage } from 'zustand-persist-plus/cloud'
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseApp = initializeApp(firebaseConfig)
const db = getFirestore(firebaseApp)

interface NoteState {
  notes: Note[]
  addNote: (note: Note) => void
  updateNote: (id: string, updates: Partial<Note>) => void
  deleteNote: (id: string) => void
}

const useNoteStore = create<NoteState>()(
  persist(
    (set) => ({
      notes: [],
      
      addNote: (note) =>
        set((state) => ({ notes: [...state.notes, note] })),
      
      updateNote: (id, updates) =>
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, ...updates } : n
          ),
        })),
      
      deleteNote: (id) =>
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
        })),
    }),
    {
      name: 'note-store',
      storage: createFirestoreStorage(db, 'notes'),
    }
  )
)
```

---

## Real-time Sync

### Supabase Real-time Sync

```typescript
import { create } from 'zustand'
import { persist } from 'zustand-persist-plus'
import { createSupabaseStorage, withCloudSync } from 'zustand-persist-plus/cloud'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

interface SyncState {
  items: Item[]
  lastSynced: Date | null
  isOnline: boolean
  addItem: (item: Item) => void
}

const useSyncStore = create<SyncState>()(
  persist(
    withCloudSync(
      (set) => ({
        items: [],
        lastSynced: null,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        
        addItem: (item) =>
          set((state) => ({
            items: [...state.items, item],
            lastSynced: new Date(),
          })),
      }),
      {
        provider: 'supabase',
        client: supabase,
        channel: 'store-sync',
        onSync: (state) => {
          console.log('State synced:', state)
        },
      }
    ),
    {
      name: 'sync-store',
      storage: createSupabaseStorage(supabase),
    }
  )
)

// Listen for online/offline status
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useSyncStore.setState({ isOnline: true })
  })
  window.addEventListener('offline', () => {
    useSyncStore.setState({ isOnline: false })
  })
}
```

### Firebase Real-time Sync

```typescript
import { create } from 'zustand'
import { persist } from 'zustand-persist-plus'
import { createFirebaseStorage, withCloudSync } from 'zustand-persist-plus/cloud'
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseApp = initializeApp(firebaseConfig)
const db = getDatabase(firebaseApp)

interface CollaborativeState {
  cursor: { x: number; y: number } | null
  activeUsers: UserPresence[]
  updateCursor: (cursor: { x: number; y: number }) => void
}

const useCollabStore = create<CollaborativeState>()(
  persist(
    withCloudSync(
      (set) => ({
        cursor: null,
        activeUsers: [],
        
        updateCursor: (cursor) => set({ cursor }),
      }),
      {
        provider: 'firebase',
        client: db,
        channel: 'collaborative-editing',
      }
    ),
    {
      name: 'collab-store',
      storage: createFirebaseStorage(db, 'collaborative'),
    }
  )
)
```

---

## Conflict Resolution

### Last Write Wins (Default)

```typescript
import { create } from 'zustand'
import { persist } from 'zustand-persist-plus'
import {
  createSupabaseStorage,
  withCloudSync,
  lastWriteWins,
} from 'zustand-persist-plus/cloud'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

interface GameState {
  score: number
  level: number
  inventory: string[]
  incrementScore: (amount: number) => void
}

const useGameStore = create<GameState>()(
  persist(
    withCloudSync(
      (set) => ({
        score: 0,
        level: 1,
        inventory: [],
        
        incrementScore: (amount) =>
          set((state) => ({ score: state.score + amount })),
      }),
      {
        provider: 'supabase',
        client: supabase,
        conflictStrategy: 'last-write-wins',
      }
    ),
    {
      name: 'game-store',
      storage: createSupabaseStorage(supabase),
    }
  )
)
```

### Custom Merge Strategy

```typescript
import { create } from 'zustand'
import { persist } from 'zustand-persist-plus'
import {
  createSupabaseStorage,
  withCloudSync,
  createConflictResolver,
} from 'zustand-persist-plus/cloud'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// Custom merge for document state
const documentMerger = createConflictResolver({
  conflictStrategy: 'merge',
  mergeStrategy: (local, remote, key) => {
    if (key === 'content') {
      // Prefer longer content (assume more edits)
      return local.length >= remote.length ? local : remote
    }
    if (key === 'lastModified') {
      // Use latest timestamp
      return new Date(local) > new Date(remote) ? local : remote
    }
    // Default: remote wins
    return remote
  },
})

interface DocumentState {
  id: string
  title: string
  content: string
  lastModified: string
  updateContent: (content: string) => void
}

const useDocumentStore = create<DocumentState>()(
  persist(
    withCloudSync(
      (set) => ({
        id: '',
        title: 'Untitled',
        content: '',
        lastModified: new Date().toISOString(),
        
        updateContent: (content) =>
          set({
            content,
            lastModified: new Date().toISOString(),
          }),
      }),
      {
        provider: 'supabase',
        client: supabase,
        conflictStrategy: 'merge',
        mergeStrategy: documentMerger,
      }
    ),
    {
      name: 'document-store',
      storage: createSupabaseStorage(supabase),
    }
  )
)
```

### Server Wins (Authoritative)

```typescript
import { create } from 'zustand'
import { persist } from 'zustand-persist-plus'
import {
  createSupabaseStorage,
  withCloudSync,
  serverWins,
} from 'zustand-persist-plus/cloud'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

interface ConfigState {
  featureFlags: Record<string, boolean>
  config: Record<string, any>
  updateFeatureFlag: (key: string, value: boolean) => void
}

const useConfigStore = create<ConfigState>()(
  persist(
    withCloudSync(
      (set) => ({
        featureFlags: {},
        config: {},
        
        updateFeatureFlag: (key, value) =>
          set((state) => ({
            featureFlags: { ...state.featureFlags, [key]: value },
          })),
      }),
      {
        provider: 'supabase',
        client: supabase,
        conflictStrategy: 'server-wins', // Server config is authoritative
      }
    ),
    {
      name: 'config-store',
      storage: createSupabaseStorage(supabase),
    }
  )
)
```

---

## Complete Examples

### Multi-Device Todo App

```typescript
import { create } from 'zustand'
import { persist, createEncryptedStorage } from 'zustand-persist-plus'
import {
  createSupabaseStorage,
  withCloudSync,
  createConflictResolver,
  lastWriteWins,
} from 'zustand-persist-plus/cloud'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// Create encrypted storage for privacy
const encryptedStorage = createEncryptedStorage(
  createSupabaseStorage(supabase, {
    tableName: 'encrypted_todos',
  }),
  {
    secretKey: process.env.TODO_ENCRYPTION_KEY!,
  }
)

export interface Todo {
  id: string
  text: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

interface TodoState {
  todos: Todo[]
  filter: 'all' | 'active' | 'completed'
  searchQuery: string
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
  deleteTodo: (id: string) => void
  setFilter: (filter: 'all' | 'active' | 'completed') => void
  setSearchQuery: (query: string) => void
}

// Conflict resolver for todos - prefer completed items
const todoConflictResolver = createConflictResolver({
  conflictStrategy: 'merge',
  mergeStrategy: (local, remote, key) => {
    if (key === 'todos') {
      // Merge todo arrays by ID
      const localTodos = new Map(local.map((t: Todo) => [t.id, t]))
      const remoteTodos = new Map(remote.map((t: Todo) => [t.id, t]))
      
      const merged = new Map<string, Todo>()
      
      // Add all local todos
      for (const [id, todo] of localTodos) {
        merged.set(id, todo)
      }
      
      // Update with remote, preferring completed status
      for (const [id, remoteTodo] of remoteTodos) {
        const localTodo = localTodos.get(id)
        if (!localTodo || remoteTodo.updatedAt > localTodo.updatedAt) {
          merged.set(id, remoteTodo)
        }
      }
      
      return Array.from(merged.values())
    }
    return remote
  },
})

const useTodoStore = create<TodoState>()(
  persist(
    withCloudSync(
      (set) => ({
        todos: [],
        filter: 'all',
        searchQuery: '',
        
        addTodo: (text) =>
          set((state) => ({
            todos: [
              ...state.todos,
              {
                id: crypto.randomUUID(),
                text,
                completed: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          })),
        
        toggleTodo: (id) =>
          set((state) => ({
            todos: state.todos.map((t) =>
              t.id === id
                ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() }
                : t
            ),
          })),
        
        deleteTodo: (id) =>
          set((state) => ({
            todos: state.todos.filter((t) => t.id !== id),
          })),
        
        setFilter: (filter) => set({ filter }),
        setSearchQuery: (searchQuery) => set({ searchQuery }),
      }),
      {
        provider: 'supabase',
        client: supabase,
        conflictStrategy: 'merge',
        mergeStrategy: todoConflictResolver,
        onSync: (state) => {
          console.log('Todos synced from cloud:', state.todos.length, 'items')
        },
      }
    ),
    {
      name: 'encrypted-todos',
      storage: encryptedStorage,
      partialize: (state) => ({ filter: state.filter, searchQuery: state.searchQuery }),
    }
  )
)

// Selector hooks for efficiency
export const useFilteredTodos = () => {
  const todos = useTodoStore((state) => state.todos)
  const filter = useTodoStore((state) => state.filter)
  const searchQuery = useTodoStore((state) => state.searchQuery)
  
  return todos
    .filter((todo) => {
      if (filter === 'active') return !todo.completed
      if (filter === 'completed') return todo.completed
      return true
    })
    .filter((todo) =>
      todo.text.toLowerCase().includes(searchQuery.toLowerCase())
    )
}

export const useTodoStats = () => {
  const todos = useTodoStore((state) => state.todos)
  return {
    total: todos.length,
    active: todos.filter((t) => !t.completed).length,
    completed: todos.filter((t) => t.completed).length,
  }
}
```

### Offline-First Shopping Cart

```typescript
import { create } from 'zustand'
import { persist, createEncryptedStorage, createCompressedStorage } from 'zustand-persist-plus'
import {
  createFirebaseStorage,
  withCloudSync,
  clientWins,
} from 'zustand-persist-plus/cloud'
import { initializeApp } from 'firebase/app'
import { getDatabase, enableIndexedDbPersistence } from 'firebase/database'

const firebaseApp = initializeApp(firebaseConfig)
const db = getDatabase(firebaseApp)

// Enable offline persistence for Firebase
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab')
  } else if (err.code === 'unsupported-environment') {
    console.warn('Persistence is not supported in this browser')
  }
})

export interface CartItem {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  addedAt: string
}

interface CartState {
  items: CartItem[]
  lastUpdated: string | null
  addItem: (item: Omit<CartItem, 'id' | 'addedAt'>) => void
  updateQuantity: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

// Combine encryption + compression + cloud storage
const secureCartStorage = createCompressedStorage(
  createEncryptedStorage(
    createFirebaseStorage(db, 'shopping_cart'),
    { secretKey: process.env.CART_ENCRYPTION_KEY! }
  )
)

const useCartStore = create<CartState>()(
  persist(
    withCloudSync(
      (set) => ({
        items: [],
        lastUpdated: null,
        
        addItem: (item) =>
          set((state) => ({
            items: [
              ...state.items,
              {
                ...item,
                id: crypto.randomUUID(),
                addedAt: new Date().toISOString(),
              },
            ],
            lastUpdated: new Date().toISOString(),
          })),
        
        updateQuantity: (id, quantity) =>
          set((state) => ({
            items: state.items.map((item) =>
              item.id === id ? { ...item, quantity } : item
            ),
            lastUpdated: new Date().toISOString(),
          })),
        
        removeItem: (id) =>
          set((state) => ({
            items: state.items.filter((item) => item.id !== id),
            lastUpdated: new Date().toISOString(),
          })),
        
        clearCart: () =>
          set({ items: [], lastUpdated: new Date().toISOString() }),
      }),
      {
        provider: 'firebase',
        client: db,
        conflictStrategy: 'client-wins', // User's cart takes precedence
      }
    ),
    {
      name: 'shopping-cart',
      storage: secureCartStorage,
    }
  )
)

export const useCartTotal = () => {
  const items = useCartStore((state) => state.items)
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

export const useCartItemCount = () => {
  const items = useCartStore((state) => state.items)
  return items.reduce((count, item) => count + item.quantity, 0)
}
```

---

## Error Handling

```typescript
import { create } from 'zustand'
import { persist } from 'zustand-persist-plus'
import { createSupabaseStorage, withCloudSync } from 'zustand-persist-plus/cloud'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

interface ErrorState {
  syncError: Error | null
  isSyncing: boolean
  syncStatus: 'idle' | 'syncing' | 'error' | 'success'
  setSyncError: (error: Error | null) => void
  setSyncing: (syncing: boolean) => void
}

const useErrorStore = create<ErrorState>()(
  persist(
    withCloudSync(
      (set) => ({
        syncError: null,
        isSyncing: false,
        syncStatus: 'idle',
        
        setSyncError: (error) =>
          set({ syncError: error, isSyncing: false, syncStatus: 'error' }),
        
        setSyncing: (syncing) =>
          set({ isSyncing: syncing, syncStatus: syncing ? 'syncing' : 'success' }),
      }),
      {
        provider: 'supabase',
        client: supabase,
        onSync: (state) => {
          useErrorStore.getState().setSyncing(false)
        },
        onError: (error) => {
          useErrorStore.getState().setSyncError(error)
        },
      }
    ),
    {
      name: 'error-store',
      storage: createSupabaseStorage(supabase),
    }
  )
)

// Usage: Show error UI when sync fails
const SyncStatus = () => {
  const { syncStatus, syncError } = useErrorStore()
  
  if (syncStatus === 'error' && syncError) {
    return (
      <div className="sync-error">
        <p>Sync failed: {syncError.message}</p>
        <button onClick={() => /* retry */}>
          Retry
        </button>
      </div>
    )
  }
  
  return null
}
```

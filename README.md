# zustand-persist-plus

<div align="center">

[![npm version](https://img.shields.io/npm/v/zustand-persist-plus.svg)](https://www.npmjs.com/package/zustand-persist-plus)
[![npm downloads](https://img.shields.io/npm/dm/zustand-persist-plus.svg)](https://www.npmjs.com/package/zustand-persist-plus)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Advanced persistence extensions for Zustand v5 — encryption, compression, migrations, and cloud sync.**

</div>

---

## Why zustand-persist-plus?

Building robust persistence in Zustand is hard. This plugin makes it effortless:

| Feature | Without zustand-persist-plus | With zustand-persist-plus |
|---------|------------------------------|---------------------------|
| Encryption | Manual crypto-js integration | One-line middleware |
| Compression | Custom LZ-string logic | Auto compression middleware |
| Migrations | Write your own migration engine | Built-in version control |
| Cloud Sync | Complex Supabase/Firebase setup | Drop-in sync adapters |
| TypeScript | Generic types, errors everywhere | Full strict typing |

## Features

- 🔐 **Encryption** — AES-GCM and XSalsa20 encryption for secure data storage
- 📦 **Compression** — LZ-String compression to reduce storage size by 60-80%
- 🔄 **Migration** — Built-in schema migration with automatic version tracking
- ☁️ **Cloud Sync** — Firebase & Supabase real-time sync with conflict resolution
- 📄 **TypeScript** — Full strict typing with zero configuration
- ⚡ **Zero Runtime Overhead** — Tree-shakeable, minimal bundle size

## Installation

```bash
npm install zustand-persist-plus zustand@^5.0.0
# or
pnpm add zustand-persist-plus zustand@^5.0.0
# or
yarn add zustand-persist-plus zustand@^5.0.0
```

## Quick Start

```typescript
import { create } from 'zustand'
import { persist, withEncryption, withCompression } from 'zustand-persist-plus'

const useStore = create(
  persist(
    withEncryption('your-secret-key')(
      withCompression()(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 }))
        })
      )
    ),
    { name: 'my-store' }
  )
)
```

## Usage

### Encryption

Protect sensitive user data with military-grade encryption:

```typescript
import { create } from 'zustand'
import { persist, withEncryption } from 'zustand-persist-plus'

interface AuthStore {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
}

const useAuthStore = create<AuthStore>()(
  persist(
    withEncryption(process.env.NEXT_PUBLIC_ENCRYPTION_KEY!, {
      algorithm: 'AES-GCM',
      encode: true
    })(
      (set) => ({
        token: null,
        user: null,
        setAuth: (token, user) => set({ token, user }),
        logout: () => set({ token: null, user: null })
      })
    ),
    { name: 'auth-store' }
  )
)
```

### Compression

Store large datasets efficiently:

```typescript
import { create } from 'zustand'
import { persist, withCompression } from 'zustand-persist-plus'

interface DataStore {
  documents: Document[]
  setDocuments: (docs: Document[]) => void
}

const useDataStore = create<DataStore>()(
  persist(
    withCompression({ minSize: 1024 })(
      (set) => ({
        documents: [],
        setDocuments: (docs) => set({ documents: docs })
      })
    ),
    { name: 'data-store' }
  )
)
```

### Migrations

Evolve your store schema without breaking user data:

```typescript
import { create } from 'zustand'
import { persist, withMigrations } from 'zustand-persist-plus'

interface StoreV2 {
  user: { name: string; email: string }
  settings: { theme: 'light' | 'dark' }
}

const migrations = {
  // Migrate from v1 to v2
  2: (state: any) => ({
    ...state,
    _version: 2,
    settings: {
      ...state.settings,
      theme: state.settings.theme ?? 'light'
    }
  })
}

const useStore = create<StoreV2>()(
  persist(
    (set) => ({ user: null as any, settings: { theme: 'light' as const } }),
    {
      name: 'app-store',
      migrate: withMigrations({ version: 2, migrations })
    }
  )
)
```

### Cloud Sync

Real-time sync across devices with Supabase:

```typescript
import { create } from 'zustand'
import { persist, withCloudSync } from 'zustand-persist-plus'
import { createSupabaseAdapter } from 'zustand-persist-plus/cloud'

const useStore = create()(
  persist(
    withCloudSync(
      createSupabaseAdapter(supabase, 'todos', {
        userId: user.id,
        conflictStrategy: 'last-write-wins'
      })
    )(
      (set) => ({
        todos: [],
        addTodo: (todo) => set((state) => ({ todos: [...state.todos, todo] }))
      })
    ),
    { name: 'todos' }
  )
)
```

## API Reference

### Middleware

| Function | Description |
|----------|-------------|
| `withEncryption(secret, options?)` | Encrypt persisted data |
| `withCompression(options?)` | Compress persisted data |
| `withMigrations(config)` | Version-based schema migrations |
| `withCloudSync(adapter, options?)` | Real-time cloud sync |

### Storage Adapters

```typescript
// Built-in adapters
import { createIndexedDBAdapter } from 'zustand-persist-plus'
import { createSupabaseAdapter } from 'zustand-persist-plus/cloud'
import { createFirebaseAdapter } from 'zustand-persist-plus/cloud'
```

### Utility Functions

```typescript
import { encrypt, decrypt, compress, decompress } from 'zustand-persist-plus'
```

## Documentation

- [Full Documentation](./docs/)
- [Cloud Sync Guide](./docs/CLOUD_SYNC_GUIDE.md)
- [Migration Examples](./docs/MIGRATIONS.md)
- [API Reference](./docs/API.md)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md).

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for developers who care about user data** 🔒

</div>

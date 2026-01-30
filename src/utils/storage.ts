/**
 * Utility functions for storage adapters
 */

/**
 * Convert any object to a storage adapter
 */
export function createStorageAdapter<T = unknown>(
  getItem: (key: string) => T | null,
  setItem: (key: string, value: T) => void,
  removeItem: (key: string) => void
): { getItem: (key: string) => T | null; setItem: (key: string, value: T) => void; removeItem: (key: string) => void } {
  return { getItem, setItem, removeItem }
}

/**
 * Wrap storage for async operations
 */
export function createAsyncStorageAdapter<T = unknown>(
  storage: {
    getItem: (key: string) => T | null | Promise<T | null>
    setItem: (key: string, value: T) => void | Promise<void>
    removeItem: (key: string) => void | Promise<void>
  }
) {
  return {
    getItem: async (key: string) => {
      const result = storage.getItem(key)
      return result instanceof Promise ? await result : result
    },
    setItem: async (key: string, value: T) => {
      const result = storage.setItem(key, value)
      if (result instanceof Promise) await result
    },
    removeItem: async (key: string) => {
      const result = storage.removeItem(key)
      if (result instanceof Promise) await result
    }
  }
}

/**
 * IndexedDB storage adapter using idb-keyval
 */
export function createIndexedDBAdapter(
  dbName: string = 'zustand-persist-plus',
  storeName: string = 'state'
): {
  getItem: <T = unknown>(key: string) => Promise<T | null>
  setItem: <T = unknown>(key: string, value: T) => Promise<void>
  removeItem: (key: string) => Promise<void>
} {
  return {
    getItem: async (key: string) => {
      if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB is not available')
      }
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction(storeName, 'readonly')
          const objectStore = transaction.objectStore(storeName)
          const itemRequest = objectStore.get(key)
          itemRequest.onerror = () => reject(itemRequest.error)
          itemRequest.onsuccess = () => resolve(itemRequest.result || null)
        }
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName)
          }
        }
      })
    },
    setItem: async (key: string, value: unknown) => {
      if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB is not available')
      }
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction(storeName, 'readwrite')
          const objectStore = transaction.objectStore(storeName)
          const itemRequest = objectStore.put(value, key)
          itemRequest.onerror = () => reject(itemRequest.error)
          itemRequest.onsuccess = () => resolve()
        }
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName)
          }
        }
      })
    },
    removeItem: async (key: string) => {
      if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB is not available')
      }
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction(storeName, 'readwrite')
          const objectStore = transaction.objectStore(storeName)
          const itemRequest = objectStore.delete(key)
          itemRequest.onerror = () => reject(itemRequest.error)
          itemRequest.onsuccess = () => resolve()
        }
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName)
          }
        }
      })
    }
  }
}

/**
 * Check if storage is available
 */
export function checkStorageAvailability(
  storage: 'localStorage' | 'sessionStorage'
): boolean {
  try {
    if (typeof window === 'undefined') return false
    const testKey = '__storage_test__'
    window[storage].setItem(testKey, testKey)
    window[storage].removeItem(testKey)
    return true
  } catch {
    return false
  }
}

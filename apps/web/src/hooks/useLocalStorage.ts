import { useCallback, useMemo, useSyncExternalStore } from 'react'

const updates = new EventTarget()
const sessionValues = new Map<string, string | null>()
const getServerSnapshot = () => null

function getSnapshot(key: string): string | null {
  if (typeof window === 'undefined') return null
  if (sessionValues.has(key)) return sessionValues.get(key) ?? null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function decode<T>(value: string | null, initialValue: T): T {
  if (value === null) return initialValue
  try {
    return JSON.parse(value) as T
  } catch {
    return initialValue
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const subscribe = useCallback((listener: () => void) => {
    function onStorage(event: StorageEvent) {
      if (event.key === key || event.key === null) listener()
    }
    window.addEventListener('storage', onStorage)
    updates.addEventListener(key, listener)
    return () => {
      window.removeEventListener('storage', onStorage)
      updates.removeEventListener(key, listener)
    }
  }, [key])
  const snapshot = useSyncExternalStore(subscribe, () => getSnapshot(key), getServerSnapshot)
  const value = useMemo(() => decode(snapshot, initialValue), [snapshot, initialValue])

  const write = useCallback((next: string | null) => {
    try {
      if (next === null) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, next)
      sessionValues.delete(key)
    } catch {
      sessionValues.set(key, next)
    }
    updates.dispatchEvent(new Event(key))
  }, [key])

  function setValue(next: T | ((prev: T) => T)) {
    const updated = typeof next === 'function'
      ? (next as (prev: T) => T)(decode(getSnapshot(key), initialValue))
      : next
    write(JSON.stringify(updated))
  }

  return [value, setValue, () => write(null)]
}

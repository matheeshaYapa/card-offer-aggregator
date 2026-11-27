import { createContext, useContext, type ReactNode } from 'react'
import type { PublicSnapshot } from './snapshotData'

export { SNAPSHOT_META_NAME, slimForSnapshot, type PublicSnapshot } from './snapshotData'

const SnapshotContext = createContext<PublicSnapshot | null>(null)

export function PublicSnapshotProvider({ snapshot, children }: { snapshot: PublicSnapshot | null; children: ReactNode }) {
  return <SnapshotContext.Provider value={snapshot}>{children}</SnapshotContext.Provider>
}

export function usePublicSnapshot(): PublicSnapshot | null {
  return useContext(SnapshotContext)
}


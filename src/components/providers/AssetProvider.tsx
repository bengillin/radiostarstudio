'use client'

import { useEffect, useState } from 'react'
import { useProjectStore } from '@/store/project-store'
import { migrateFromSingleProject, ensureProjectExists } from '@/lib/project-manager'

interface AssetProviderProps {
  children: React.ReactNode
}

/**
 * Provider that handles project migration and rehydrates cached assets from IndexedDB on mount.
 * Wrap your app with this to ensure frames and videos persist across refreshes.
 */
export function AssetProvider({ children }: AssetProviderProps) {
  const rehydrateAssets = useProjectStore((state) => state.rehydrateAssets)
  const assetsLoaded = useProjectStore((state) => state.assetsLoaded)
  const [migrated, setMigrated] = useState(false)

  // One-time migration from single-project to multi-project format
  useEffect(() => {
    migrateFromSingleProject().then(() => {
      ensureProjectExists()
      setMigrated(true)
    })
  }, [])

  // Rehydrate assets after migration is complete
  useEffect(() => {
    if (migrated && !assetsLoaded) {
      rehydrateAssets()
    }
  }, [migrated, assetsLoaded, rehydrateAssets])

  return <>{children}</>
}

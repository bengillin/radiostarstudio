'use client'

import { useEffect } from 'react'
import { useProjectStore } from '@/store/project-store'

interface AssetProviderProps {
  children: React.ReactNode
}

/**
 * Provider that rehydrates cached assets from IndexedDB on mount.
 * Wrap your app with this to ensure frames and videos persist across refreshes.
 */
export function AssetProvider({ children }: AssetProviderProps) {
  const rehydrateAssets = useProjectStore((state) => state.rehydrateAssets)
  const assetsLoaded = useProjectStore((state) => state.assetsLoaded)

  useEffect(() => {
    if (!assetsLoaded) {
      rehydrateAssets()
    }
  }, [assetsLoaded, rehydrateAssets])

  return <>{children}</>
}

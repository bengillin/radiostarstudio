'use client'

import { useState, useEffect } from 'react'
import { useProjectStore } from '@/store/project-store'
import { HardDrive, Trash2 } from 'lucide-react'

/**
 * Displays current asset cache usage and provides option to clear cache.
 */
export function StorageIndicator() {
  const getStorageStats = useProjectStore((state) => state.getStorageStats)
  const clearAssetCache = useProjectStore((state) => state.clearAssetCache)
  const assetsLoaded = useProjectStore((state) => state.assetsLoaded)

  const [stats, setStats] = useState<{
    frameCount: number
    videoCount: number
    estimatedSize: string
  } | null>(null)
  const [isClearing, setIsClearing] = useState(false)

  useEffect(() => {
    if (assetsLoaded) {
      loadStats()
    }
  }, [assetsLoaded])

  const loadStats = async () => {
    try {
      const newStats = await getStorageStats()
      setStats(newStats)
    } catch (err) {
      console.error('Failed to load storage stats:', err)
    }
  }

  const handleClear = async () => {
    if (!confirm('Clear all cached frames and videos? This cannot be undone.')) {
      return
    }

    setIsClearing(true)
    try {
      await clearAssetCache()
      await loadStats()
    } catch (err) {
      console.error('Failed to clear cache:', err)
    } finally {
      setIsClearing(false)
    }
  }

  if (!stats) {
    return null
  }

  const hasAssets = stats.frameCount > 0 || stats.videoCount > 0

  return (
    <div className="flex items-center gap-3 text-sm text-zinc-400">
      <div className="flex items-center gap-1.5">
        <HardDrive className="h-4 w-4" />
        <span>
          {stats.frameCount} frames, {stats.videoCount} videos
          {hasAssets && <span className="text-zinc-500"> ({stats.estimatedSize})</span>}
        </span>
      </div>

      {hasAssets && (
        <button
          onClick={handleClear}
          disabled={isClearing}
          className="flex items-center gap-1 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
          title="Clear cached assets"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>{isClearing ? 'Clearing...' : 'Clear'}</span>
        </button>
      )}
    </div>
  )
}

'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Trash2, HardDrive } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { MediaLibraryFilters } from './MediaLibraryFilters'
import { MediaLibraryGrid } from './MediaLibraryGrid'
import { MediaLibraryPreview } from './MediaLibraryPreview'
import { ConfirmDialog } from '../ConfirmDialog'
import type { LibraryFilter, LibraryAsset, AssetType, Frame, GeneratedVideo } from '@/types'
import * as assetCache from '@/lib/asset-cache'

/** Inline panel variant of the Media Library, for use in the right sidebar */
export function MediaLibraryPanel() {
  const {
    frames,
    videos,
    audioFile,
    clips,
    deleteFrame,
    deleteVideo,
    clearAssetCache,
  } = useProjectStore()

  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [previewAsset, setPreviewAsset] = useState<LibraryAsset | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [storageStats, setStorageStats] = useState<{ frameCount: number; videoCount: number; estimatedSize: string } | null>(null)

  // Load storage stats
  useEffect(() => {
    assetCache.getStorageStats().then(setStorageStats)
  }, [frames, videos])

  // Expand all groups by default when assets change
  useEffect(() => {
    const groupIds = new Set<string>()
    Object.values(frames).forEach((f: Frame) => {
      if (f.clipId) groupIds.add(f.clipId)
    })
    Object.values(videos).forEach((v: GeneratedVideo) => {
      if (v.clipId) groupIds.add(v.clipId)
    })
    groupIds.add('__orphans__')
    setExpandedGroups(groupIds)
  }, [frames, videos])

  // Build unified asset list
  const allAssets = useMemo(() => {
    const assets: LibraryAsset[] = []

    Object.values(frames).forEach((frame: Frame) => {
      const clip = clips.find((c) => c.id === frame.clipId)
      assets.push({
        id: frame.id,
        type: 'frame',
        name: clip ? `${clip.title} - ${frame.type} frame` : `${frame.type} frame`,
        url: frame.url,
        clipId: frame.clipId,
        clipTitle: clip?.title,
        createdAt: frame.generatedAt || new Date(),
        metadata: {
          frameType: frame.type,
          source: frame.source,
          prompt: frame.prompt,
          model: frame.model,
        },
      })
    })

    Object.values(videos).forEach((video: GeneratedVideo) => {
      const clip = clips.find((c) => c.id === video.clipId)
      assets.push({
        id: video.id,
        type: 'video',
        name: clip ? `${clip.title} - video` : 'Generated video',
        url: video.url,
        clipId: video.clipId,
        clipTitle: clip?.title,
        createdAt: video.generatedAt || new Date(),
        metadata: {
          duration: video.duration,
          status: video.status,
          motionPrompt: video.motionPrompt,
          model: video.model,
        },
      })
    })

    if (audioFile) {
      assets.push({
        id: audioFile.id,
        type: 'audio',
        name: audioFile.name,
        url: audioFile.url,
        createdAt: new Date(),
        metadata: {
          audioDuration: audioFile.duration,
        },
      })
    }

    return assets
  }, [frames, videos, audioFile, clips])

  const filteredAssets = useMemo(() => {
    if (filter === 'all') return allAssets
    const typeMap: Record<LibraryFilter, AssetType | null> = {
      all: null,
      frames: 'frame',
      videos: 'video',
      audio: 'audio',
      references: 'reference',
    }
    const targetType = typeMap[filter]
    return allAssets.filter((a) => a.type === targetType)
  }, [allAssets, filter])

  const counts = useMemo(() => ({
    all: allAssets.length,
    frames: allAssets.filter((a) => a.type === 'frame').length,
    videos: allAssets.filter((a) => a.type === 'video').length,
    audio: allAssets.filter((a) => a.type === 'audio').length,
    references: allAssets.filter((a) => a.type === 'reference').length,
  }), [allAssets])

  const handleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (multi) {
        next.has(id) ? next.delete(id) : next.add(id)
      } else {
        if (next.has(id) && next.size === 1) {
          next.clear()
        } else {
          next.clear()
          next.add(id)
        }
      }
      return next
    })
  }, [])

  const handleToggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }, [])

  const handleDeleteSelected = useCallback(async () => {
    for (const id of selectedIds) {
      const asset = allAssets.find((a) => a.id === id)
      if (!asset) continue
      if (asset.type === 'frame') deleteFrame(id)
      else if (asset.type === 'video') deleteVideo(id)
    }
    setSelectedIds(new Set())
    setShowDeleteConfirm(false)
    assetCache.getStorageStats().then(setStorageStats)
  }, [selectedIds, allAssets, deleteFrame, deleteVideo])

  const handleDeleteFromPreview = useCallback(async () => {
    if (!previewAsset) return
    if (previewAsset.type === 'frame') deleteFrame(previewAsset.id)
    else if (previewAsset.type === 'video') deleteVideo(previewAsset.id)
    setPreviewAsset(null)
    assetCache.getStorageStats().then(setStorageStats)
  }, [previewAsset, deleteFrame, deleteVideo])

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Filters */}
        <div className="px-3 py-2 border-b border-white/10 bg-white/5">
          <MediaLibraryFilters
            activeFilter={filter}
            onFilterChange={setFilter}
            counts={counts}
          />
        </div>

        {/* Grid */}
        <MediaLibraryGrid
          assets={filteredAssets}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onPreview={setPreviewAsset}
          expandedGroups={expandedGroups}
          onToggleGroup={handleToggleGroup}
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/10">
          <div className="flex items-center gap-2 text-[10px] text-white/40">
            {selectedIds.size > 0 ? (
              <span>{selectedIds.size} selected</span>
            ) : (
              <span>{filteredAssets.length} assets</span>
            )}
            {storageStats && (storageStats.frameCount > 0 || storageStats.videoCount > 0) && (
              <>
                <span className="text-white/20">|</span>
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  <span>{storageStats.estimatedSize}</span>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('Clear all cached assets?')) return
                    setIsClearing(true)
                    try {
                      await clearAssetCache()
                      assetCache.getStorageStats().then(setStorageStats)
                    } finally {
                      setIsClearing(false)
                    }
                  }}
                  disabled={isClearing}
                  className="flex items-center gap-0.5 text-white/30 hover:text-red-400 transition-colors disabled:opacity-50"
                  title="Clear cached assets"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>{isClearing ? '...' : 'Clear'}</span>
                </button>
              </>
            )}
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-2 py-1 text-[10px] font-medium text-red-400 hover:text-white hover:bg-red-500/20 rounded transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          )}
        </div>
      </div>

      {previewAsset && (
        <MediaLibraryPreview
          asset={previewAsset}
          onClose={() => setPreviewAsset(null)}
          onDelete={handleDeleteFromPreview}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteSelected}
        title="Delete Assets"
        message={`Are you sure you want to delete ${selectedIds.size} asset${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  )
}

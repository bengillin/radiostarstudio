'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { X, Trash2, HardDrive } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { MediaLibraryFilters } from './MediaLibraryFilters'
import { MediaLibraryGrid } from './MediaLibraryGrid'
import { MediaLibraryPreview } from './MediaLibraryPreview'
import { ConfirmDialog } from '../ConfirmDialog'
import type { LibraryFilter, LibraryAsset, AssetType, Frame, GeneratedVideo } from '@/types'
import * as assetCache from '@/lib/asset-cache'

interface MediaLibraryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function MediaLibraryModal({ isOpen, onClose }: MediaLibraryModalProps) {
  const {
    frames,
    videos,
    audioFile,
    clips,
    deleteFrame,
    deleteVideo,
  } = useProjectStore()

  // State
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [previewAsset, setPreviewAsset] = useState<LibraryAsset | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [storageStats, setStorageStats] = useState<{ estimatedSize: string } | null>(null)

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !previewAsset && !showDeleteConfirm) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, previewAsset, showDeleteConfirm])

  // Load storage stats
  useEffect(() => {
    if (isOpen) {
      assetCache.getStorageStats().then(setStorageStats)
    }
  }, [isOpen, frames, videos])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set())
      setPreviewAsset(null)
      // Expand all groups by default
      const groupIds = new Set<string>()
      Object.values(frames).forEach((f: Frame) => {
        if (f.clipId) groupIds.add(f.clipId)
      })
      Object.values(videos).forEach((v: GeneratedVideo) => {
        if (v.clipId) groupIds.add(v.clipId)
      })
      groupIds.add('__orphans__')
      setExpandedGroups(groupIds)
    }
  }, [isOpen, frames, videos])

  // Build unified asset list
  const allAssets = useMemo(() => {
    const assets: LibraryAsset[] = []

    // Frames
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

    // Videos
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

    // Audio
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

  // Filter assets
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

  // Count by type
  const counts = useMemo(() => ({
    all: allAssets.length,
    frames: allAssets.filter((a) => a.type === 'frame').length,
    videos: allAssets.filter((a) => a.type === 'video').length,
    audio: allAssets.filter((a) => a.type === 'audio').length,
    references: allAssets.filter((a) => a.type === 'reference').length,
  }), [allAssets])

  // Selection handlers
  const handleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (multi) {
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
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
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  // Delete handlers
  const handleDeleteSelected = useCallback(async () => {
    for (const id of selectedIds) {
      const asset = allAssets.find((a) => a.id === id)
      if (!asset) continue

      if (asset.type === 'frame') {
        deleteFrame(id)
      } else if (asset.type === 'video') {
        deleteVideo(id)
      }
      // Note: audio deletion would need to be added to store
    }
    setSelectedIds(new Set())
    setShowDeleteConfirm(false)
    // Refresh storage stats
    assetCache.getStorageStats().then(setStorageStats)
  }, [selectedIds, allAssets, deleteFrame, deleteVideo])

  const handleDeleteFromPreview = useCallback(async () => {
    if (!previewAsset) return

    if (previewAsset.type === 'frame') {
      deleteFrame(previewAsset.id)
    } else if (previewAsset.type === 'video') {
      deleteVideo(previewAsset.id)
    }
    setPreviewAsset(null)
    // Refresh storage stats
    assetCache.getStorageStats().then(setStorageStats)
  }, [previewAsset, deleteFrame, deleteVideo])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-neutral-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-4xl mx-4 h-[80vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Media Library</h2>
            <div className="flex items-center gap-4">
              {storageStats && (
                <div className="flex items-center gap-2 text-sm text-white/40">
                  <HardDrive className="w-4 h-4" />
                  <span>{storageStats.estimatedSize}</span>
                </div>
              )}
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="px-4 py-3 border-b border-white/10 bg-white/5">
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
          <div className="flex items-center justify-between p-4 border-t border-white/10">
            <div className="text-sm text-white/40">
              {selectedIds.size > 0 ? (
                <span>{selectedIds.size} selected</span>
              ) : (
                <span>{filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview overlay */}
      {previewAsset && (
        <MediaLibraryPreview
          asset={previewAsset}
          onClose={() => setPreviewAsset(null)}
          onDelete={handleDeleteFromPreview}
        />
      )}

      {/* Delete confirmation */}
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

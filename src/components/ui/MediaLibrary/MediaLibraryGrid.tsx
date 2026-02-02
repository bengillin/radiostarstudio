'use client'

import { useMemo } from 'react'
import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import { AssetCard } from './AssetCard'
import type { LibraryAsset } from '@/types'

interface MediaLibraryGridProps {
  assets: LibraryAsset[]
  selectedIds: Set<string>
  onSelect: (id: string, multi: boolean) => void
  onPreview: (asset: LibraryAsset) => void
  expandedGroups: Set<string>
  onToggleGroup: (groupId: string) => void
}

interface AssetGroup {
  id: string
  title: string
  assets: LibraryAsset[]
}

export function MediaLibraryGrid({
  assets,
  selectedIds,
  onSelect,
  onPreview,
  expandedGroups,
  onToggleGroup,
}: MediaLibraryGridProps) {
  // Group assets by clip
  const groups = useMemo(() => {
    const clipGroups: Record<string, LibraryAsset[]> = {}
    const orphans: LibraryAsset[] = []

    for (const asset of assets) {
      if (asset.clipId && asset.clipTitle) {
        if (!clipGroups[asset.clipId]) {
          clipGroups[asset.clipId] = []
        }
        clipGroups[asset.clipId].push(asset)
      } else {
        orphans.push(asset)
      }
    }

    const result: AssetGroup[] = []

    // Add clip groups
    for (const [clipId, clipAssets] of Object.entries(clipGroups)) {
      result.push({
        id: clipId,
        title: clipAssets[0].clipTitle || 'Unknown Clip',
        assets: clipAssets.sort((a, b) => {
          // Sort: start frames, end frames, videos
          const order = { frame: 0, video: 1, audio: 2, reference: 3 }
          const aOrder = order[a.type] + (a.metadata.frameType === 'end' ? 0.5 : 0)
          const bOrder = order[b.type] + (b.metadata.frameType === 'end' ? 0.5 : 0)
          return aOrder - bOrder
        }),
      })
    }

    // Sort groups by clip title
    result.sort((a, b) => a.title.localeCompare(b.title))

    // Add orphans at the end
    if (orphans.length > 0) {
      result.push({
        id: '__orphans__',
        title: 'Unassigned Assets',
        assets: orphans.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      })
    }

    return result
  }, [assets])

  if (assets.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white/40 py-12">
        <FolderOpen className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No assets found</p>
        <p className="text-xs mt-1">Generate frames and videos to see them here</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.id)
        const selectedInGroup = group.assets.filter((a) => selectedIds.has(a.id)).length

        return (
          <div
            key={group.id}
            className="border border-white/10 rounded-lg overflow-hidden"
          >
            {/* Group header */}
            <button
              onClick={() => onToggleGroup(group.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-white/40" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-white/40" />
                )}
                <span className="font-medium text-sm text-white truncate max-w-[300px]">
                  {group.title}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/40">
                {selectedInGroup > 0 && (
                  <span className="text-brand-400">{selectedInGroup} selected</span>
                )}
                <span>{group.assets.length} asset{group.assets.length !== 1 ? 's' : ''}</span>
              </div>
            </button>

            {/* Group content */}
            {isExpanded && (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {group.assets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedIds.has(asset.id)}
                    onSelect={(multi) => onSelect(asset.id, multi)}
                    onPreview={() => onPreview(asset)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

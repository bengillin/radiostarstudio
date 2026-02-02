'use client'

import { Image, Video, Music, ImageIcon, Check, Eye } from 'lucide-react'
import type { LibraryAsset } from '@/types'

interface AssetCardProps {
  asset: LibraryAsset
  isSelected: boolean
  onSelect: (multi: boolean) => void
  onPreview: () => void
}

const typeIcons = {
  frame: Image,
  video: Video,
  audio: Music,
  reference: ImageIcon,
}

const typeLabels = {
  frame: 'Frame',
  video: 'Video',
  audio: 'Audio',
  reference: 'Reference',
}

export function AssetCard({ asset, isSelected, onSelect, onPreview }: AssetCardProps) {
  const TypeIcon = typeIcons[asset.type]

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const multi = e.metaKey || e.ctrlKey || e.shiftKey
    onSelect(multi)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onPreview()
  }

  // Format created date
  const formatDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <button
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`
        group relative flex flex-col rounded-lg overflow-hidden border-2 transition-all
        ${isSelected
          ? 'border-brand-500 bg-brand-500/10'
          : 'border-white/10 bg-white/5 hover:border-white/30 hover:scale-[1.02]'
        }
      `}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative bg-black/50">
        {asset.type === 'audio' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Music className="w-8 h-8 text-white/40" />
          </div>
        ) : (
          <img
            src={asset.url}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        )}

        {/* Hover overlay with preview icon */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Eye className="w-6 h-6 text-white" />
        </div>

        {/* Selection checkmark */}
        {isSelected && (
          <div className="absolute top-1 left-1 w-5 h-5 bg-brand-500 rounded flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Type badge */}
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white/70 flex items-center gap-1">
          <TypeIcon className="w-3 h-3" />
          {asset.metadata.frameType && (
            <span className="capitalize">{asset.metadata.frameType}</span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2 text-left">
        <p className="text-xs text-white truncate" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-[10px] text-white/40 mt-0.5">
          {typeLabels[asset.type]} • {formatDate(asset.createdAt)}
        </p>
      </div>
    </button>
  )
}

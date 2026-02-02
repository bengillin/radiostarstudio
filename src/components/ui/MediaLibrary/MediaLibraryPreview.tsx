'use client'

import { X, Trash2, Image, Video, Music, ImageIcon, Calendar, Cpu, FileText } from 'lucide-react'
import type { LibraryAsset } from '@/types'

interface MediaLibraryPreviewProps {
  asset: LibraryAsset | null
  onClose: () => void
  onDelete: () => void
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
  reference: 'Reference Image',
}

export function MediaLibraryPreview({ asset, onClose, onDelete }: MediaLibraryPreviewProps) {
  if (!asset) return null

  const TypeIcon = typeIcons[asset.type]

  const formatDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Preview panel */}
      <div className="relative bg-neutral-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <TypeIcon className="w-5 h-5 text-brand-500" />
            <h2 className="text-lg font-semibold text-white truncate max-w-md">
              {asset.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Media preview */}
          <div className="aspect-video rounded-lg overflow-hidden bg-black/50 mb-4">
            {asset.type === 'audio' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <Music className="w-16 h-16 text-white/40" />
                <audio src={asset.url} controls className="w-3/4" />
              </div>
            ) : asset.type === 'video' ? (
              <video
                src={asset.url}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                src={asset.url}
                alt={asset.name}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Type */}
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
                  <TypeIcon className="w-3 h-3" />
                  Type
                </div>
                <p className="text-sm text-white">
                  {typeLabels[asset.type]}
                  {asset.metadata.frameType && (
                    <span className="text-white/60"> ({asset.metadata.frameType})</span>
                  )}
                </p>
              </div>

              {/* Created */}
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
                  <Calendar className="w-3 h-3" />
                  Created
                </div>
                <p className="text-sm text-white">{formatDate(asset.createdAt)}</p>
              </div>
            </div>

            {/* Clip */}
            {asset.clipTitle && (
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-xs text-white/40 mb-1">Clip</div>
                <p className="text-sm text-white">{asset.clipTitle}</p>
              </div>
            )}

            {/* Model */}
            {asset.metadata.model && (
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
                  <Cpu className="w-3 h-3" />
                  Model
                </div>
                <p className="text-sm text-white font-mono">{asset.metadata.model}</p>
              </div>
            )}

            {/* Duration (for video/audio) */}
            {(asset.metadata.duration || asset.metadata.audioDuration) && (
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-xs text-white/40 mb-1">Duration</div>
                <p className="text-sm text-white">
                  {(asset.metadata.duration || asset.metadata.audioDuration || 0).toFixed(1)}s
                </p>
              </div>
            )}

            {/* Prompt */}
            {asset.metadata.prompt && (
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
                  <FileText className="w-3 h-3" />
                  Prompt
                </div>
                <p className="text-sm text-white/80 whitespace-pre-wrap">
                  {asset.metadata.prompt}
                </p>
              </div>
            )}

            {/* Motion prompt (for video) */}
            {asset.metadata.motionPrompt && (
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
                  <FileText className="w-3 h-3" />
                  Motion Prompt
                </div>
                <p className="text-sm text-white/80 whitespace-pre-wrap">
                  {asset.metadata.motionPrompt}
                </p>
              </div>
            )}

            {/* Tags (for references) */}
            {asset.metadata.tags && asset.metadata.tags.length > 0 && (
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-xs text-white/40 mb-2">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {asset.metadata.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-4 border-t border-white/10">
          <button
            onClick={onDelete}
            className="px-4 py-2 text-sm font-medium text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { Image as ImageIcon, Film } from 'lucide-react'
import { formatTime } from '@/lib/utils'
import type { Clip, Scene, Frame } from '@/types'

const SCENE_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500',
]

interface StoryboardViewProps {
  clips: Clip[]
  scenes: Scene[]
  frames: Record<string, Frame>
  selectedClipIds: string[]
  onSelectClip: (clipId: string) => void
}

export function StoryboardView({ clips, scenes, frames, selectedClipIds, onSelectClip }: StoryboardViewProps) {
  const sortedClips = useMemo(
    () => [...clips].sort((a, b) => a.startTime - b.startTime),
    [clips]
  )

  const sceneIndexMap = useMemo(() => {
    const map: Record<string, number> = {}
    scenes.forEach((s, i) => { map[s.id] = i })
    return map
  }, [scenes])

  const getStartFrame = (clipId: string): Frame | undefined => {
    // Check clip's active startFrame first, then search all frames
    const clip = clips.find(c => c.id === clipId)
    if (clip?.startFrame?.url) return clip.startFrame

    return Object.values(frames)
      .filter((f: Frame) => f.clipId === clipId && f.type === 'start')
      .sort((a: Frame, b: Frame) => {
        const dateA = a.generatedAt ? new Date(a.generatedAt).getTime() : 0
        const dateB = b.generatedAt ? new Date(b.generatedAt).getTime() : 0
        return dateB - dateA
      })[0]
  }

  if (sortedClips.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Film className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No clips yet</p>
          <p className="text-xs text-white/30 mt-1">Plan scenes to generate clips</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sortedClips.map((clip) => {
          const scene = scenes.find(s => s.id === clip.sceneId)
          const sceneIndex = sceneIndexMap[clip.sceneId] ?? 0
          const colorClass = SCENE_COLORS[sceneIndex % SCENE_COLORS.length]
          const frame = getStartFrame(clip.id)
          const isSelected = selectedClipIds.includes(clip.id)
          const duration = clip.endTime - clip.startTime

          return (
            <button
              key={clip.id}
              onClick={() => onSelectClip(clip.id)}
              className={`group rounded-lg overflow-hidden border transition-all text-left ${
                isSelected
                  ? 'border-brand-500 ring-2 ring-brand-500/30'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              {/* Scene color bar */}
              <div className={`h-1 ${colorClass}`} />

              {/* Frame thumbnail */}
              <div className="aspect-video bg-white/5 relative">
                {frame?.url ? (
                  <img
                    src={frame.url}
                    alt={clip.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-white/15" />
                  </div>
                )}
                {/* Duration badge */}
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white/70 tabular-nums">
                  {duration.toFixed(1)}s
                </span>
              </div>

              {/* Info */}
              <div className="p-2">
                <p className="text-xs font-medium text-white truncate">{clip.title}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-white/40 tabular-nums">
                    {formatTime(clip.startTime)}
                  </span>
                  {scene && (
                    <span className="text-[10px] text-white/30 truncate ml-1">
                      {scene.title}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

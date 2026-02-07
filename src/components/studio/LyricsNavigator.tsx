'use client'

import { useCallback } from 'react'
import { Plus, Music } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { getSegmentColor } from '@/lib/segment-colors'
import { formatTime } from '@/lib/utils'

interface LyricsNavigatorProps {
  onSeek: (time: number) => void
  currentTime: number
}

export function LyricsNavigator({ onSeek, currentTime }: LyricsNavigatorProps) {
  const transcript = useProjectStore((s) => s.transcript)
  const audioFile = useProjectStore((s) => s.audioFile)
  const addSegment = useProjectStore((s) => s.addSegment)

  const handleAddSection = useCallback(() => {
    const lastSegment = transcript[transcript.length - 1]
    const start = lastSegment ? lastSegment.end : 0
    const end = audioFile ? Math.min(start + 30, audioFile.duration) : start + 30

    addSegment({
      id: `segment-${Date.now()}`,
      text: '',
      words: [],
      start,
      end,
      type: 'verse',
    })
  }, [transcript, audioFile, addSegment])

  if (transcript.length === 0) {
    return (
      <div className="text-center py-8">
        <Music className="w-8 h-8 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/40 mb-1">No lyrics yet</p>
        <p className="text-xs text-white/30 mb-4">
          {audioFile ? 'Transcribe audio or write your own' : 'Add a song to get started'}
        </p>
        {audioFile && (
          <button
            onClick={handleAddSection}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-sm text-white/70 transition-colors"
          >
            Write Lyrics
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {transcript.map((segment) => {
        const colors = getSegmentColor(segment.type)
        const isActive = currentTime >= segment.start && currentTime < segment.end
        const firstLine = segment.text?.split('\n')[0] || ''

        return (
          <button
            key={segment.id}
            onClick={() => onSeek(segment.start)}
            className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-2 group ${
              isActive
                ? 'bg-white/[0.06]'
                : 'hover:bg-white/[0.03]'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
            <span className={`text-[10px] font-medium uppercase tracking-wide w-14 flex-shrink-0 ${
              isActive ? colors.text : 'text-white/30'
            }`}>
              {segment.type}
            </span>
            <span className={`text-xs truncate flex-1 ${
              isActive ? 'text-white/80' : 'text-white/40'
            }`}>
              {firstLine || 'Empty section'}
            </span>
            <span className="text-[10px] text-white/20 font-mono flex-shrink-0">
              {formatTime(segment.start)}
            </span>
          </button>
        )
      })}

      <button
        onClick={handleAddSection}
        className="w-full mt-2 p-2 border border-dashed border-white/15 hover:border-white/30 rounded-lg text-sm text-white/40 hover:text-white/60 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Section
      </button>
    </div>
  )
}

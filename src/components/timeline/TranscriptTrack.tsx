'use client'

import type { TranscriptSegment } from '@/types'

interface TranscriptTrackProps {
  segments: TranscriptSegment[]
  zoom: number // px per second
  labelWidth: number // width of track labels
  duration: number
  onSeek?: (time: number) => void
}

// Color mapping for segment types
const SEGMENT_COLORS: Record<string, string> = {
  verse: 'bg-blue-500/30 border-blue-500/50',
  chorus: 'bg-purple-500/30 border-purple-500/50',
  bridge: 'bg-orange-500/30 border-orange-500/50',
  intro: 'bg-teal-500/30 border-teal-500/50',
  outro: 'bg-pink-500/30 border-pink-500/50',
  pre_chorus: 'bg-indigo-500/30 border-indigo-500/50',
  hook: 'bg-yellow-500/30 border-yellow-500/50',
  instrumental: 'bg-green-500/30 border-green-500/50',
}

export function TranscriptTrack({
  segments,
  zoom,
  labelWidth,
  duration,
  onSeek,
}: TranscriptTrackProps) {
  const trackWidth = duration * zoom

  const handleSegmentClick = (e: React.MouseEvent, segment: TranscriptSegment) => {
    e.stopPropagation()
    onSeek?.(segment.start)
  }

  return (
    <div className="h-12 border-b border-white/10 relative">
      {/* Track label */}
      <div
        className="absolute left-0 top-0 h-full bg-black/50 flex items-center px-2 z-10 border-r border-white/10"
        style={{ width: labelWidth }}
      >
        <span className="text-[10px] text-white/40 uppercase">Lyrics</span>
      </div>

      {/* Segments content */}
      <div
        className="h-full relative"
        style={{ marginLeft: labelWidth }}
      >
        {segments.map((segment) => {
          const segmentType = segment.type?.toLowerCase() || 'default'
          const colorClass = SEGMENT_COLORS[segmentType] || 'bg-white/10 border-white/20'
          const width = (segment.end - segment.start) * zoom
          const left = segment.start * zoom

          return (
            <div
              key={segment.id}
              className={`absolute top-1 bottom-1 rounded border ${colorClass} flex items-center px-2 overflow-hidden cursor-pointer hover:brightness-110 transition-all`}
              style={{
                left,
                width: Math.max(width, 20),
              }}
              onClick={(e) => handleSegmentClick(e, segment)}
              title={`${segment.type || 'Segment'}: ${segment.text}`}
            >
              <span className="text-[10px] text-white/80 truncate">
                {segment.text}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

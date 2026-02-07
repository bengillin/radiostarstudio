'use client'

import type { TranscriptSegment } from '@/types'
import { getSegmentColor } from '@/lib/segment-colors'

interface TranscriptTrackProps {
  segments: TranscriptSegment[]
  zoom: number // px per second
  labelWidth: number // width of track labels
  duration: number
  onSeek?: (time: number) => void
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
        style={{ marginLeft: labelWidth, width: trackWidth }}
      >
        {segments.map((segment) => {
          const colors = getSegmentColor(segment.type || '')
          const colorClass = `${colors.bg} ${colors.border}`
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

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { TranscriptSegment } from '@/types'
import { getSegmentColor } from '@/lib/segment-colors'

const MIN_SEGMENT_DURATION = 0.5 // seconds
const EDGE_THRESHOLD = 8 // pixels from edge to trigger trim

interface TranscriptTrackProps {
  segments: TranscriptSegment[]
  zoom: number // px per second
  labelWidth: number // width of track labels
  duration: number
  onSeek?: (time: number) => void
  onUpdateSegment?: (id: string, updates: Partial<TranscriptSegment>) => void
  findSnapPoint?: (time: number, excludeId?: string) => number | null
}

interface TrimState {
  segmentId: string
  edge: 'start' | 'end'
  initialTime: number
  initialMouseX: number
}

interface DragState {
  segmentId: string
  initialStart: number
  initialEnd: number
  initialMouseX: number
}

export function TranscriptTrack({
  segments,
  zoom,
  labelWidth,
  duration,
  onSeek,
  onUpdateSegment,
  findSnapPoint,
}: TranscriptTrackProps) {
  const trackWidth = duration * zoom
  const [hoveredEdge, setHoveredEdge] = useState<{ segmentId: string; edge: 'start' | 'end' } | null>(null)
  const [trimState, setTrimState] = useState<TrimState | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Get adjacent segments for overlap prevention
  const getSortedSegments = useCallback(() => {
    return [...segments].sort((a, b) => a.start - b.start)
  }, [segments])

  // Detect which edge the cursor is near
  const detectEdge = useCallback((segmentEl: HTMLElement, mouseX: number): 'start' | 'end' | null => {
    const rect = segmentEl.getBoundingClientRect()
    if (mouseX - rect.left < EDGE_THRESHOLD) return 'start'
    if (rect.right - mouseX < EDGE_THRESHOLD) return 'end'
    return null
  }, [])

  // Handle mouse move over segments for edge detection
  const handleSegmentMouseMove = useCallback((e: React.MouseEvent, segmentId: string) => {
    if (trimState || dragState) return
    const edge = detectEdge(e.currentTarget as HTMLElement, e.clientX)
    if (edge) {
      setHoveredEdge({ segmentId, edge })
    } else {
      setHoveredEdge(null)
    }
  }, [detectEdge, trimState, dragState])

  const handleSegmentMouseLeave = useCallback(() => {
    if (!trimState && !dragState) {
      setHoveredEdge(null)
    }
  }, [trimState, dragState])

  // Start trim
  const handleMouseDown = useCallback((e: React.MouseEvent, segment: TranscriptSegment) => {
    if (!onUpdateSegment) {
      // No update handler — just seek
      e.stopPropagation()
      onSeek?.(segment.start)
      return
    }

    e.stopPropagation()
    const edge = detectEdge(e.currentTarget as HTMLElement, e.clientX)

    if (edge) {
      // Start trimming
      setTrimState({
        segmentId: segment.id,
        edge,
        initialTime: edge === 'start' ? segment.start : segment.end,
        initialMouseX: e.clientX,
      })
    } else {
      // Start dragging (whole segment move)
      setDragState({
        segmentId: segment.id,
        initialStart: segment.start,
        initialEnd: segment.end,
        initialMouseX: e.clientX,
      })
    }
  }, [onUpdateSegment, onSeek, detectEdge])

  // Trim move
  const handleTrimMove = useCallback((e: MouseEvent) => {
    if (!trimState || !onUpdateSegment) return
    const deltaX = e.clientX - trimState.initialMouseX
    const deltaTime = deltaX / zoom
    let newTime = Math.max(0, trimState.initialTime + deltaTime)

    // Snap
    if (findSnapPoint) {
      const snapped = findSnapPoint(newTime, trimState.segmentId)
      if (snapped !== null) newTime = snapped
    }

    const sorted = getSortedSegments()
    const idx = sorted.findIndex((s) => s.id === trimState.segmentId)
    const segment = sorted[idx]
    if (!segment) return

    if (trimState.edge === 'start') {
      // Don't go past previous segment's end
      const prev = idx > 0 ? sorted[idx - 1] : null
      const minStart = prev ? prev.end : 0
      newTime = Math.max(minStart, newTime)
      // Ensure minimum duration
      newTime = Math.min(newTime, segment.end - MIN_SEGMENT_DURATION)
      onUpdateSegment(trimState.segmentId, { start: newTime })
    } else {
      // Don't go past next segment's start
      const next = idx < sorted.length - 1 ? sorted[idx + 1] : null
      const maxEnd = next ? next.start : duration
      newTime = Math.min(maxEnd, newTime)
      // Ensure minimum duration
      newTime = Math.max(newTime, segment.start + MIN_SEGMENT_DURATION)
      onUpdateSegment(trimState.segmentId, { end: Math.min(newTime, duration) })
    }
  }, [trimState, zoom, duration, onUpdateSegment, findSnapPoint, getSortedSegments])

  const handleTrimEnd = useCallback(() => {
    setTrimState(null)
  }, [])

  // Drag move (whole segment)
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragState || !onUpdateSegment) return
    const deltaX = e.clientX - dragState.initialMouseX
    const deltaTime = deltaX / zoom
    const segDuration = dragState.initialEnd - dragState.initialStart

    let newStart = Math.max(0, dragState.initialStart + deltaTime)

    // Snap start edge
    if (findSnapPoint) {
      const snapped = findSnapPoint(newStart, dragState.segmentId)
      if (snapped !== null) {
        newStart = snapped
      } else {
        // Try snap end edge
        const snappedEnd = findSnapPoint(newStart + segDuration, dragState.segmentId)
        if (snappedEnd !== null) {
          newStart = snappedEnd - segDuration
        }
      }
    }

    // Don't exceed duration
    if (newStart + segDuration > duration) {
      newStart = duration - segDuration
    }

    // Prevent overlap with adjacent segments
    const sorted = getSortedSegments()
    const idx = sorted.findIndex((s) => s.id === dragState.segmentId)
    const prev = idx > 0 ? sorted[idx - 1] : null
    const next = idx < sorted.length - 1 ? sorted[idx + 1] : null

    if (prev && newStart < prev.end) newStart = prev.end
    if (next && newStart + segDuration > next.start) newStart = next.start - segDuration

    const newEnd = newStart + segDuration
    onUpdateSegment(dragState.segmentId, { start: newStart, end: newEnd })
  }, [dragState, zoom, duration, onUpdateSegment, findSnapPoint, getSortedSegments])

  const handleDragEnd = useCallback(() => {
    setDragState(null)
  }, [])

  // Global mouse listeners for trim/drag
  useEffect(() => {
    if (trimState) {
      window.addEventListener('mousemove', handleTrimMove)
      window.addEventListener('mouseup', handleTrimEnd)
      return () => {
        window.removeEventListener('mousemove', handleTrimMove)
        window.removeEventListener('mouseup', handleTrimEnd)
      }
    }
  }, [trimState, handleTrimMove, handleTrimEnd])

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [dragState, handleDragMove, handleDragEnd])

  // Determine cursor style
  const getCursor = (segmentId: string): string => {
    if (trimState?.segmentId === segmentId) return 'ew-resize'
    if (dragState?.segmentId === segmentId) return 'grabbing'
    if (hoveredEdge?.segmentId === segmentId) return 'ew-resize'
    if (onUpdateSegment) return 'grab'
    return 'pointer'
  }

  return (
    <div className="h-12 border-b border-white/10 relative" ref={trackRef}>
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
          const isActive = trimState?.segmentId === segment.id || dragState?.segmentId === segment.id

          return (
            <div
              key={segment.id}
              className={`absolute top-1 bottom-1 rounded border ${colorClass} flex items-center px-2 overflow-hidden transition-all select-none ${
                isActive ? 'brightness-125 ring-1 ring-white/30' : 'hover:brightness-110'
              }`}
              style={{
                left,
                width: Math.max(width, 20),
                cursor: getCursor(segment.id),
              }}
              onMouseMove={(e) => handleSegmentMouseMove(e, segment.id)}
              onMouseLeave={handleSegmentMouseLeave}
              onMouseDown={(e) => handleMouseDown(e, segment)}
              title={`${segment.type || 'Segment'}: ${segment.text}`}
            >
              {/* Trim handle indicators */}
              {onUpdateSegment && hoveredEdge?.segmentId === segment.id && (
                <div
                  className={`absolute top-0 bottom-0 w-1 bg-white/40 rounded-full ${
                    hoveredEdge.edge === 'start' ? 'left-0' : 'right-0'
                  }`}
                />
              )}
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

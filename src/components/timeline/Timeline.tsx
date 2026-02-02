'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Maximize2, Scissors } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { formatTime } from '@/lib/utils'
import type { Scene, Clip } from '@/types'

interface TimelineProps {
  duration: number
  currentTime: number
  onSeek: (time: number) => void
  onClipSelect?: (clipId: string, multi?: boolean) => void
  selectedClipIds?: string[]
}

export function Timeline({
  duration,
  currentTime,
  onSeek,
  onClipSelect,
  selectedClipIds = [],
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scenes, clips, videos, timeline, setTimeline, updateClip, addClip, saveToHistory, handleClipMoved } = useProjectStore()

  const zoom = timeline.zoom
  const setZoom = (newZoom: number) => setTimeline({ zoom: newZoom })
  const [scrollX, setScrollX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Trim state
  const [trimState, setTrimState] = useState<{
    clipId: string
    edge: 'start' | 'end'
    initialTime: number
    initialMouseX: number
  } | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<{ clipId: string; edge: 'start' | 'end' } | null>(null)

  // Drag state for reordering clips
  const [dragState, setDragState] = useState<{
    clipId: string
    initialStartTime: number
    initialEndTime: number
    initialMouseX: number
    currentOffset: number
  } | null>(null)

  const timelineWidth = duration * zoom
  const visibleWidth = containerRef.current?.clientWidth || 800

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollX(e.currentTarget.scrollLeft)
  }

  // Handle click to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollX
    const time = x / zoom
    onSeek(Math.max(0, Math.min(duration, time)))
  }

  // Handle playhead drag
  const handlePlayheadDrag = useCallback((e: MouseEvent) => {
    if (!containerRef.current || !isDragging) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollX
    const time = x / zoom
    onSeek(Math.max(0, Math.min(duration, time)))
  }, [isDragging, scrollX, zoom, duration, onSeek])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handlePlayheadDrag)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handlePlayheadDrag)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handlePlayheadDrag, handleMouseUp])

  // Zoom to fit
  const zoomToFit = useCallback(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth - 64 // minus track labels
    const newZoom = Math.max(10, Math.min(200, containerWidth / duration))
    setZoom(Math.round(newZoom))
  }, [duration, setZoom])

  // Trim handlers
  const getEdgeAtPosition = useCallback((clipEl: HTMLElement, mouseX: number): 'start' | 'end' | null => {
    const rect = clipEl.getBoundingClientRect()
    if (mouseX - rect.left < 8) return 'start'
    if (rect.right - mouseX < 8) return 'end'
    return null
  }, [])

  const handleTrimStart = useCallback((clipId: string, edge: 'start' | 'end', e: React.MouseEvent) => {
    const clip = clips.find((c: Clip) => c.id === clipId)
    if (!clip) return
    e.stopPropagation()
    saveToHistory()
    setTrimState({
      clipId,
      edge,
      initialTime: edge === 'start' ? clip.startTime : clip.endTime,
      initialMouseX: e.clientX,
    })
  }, [clips, saveToHistory])

  const handleTrimMove = useCallback((e: MouseEvent) => {
    if (!trimState) return
    const deltaX = e.clientX - trimState.initialMouseX
    const deltaTime = deltaX / zoom
    const newTime = Math.max(0, trimState.initialTime + deltaTime)

    const clip = clips.find((c: Clip) => c.id === trimState.clipId)
    if (!clip) return

    if (trimState.edge === 'start') {
      // Don't let start time go past end time
      if (newTime < clip.endTime) {
        updateClip(trimState.clipId, { startTime: newTime })
      }
    } else {
      // Don't let end time go before start time
      if (newTime > clip.startTime) {
        updateClip(trimState.clipId, { endTime: Math.min(newTime, duration) })
      }
    }
  }, [trimState, zoom, clips, updateClip, duration])

  const handleTrimEnd = useCallback(() => {
    setTrimState(null)
  }, [])

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

  // Drag handlers for reordering clips
  const handleDragStart = useCallback((clipId: string, e: React.MouseEvent) => {
    const clip = clips.find((c: Clip) => c.id === clipId)
    if (!clip) return
    e.stopPropagation()
    saveToHistory()
    setDragState({
      clipId,
      initialStartTime: clip.startTime,
      initialEndTime: clip.endTime,
      initialMouseX: e.clientX,
      currentOffset: 0,
    })
  }, [clips, saveToHistory])

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragState) return
    const deltaX = e.clientX - dragState.initialMouseX
    const deltaTime = deltaX / zoom
    const clipDuration = dragState.initialEndTime - dragState.initialStartTime

    // Calculate new start time, clamped to valid range
    let newStartTime = Math.max(0, dragState.initialStartTime + deltaTime)
    // Don't let clip extend past duration
    if (newStartTime + clipDuration > duration) {
      newStartTime = duration - clipDuration
    }

    const newEndTime = newStartTime + clipDuration

    updateClip(dragState.clipId, {
      startTime: newStartTime,
      endTime: newEndTime
    })

    setDragState(prev => prev ? { ...prev, currentOffset: deltaTime } : null)
  }, [dragState, zoom, duration, updateClip])

  const handleDragEnd = useCallback(() => {
    if (dragState) {
      // Get the clip's current position after drag
      const clip = clips.find((c: Clip) => c.id === dragState.clipId)
      if (clip) {
        // Check if clip moved to a different scene and handle accordingly
        handleClipMoved(clip.id, clip.startTime, clip.endTime)
      }
    }
    setDragState(null)
  }, [dragState, clips, handleClipMoved])

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

  // Split clip at playhead
  const handleSplitAtPlayhead = useCallback(() => {
    // Find clip that contains the current time
    const clipToSplit = clips.find((c: Clip) =>
      currentTime > c.startTime && currentTime < c.endTime
    )

    if (!clipToSplit) return // No clip at playhead

    saveToHistory()

    // Update the original clip to end at playhead
    updateClip(clipToSplit.id, { endTime: currentTime })

    // Create a new clip starting at playhead
    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      sceneId: clipToSplit.sceneId,
      segmentId: clipToSplit.segmentId,
      title: `${clipToSplit.title} (split)`,
      startTime: currentTime,
      endTime: clipToSplit.endTime,
      order: clipToSplit.order + 0.5, // Place after original in order
    }

    addClip(newClip)
  }, [clips, currentTime, saveToHistory, updateClip, addClip])

  // Check if playhead is inside a clip (for enabling split button)
  const canSplit = clips.some((c: Clip) =>
    currentTime > c.startTime && currentTime < c.endTime
  )

  // Generate ruler marks
  const rulerMarks = []
  const interval = zoom >= 100 ? 1 : zoom >= 50 ? 5 : zoom >= 20 ? 10 : 30
  for (let t = 0; t <= duration; t += interval) {
    rulerMarks.push(t)
  }

  // Group clips by scene
  const sceneClips = scenes.map((scene: Scene) => ({
    scene,
    clips: clips.filter((c: Clip) => c.sceneId === scene.id).sort((a: Clip, b: Clip) => a.startTime - b.startTime),
  }))

  return (
    <div className="flex flex-col h-full bg-black/50 border-t border-white/10">
      {/* Zoom controls */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
        <span className="text-xs text-white/40">Zoom:</span>
        <input
          type="range"
          min="10"
          max="200"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-xs text-white/40 w-12">{zoom}px/s</span>
        <button
          onClick={zoomToFit}
          className="ml-2 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors flex items-center gap-1"
          title="Zoom to fit"
        >
          <Maximize2 className="w-3 h-3" />
          Fit
        </button>
        <button
          onClick={handleSplitAtPlayhead}
          disabled={!canSplit}
          className={`ml-2 px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
            canSplit
              ? 'bg-white/10 hover:bg-white/20'
              : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
          title="Split clip at playhead (S)"
        >
          <Scissors className="w-3 h-3" />
          Split
        </button>
      </div>

      {/* Timeline content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative"
        onScroll={handleScroll}
        onClick={handleTimelineClick}
      >
        <div style={{ width: timelineWidth, minWidth: '100%' }} className="relative">
          {/* Ruler */}
          <div className="h-6 border-b border-white/10 relative">
            {rulerMarks.map((t) => (
              <div
                key={t}
                className="absolute top-0 h-full flex flex-col items-center"
                style={{ left: t * zoom }}
              >
                <div className="w-px h-2 bg-white/30" />
                <span className="text-[10px] text-white/40 mt-0.5">{formatTime(t)}</span>
              </div>
            ))}
          </div>

          {/* Story Track - Scenes */}
          <div className="h-12 border-b border-white/10 relative bg-white/5">
            <div className="absolute left-0 top-0 h-full w-16 bg-black/50 flex items-center px-2 z-10 border-r border-white/10">
              <span className="text-[10px] text-white/40 uppercase">Scenes</span>
            </div>
            <div className="ml-16 h-full relative">
              {scenes.map((scene: Scene) => (
                <div
                  key={scene.id}
                  className="absolute top-1 bottom-1 rounded bg-brand-500/30 border border-brand-500/50 flex items-center px-2 overflow-hidden"
                  style={{
                    left: scene.startTime * zoom,
                    width: (scene.endTime - scene.startTime) * zoom,
                  }}
                >
                  <span className="text-xs text-white truncate">{scene.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Clips Track */}
          <div className="h-16 border-b border-white/10 relative">
            <div className="absolute left-0 top-0 h-full w-16 bg-black/50 flex items-center px-2 z-10 border-r border-white/10">
              <span className="text-[10px] text-white/40 uppercase">Clips</span>
            </div>
            <div className="ml-16 h-full relative">
              {clips.map((clip: Clip) => {
                const hasVideo = clip.video || videos[`video-${clip.id}`]
                const isSelected = selectedClipIds.includes(clip.id)
                const isHoveredStart = hoveredEdge?.clipId === clip.id && hoveredEdge?.edge === 'start'
                const isHoveredEnd = hoveredEdge?.clipId === clip.id && hoveredEdge?.edge === 'end'
                const isTrimming = trimState?.clipId === clip.id
                const isDraggingThis = dragState?.clipId === clip.id
                const isAnyDragging = dragState !== null

                // Determine cursor based on state
                let cursor = 'cursor-grab'
                if (isTrimming || isHoveredStart || isHoveredEnd) {
                  cursor = 'cursor-ew-resize'
                } else if (isDraggingThis) {
                  cursor = 'cursor-grabbing'
                }

                return (
                  <div
                    key={clip.id}
                    className={`absolute top-1 bottom-1 rounded border flex items-center overflow-hidden transition-colors ${
                      isSelected
                        ? 'bg-brand-500/40 border-brand-500'
                        : hasVideo
                        ? 'bg-green-500/30 border-green-500/50 hover:bg-green-500/40'
                        : 'bg-white/10 border-white/20 hover:bg-white/20'
                    } ${cursor} ${isDraggingThis ? 'z-30 shadow-lg ring-2 ring-brand-500' : ''} ${isAnyDragging && !isDraggingThis ? 'opacity-50' : ''}`}
                    style={{
                      left: clip.startTime * zoom,
                      width: Math.max((clip.endTime - clip.startTime) * zoom, 40),
                    }}
                    onClick={(e) => {
                      if (!hoveredEdge && !dragState) {
                        e.stopPropagation()
                        // Multi-select with Cmd/Ctrl or Shift
                        const multi = e.metaKey || e.ctrlKey || e.shiftKey
                        onClipSelect?.(clip.id, multi)
                      }
                    }}
                    onMouseMove={(e) => {
                      if (dragState) return // Don't update edge state while dragging
                      const edge = getEdgeAtPosition(e.currentTarget, e.clientX)
                      if (edge) {
                        setHoveredEdge({ clipId: clip.id, edge })
                      } else {
                        setHoveredEdge(null)
                      }
                    }}
                    onMouseLeave={() => {
                      if (!dragState) setHoveredEdge(null)
                    }}
                    onMouseDown={(e) => {
                      const edge = getEdgeAtPosition(e.currentTarget, e.clientX)
                      if (edge) {
                        handleTrimStart(clip.id, edge, e)
                      } else {
                        // Start drag for reordering
                        handleDragStart(clip.id, e)
                      }
                    }}
                  >
                    {/* Start edge handle */}
                    <div className={`absolute left-0 top-0 bottom-0 w-2 ${isHoveredStart ? 'bg-brand-500/50' : ''}`} />
                    <span className="text-[10px] text-white truncate px-2">{clip.title}</span>
                    {/* End edge handle */}
                    <div className={`absolute right-0 top-0 bottom-0 w-2 ${isHoveredEnd ? 'bg-brand-500/50' : ''}`} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Assets Track - Video thumbnails */}
          <div className="h-12 border-b border-white/10 relative">
            <div className="absolute left-0 top-0 h-full w-16 bg-black/50 flex items-center px-2 z-10 border-r border-white/10">
              <span className="text-[10px] text-white/40 uppercase">Videos</span>
            </div>
            <div className="ml-16 h-full relative">
              {clips.map((clip: Clip) => {
                const video = clip.video || videos[`video-${clip.id}`]
                if (!video) return null
                return (
                  <div
                    key={clip.id}
                    className="absolute top-1 bottom-1 rounded bg-purple-500/30 border border-purple-500/50 flex items-center justify-center overflow-hidden"
                    style={{
                      left: clip.startTime * zoom,
                      width: Math.max((clip.endTime - clip.startTime) * zoom, 40),
                    }}
                  >
                    <span className="text-[10px] text-white/60">VID</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-brand-500 z-20 cursor-ew-resize"
            style={{ left: currentTime * zoom }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setIsDragging(true)
            }}
          >
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-brand-500 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

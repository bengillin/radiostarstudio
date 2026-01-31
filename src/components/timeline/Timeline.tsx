'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useProjectStore } from '@/store/project-store'
import { formatTime } from '@/lib/utils'
import type { Scene, Clip } from '@/types'

interface TimelineProps {
  duration: number
  currentTime: number
  onSeek: (time: number) => void
  onClipSelect?: (clipId: string) => void
  selectedClipId?: string | null
}

export function Timeline({
  duration,
  currentTime,
  onSeek,
  onClipSelect,
  selectedClipId,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scenes, clips, videos } = useProjectStore()

  const [zoom, setZoom] = useState(50) // pixels per second
  const [scrollX, setScrollX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

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

  // Generate ruler marks
  const rulerMarks = []
  const interval = zoom >= 100 ? 1 : zoom >= 50 ? 5 : zoom >= 20 ? 10 : 30
  for (let t = 0; t <= duration; t += interval) {
    rulerMarks.push(t)
  }

  // Group clips by scene
  const sceneClips = scenes.map(scene => ({
    scene,
    clips: clips.filter(c => c.sceneId === scene.id).sort((a, b) => a.startTime - b.startTime),
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
              {scenes.map((scene) => (
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
              {clips.map((clip) => {
                const hasVideo = clip.video || videos[`video-${clip.id}`]
                const isSelected = selectedClipId === clip.id
                return (
                  <div
                    key={clip.id}
                    className={`absolute top-1 bottom-1 rounded border flex items-center px-2 overflow-hidden cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand-500/40 border-brand-500'
                        : hasVideo
                        ? 'bg-green-500/30 border-green-500/50 hover:bg-green-500/40'
                        : 'bg-white/10 border-white/20 hover:bg-white/20'
                    }`}
                    style={{
                      left: clip.startTime * zoom,
                      width: Math.max((clip.endTime - clip.startTime) * zoom, 40),
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onClipSelect?.(clip.id)
                    }}
                  >
                    <span className="text-[10px] text-white truncate">{clip.title}</span>
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
              {clips.map((clip) => {
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

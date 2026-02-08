'use client'

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { Play, Pause, Maximize2, Minimize2 } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { formatTime } from '@/lib/utils'
import type { Clip, Frame, GeneratedVideo } from '@/types'

interface PreviewPlayerProps {
  currentTime: number
  isPlaying: boolean
  onTogglePlayback: () => void
  onSeek: (time: number) => void
  duration: number
}

interface ClipVisual {
  clip: Clip
  video?: GeneratedVideo
  startFrame?: Frame
  endFrame?: Frame
}

export function PreviewPlayer({ currentTime, isPlaying, onTogglePlayback, onSeek, duration }: PreviewPlayerProps) {
  const { clips, scenes, frames, videos } = useProjectStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)

  // Build sorted clip visuals with their assets
  const clipVisuals = useMemo(() => {
    return clips
      .slice()
      .sort((a, b) => a.startTime - b.startTime)
      .map((clip): ClipVisual => {
        const video = clip.video as GeneratedVideo | undefined
          || Object.values(videos).find((v: any) => v.clipId === clip.id && v.status === 'complete') as GeneratedVideo | undefined
        const startFrame = (clip.startFrame as Frame | undefined)
          || Object.values(frames).find((f: any) => f.clipId === clip.id && f.type === 'start') as Frame | undefined
        const endFrame = (clip.endFrame as Frame | undefined)
          || Object.values(frames).find((f: any) => f.clipId === clip.id && f.type === 'end') as Frame | undefined
        return { clip, video, startFrame, endFrame }
      })
  }, [clips, frames, videos])

  // Find which clip (if any) is at the current time
  const currentVisual = useMemo(() => {
    return clipVisuals.find(cv =>
      currentTime >= cv.clip.startTime && currentTime < cv.clip.endTime
    ) || null
  }, [clipVisuals, currentTime])

  // Find the current scene for display
  const currentScene = useMemo(() => {
    return scenes.find(s => currentTime >= s.startTime && currentTime < s.endTime)
  }, [scenes, currentTime])

  // Sync video element with playback
  useEffect(() => {
    const vid = videoRef.current
    if (!vid || !currentVisual?.video) return

    const videoId = currentVisual.video.id
    const clipLocalTime = currentTime - currentVisual.clip.startTime
    const videoFraction = clipLocalTime / (currentVisual.clip.endTime - currentVisual.clip.startTime)
    const videoSeekTime = videoFraction * (currentVisual.video.duration || vid.duration || 8)

    // If we switched to a different video, load it
    if (activeVideoId !== videoId) {
      setActiveVideoId(videoId)
      vid.src = currentVisual.video.url
      vid.currentTime = Math.max(0, videoSeekTime)
      if (isPlaying) vid.play().catch(() => {})
      return
    }

    // Sync: if drift > 0.3s, re-seek
    if (Math.abs(vid.currentTime - videoSeekTime) > 0.3) {
      vid.currentTime = Math.max(0, videoSeekTime)
    }

    if (isPlaying && vid.paused) {
      vid.play().catch(() => {})
    } else if (!isPlaying && !vid.paused) {
      vid.pause()
    }
  }, [currentTime, currentVisual, isPlaying, activeVideoId])

  // Pause video when no clip or no video
  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    if (!currentVisual?.video) {
      vid.pause()
      setActiveVideoId(null)
    }
  }, [currentVisual])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Progress bar click to seek
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = (e.clientX - rect.left) / rect.width
    onSeek(fraction * duration)
  }, [duration, onSeek])

  // Determine what to show
  const showVideo = currentVisual?.video
  const showFrame = !showVideo && currentVisual?.startFrame

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-black rounded-xl overflow-hidden border border-white/10 ${isFullscreen ? '' : 'h-full'}`}
    >
      {/* Video/image canvas */}
      <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
        {/* Hidden video element — always in DOM for smooth transitions */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-contain ${showVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          muted
          playsInline
        />

        {/* Static frame */}
        {showFrame && (
          <img
            src={currentVisual!.startFrame!.url}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}

        {/* Title card (no assets) */}
        {!showVideo && !showFrame && (
          <div className="text-center px-6">
            {currentScene ? (
              <>
                <p className="text-lg font-medium text-white/60">{currentScene.title}</p>
                {currentVisual && (
                  <p className="text-sm text-white/30 mt-1">{currentVisual.clip.title}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-white/30">
                {clips.length > 0 ? 'Between clips' : 'No clips yet'}
              </p>
            )}
          </div>
        )}

        {/* Play/pause overlay on click */}
        <button
          onClick={onTogglePlayback}
          className="absolute inset-0 w-full h-full cursor-pointer group"
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-0.5" />
              )}
            </div>
          </div>
        </button>

        {/* Fullscreen button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 rounded transition-colors opacity-0 hover:opacity-100 focus:opacity-100"
          style={{ opacity: undefined }} // Let CSS handle it via group
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4 text-white/70" />
          ) : (
            <Maximize2 className="w-4 h-4 text-white/70" />
          )}
        </button>

        {/* Current time badge */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-xs text-white/70 tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Mini progress bar with clip blocks */}
      <div
        className="h-6 bg-white/5 cursor-pointer relative flex-shrink-0"
        onClick={handleProgressClick}
      >
        {/* Clip blocks */}
        {clipVisuals.map(cv => {
          const left = (cv.clip.startTime / duration) * 100
          const width = ((cv.clip.endTime - cv.clip.startTime) / duration) * 100
          const hasVideo = !!cv.video
          const hasFrame = !!cv.startFrame
          return (
            <div
              key={cv.clip.id}
              className={`absolute top-1 bottom-1 rounded-sm ${
                hasVideo ? 'bg-green-500/40' : hasFrame ? 'bg-brand-500/30' : 'bg-white/10'
              }`}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          )
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
      </div>
    </div>
  )
}

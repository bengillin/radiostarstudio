'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Maximize2, Scissors, Plus, Trash2, Magnet, Play, Pause, Loader2, RotateCcw, Zap, ZapOff } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { formatTime } from '@/lib/utils'
import { WaveformTrack } from './WaveformTrack'
import { TranscriptTrack } from './TranscriptTrack'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu'
import type { Scene, Clip, TranscriptSegment, WorkflowStage } from '@/types'

interface TimelineProps {
  duration: number
  currentTime: number
  onSeek: (time: number) => void
  onClipSelect?: (clipId: string, multi?: boolean) => void
  selectedClipIds?: string[]
  transcript?: TranscriptSegment[]
  audioUrl?: string
  // Playback controls
  isPlaying?: boolean
  onTogglePlayback?: () => void
  // Workflow controls
  onStartTranscription?: () => void
  onStartPlanning?: () => void
  onStartGeneration?: () => void
}

const LABEL_WIDTH = 64 // px for track labels
const SNAP_THRESHOLD_PX = 8 // pixels within which to snap
const MIN_CLIP_DURATION = 0.5 // minimum clip duration in seconds

interface SnapPoint {
  time: number
  type: 'clip-start' | 'clip-end' | 'scene-start' | 'scene-end' | 'playhead' | 'beat'
  sourceId?: string
}

const STAGE_INFO: Record<WorkflowStage, { label: string; actionLabel?: string }> = {
  empty: { label: 'No Audio' },
  audio_loaded: { label: 'Ready', actionLabel: 'Transcribe' },
  transcribing: { label: 'Transcribing' },
  transcribed: { label: 'Transcribed', actionLabel: 'Plan Scenes' },
  planning: { label: 'Planning' },
  planned: { label: 'Ready', actionLabel: 'Generate All' },
  generating: { label: 'Generating' },
  ready: { label: 'Complete' },
}

export function Timeline({
  duration,
  currentTime,
  onSeek,
  onClipSelect,
  selectedClipIds = [],
  transcript = [],
  audioUrl,
  isPlaying = false,
  onTogglePlayback,
  onStartTranscription,
  onStartPlanning,
  onStartGeneration,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    audioFile,
    scenes,
    clips,
    videos,
    timeline,
    setTimeline,
    updateClip,
    addClip,
    saveToHistory,
    handleClipMoved,
    createScene,
    createClip,
    deleteClip,
    deleteSceneWithClips,
    updateSegment,
    workflow,
    setAutoProgress,
    clearWorkflowError,
    generationQueue,
    pauseQueue,
    resumeQueue,
  } = useProjectStore()

  const { stage, autoProgress, error, progress } = workflow
  const stageInfo = STAGE_INFO[stage] || STAGE_INFO['empty']
  const isProcessing = stage === 'transcribing' || stage === 'planning' || stage === 'generating'
  const currentProgress = stage === 'transcribing'
    ? progress.transcription
    : stage === 'planning'
    ? progress.planning
    : stage === 'generating'
    ? progress.generation
    : 0

  const zoom = timeline.zoom
  const setZoom = (newZoom: number) => setTimeline({ zoom: newZoom })
  const [scrollX, setScrollX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [activeSnapPoint, setActiveSnapPoint] = useState<number | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    track: 'scenes' | 'clips'
    time: number
    itemId?: string
  } | null>(null)

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

  // Calculate all snap points
  const snapPoints = useMemo((): SnapPoint[] => {
    const points: SnapPoint[] = []

    // Add clip edges
    clips.forEach((clip: Clip) => {
      points.push({ time: clip.startTime, type: 'clip-start', sourceId: clip.id })
      points.push({ time: clip.endTime, type: 'clip-end', sourceId: clip.id })
    })

    // Add scene boundaries
    scenes.forEach((scene: Scene) => {
      points.push({ time: scene.startTime, type: 'scene-start', sourceId: scene.id })
      points.push({ time: scene.endTime, type: 'scene-end', sourceId: scene.id })
    })

    // Add playhead
    points.push({ time: currentTime, type: 'playhead' })

    // Add beats
    if (audioFile?.beats) {
      for (const beat of audioFile.beats) {
        points.push({ time: beat, type: 'beat' })
      }
    }

    return points
  }, [clips, scenes, currentTime, audioFile?.beats])

  // Find nearest snap point
  const findSnapPoint = useCallback((time: number, excludeClipId?: string): number | null => {
    if (!snapEnabled) return null

    const thresholdTime = SNAP_THRESHOLD_PX / zoom
    let nearest: SnapPoint | null = null
    let nearestDist = Infinity

    for (const point of snapPoints) {
      // Skip points from the clip being dragged/trimmed
      if (excludeClipId && point.sourceId === excludeClipId) continue

      const dist = Math.abs(point.time - time)
      if (dist < thresholdTime && dist < nearestDist) {
        nearest = point
        nearestDist = dist
      }
    }

    return nearest ? nearest.time : null
  }, [snapEnabled, snapPoints, zoom])

  // Check for overlapping clips
  const getOverlappingClips = useCallback((clipId: string, startTime: number, endTime: number): Clip[] => {
    return clips.filter((c: Clip) => {
      if (c.id === clipId) return false
      // Check if clips overlap
      return startTime < c.endTime && endTime > c.startTime
    })
  }, [clips])

  // Get scene for a given time
  const getSceneAtTime = useCallback((time: number): Scene | undefined => {
    return scenes.find((s: Scene) => time >= s.startTime && time < s.endTime)
  }, [scenes])

  // Check if clip fits within its scene
  const clipFitsInScene = useCallback((clip: Clip): boolean => {
    const scene = scenes.find((s: Scene) => s.id === clip.sceneId)
    if (!scene) return true // No scene = no constraint
    return clip.startTime >= scene.startTime && clip.endTime <= scene.endTime
  }, [scenes])

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollX(e.currentTarget.scrollLeft)
  }

  // Handle click to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    if (clickX < LABEL_WIDTH) return

    const x = clickX + scrollX - LABEL_WIDTH
    const time = x / zoom
    onSeek(Math.max(0, Math.min(duration, time)))
  }

  // Handle right-click for context menu
  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    track: 'scenes' | 'clips',
    itemId?: string
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left + scrollX - LABEL_WIDTH
    const time = Math.max(0, clickX / zoom)

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      track,
      time,
      itemId,
    })
  }, [scrollX, zoom])

  // Handle playhead drag
  const handlePlayheadDrag = useCallback((e: MouseEvent) => {
    if (!containerRef.current || !isDragging) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollX - LABEL_WIDTH
    let time = x / zoom

    // Snap playhead to clip/scene edges
    const snapTime = findSnapPoint(time)
    if (snapTime !== null) {
      time = snapTime
      setActiveSnapPoint(snapTime)
    } else {
      setActiveSnapPoint(null)
    }

    onSeek(Math.max(0, Math.min(duration, time)))
  }, [isDragging, scrollX, zoom, duration, onSeek, findSnapPoint])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setActiveSnapPoint(null)
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
    const containerWidth = containerRef.current.clientWidth - LABEL_WIDTH
    const newZoom = Math.max(10, Math.min(200, containerWidth / duration))
    setZoom(Math.round(newZoom))
  }, [duration, setZoom])

  // Trim handlers
  const getEdgeAtPosition = useCallback((clipEl: HTMLElement, mouseX: number): 'start' | 'end' | null => {
    const rect = clipEl.getBoundingClientRect()
    if (mouseX - rect.left < 10) return 'start'
    if (rect.right - mouseX < 10) return 'end'
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
    let newTime = Math.max(0, trimState.initialTime + deltaTime)

    const clip = clips.find((c: Clip) => c.id === trimState.clipId)
    if (!clip) return

    // Try to snap
    const snapTime = findSnapPoint(newTime, trimState.clipId)
    if (snapTime !== null) {
      newTime = snapTime
      setActiveSnapPoint(snapTime)
    } else {
      setActiveSnapPoint(null)
    }

    if (trimState.edge === 'start') {
      // Ensure minimum duration and don't go past end
      const maxStart = clip.endTime - MIN_CLIP_DURATION
      newTime = Math.min(newTime, maxStart)
      if (newTime >= 0) {
        updateClip(trimState.clipId, { startTime: newTime })
      }
    } else {
      // Ensure minimum duration and don't go before start
      const minEnd = clip.startTime + MIN_CLIP_DURATION
      newTime = Math.max(newTime, minEnd)
      updateClip(trimState.clipId, { endTime: Math.min(newTime, duration) })
    }
  }, [trimState, zoom, clips, updateClip, duration, findSnapPoint])

  const handleTrimEnd = useCallback(() => {
    if (trimState) {
      const clip = clips.find((c: Clip) => c.id === trimState.clipId)
      if (clip) {
        // Check if clip should be reassigned to a different scene
        handleClipMoved(clip.id, clip.startTime, clip.endTime)
      }
    }
    setTrimState(null)
    setActiveSnapPoint(null)
  }, [trimState, clips, handleClipMoved])

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

    let newStartTime = Math.max(0, dragState.initialStartTime + deltaTime)

    // Try to snap start edge
    const snapStart = findSnapPoint(newStartTime, dragState.clipId)
    if (snapStart !== null) {
      newStartTime = snapStart
      setActiveSnapPoint(snapStart)
    } else {
      // Try to snap end edge
      const snapEnd = findSnapPoint(newStartTime + clipDuration, dragState.clipId)
      if (snapEnd !== null) {
        newStartTime = snapEnd - clipDuration
        setActiveSnapPoint(snapEnd)
      } else {
        setActiveSnapPoint(null)
      }
    }

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
  }, [dragState, zoom, duration, updateClip, findSnapPoint])

  const handleDragEnd = useCallback(() => {
    if (dragState) {
      const clip = clips.find((c: Clip) => c.id === dragState.clipId)
      if (clip) {
        handleClipMoved(clip.id, clip.startTime, clip.endTime)
      }
    }
    setDragState(null)
    setActiveSnapPoint(null)
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
    const clipToSplit = clips.find((c: Clip) =>
      currentTime > c.startTime && currentTime < c.endTime
    )

    if (!clipToSplit) return

    saveToHistory()
    updateClip(clipToSplit.id, { endTime: currentTime })

    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      sceneId: clipToSplit.sceneId,
      segmentId: clipToSplit.segmentId,
      title: `${clipToSplit.title} (split)`,
      startTime: currentTime,
      endTime: clipToSplit.endTime,
      order: clipToSplit.order + 0.5,
    }

    addClip(newClip)
  }, [clips, currentTime, saveToHistory, updateClip, addClip])

  const canSplit = clips.some((c: Clip) =>
    currentTime > c.startTime && currentTime < c.endTime
  )

  // Generate ruler marks
  const rulerMarks = []
  const interval = zoom >= 100 ? 1 : zoom >= 50 ? 5 : zoom >= 20 ? 10 : 30
  for (let t = 0; t <= duration; t += interval) {
    rulerMarks.push(t)
  }

  // Context menu items
  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu) return []

    if (contextMenu.track === 'scenes') {
      if (contextMenu.itemId) {
        const sceneClips = clips.filter((c: Clip) => c.sceneId === contextMenu.itemId)
        return [
          {
            id: 'add-clip',
            label: 'Add Clip Here',
            icon: Plus,
            onClick: () => {
              saveToHistory()
              createClip(contextMenu.time, Math.min(contextMenu.time + 8, duration), undefined, contextMenu.itemId!)
            },
          },
          {
            id: 'delete-scene',
            label: `Delete Scene${sceneClips.length > 0 ? ` (${sceneClips.length} clips)` : ''}`,
            icon: Trash2,
            danger: true,
            onClick: () => {
              saveToHistory()
              deleteSceneWithClips(contextMenu.itemId!)
            },
          },
        ]
      } else {
        return [
          {
            id: 'add-scene',
            label: 'Add Scene Here',
            icon: Plus,
            onClick: () => {
              saveToHistory()
              createScene()
            },
          },
        ]
      }
    } else {
      if (contextMenu.itemId) {
        return [
          {
            id: 'delete-clip',
            label: 'Delete Clip',
            icon: Trash2,
            danger: true,
            onClick: () => {
              saveToHistory()
              deleteClip(contextMenu.itemId!)
            },
          },
        ]
      } else {
        const sceneAtTime = scenes.find((s: Scene) =>
          contextMenu.time >= s.startTime && contextMenu.time < s.endTime
        )
        return [
          {
            id: 'add-clip',
            label: 'Add Clip Here',
            icon: Plus,
            onClick: () => {
              if (sceneAtTime) {
                saveToHistory()
                createClip(contextMenu.time, Math.min(contextMenu.time + 8, sceneAtTime.endTime), undefined, sceneAtTime.id)
              }
            },
            disabled: !sceneAtTime,
          },
        ]
      }
    }
  }

  // Render scene boundary indicators on clips track
  const sceneBoundaryLines = useMemo(() => {
    return scenes.flatMap((scene: Scene) => [
      { time: scene.startTime, sceneId: scene.id },
      { time: scene.endTime, sceneId: scene.id },
    ])
  }, [scenes])

  return (
    <div className="flex flex-col h-full bg-black/50">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 flex-shrink-0">
        {/* Playback controls */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <button
            onClick={onTogglePlayback}
            disabled={!onTogglePlayback}
            className="w-8 h-8 rounded-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-white" />
            ) : (
              <Play className="w-4 h-4 text-white ml-0.5" />
            )}
          </button>
          <span className="text-xs text-white/60 font-mono">
            {formatTime(currentTime)}
          </span>
        </div>

        {/* Workflow status */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />
          ) : error ? (
            <div className="w-3 h-3 rounded-full bg-red-500" />
          ) : (
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
          )}
          <span className="text-xs text-white/70">
            {error ? 'Error' : stageInfo.label}
            {isProcessing && ` ${currentProgress}%`}
          </span>

          {/* Workflow action button */}
          {error ? (
            <button
              onClick={() => {
                clearWorkflowError()
                if (error.stage === 'transcribing') onStartTranscription?.()
                else if (error.stage === 'planning') onStartPlanning?.()
              }}
              className="px-2 py-0.5 text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          ) : stage === 'audio_loaded' && onStartTranscription ? (
            <button
              onClick={onStartTranscription}
              className="px-2 py-0.5 text-xs bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/50 text-brand-400 rounded flex items-center gap-1 transition-colors"
            >
              <Play className="w-3 h-3" />
              Transcribe
            </button>
          ) : stage === 'transcribed' && onStartPlanning ? (
            <button
              onClick={onStartPlanning}
              className="px-2 py-0.5 text-xs bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/50 text-brand-400 rounded flex items-center gap-1 transition-colors"
            >
              <Play className="w-3 h-3" />
              Plan
            </button>
          ) : stage === 'planned' && onStartGeneration ? (
            <button
              onClick={onStartGeneration}
              className="px-2 py-0.5 text-xs bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/50 text-brand-400 rounded flex items-center gap-1 transition-colors"
            >
              <Play className="w-3 h-3" />
              Generate
            </button>
          ) : stage === 'generating' ? (
            <button
              onClick={() => generationQueue.isPaused ? resumeQueue() : pauseQueue()}
              className="px-2 py-0.5 text-xs bg-white/10 hover:bg-white/20 rounded flex items-center gap-1 transition-colors"
            >
              {generationQueue.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {generationQueue.isPaused ? 'Resume' : 'Pause'}
            </button>
          ) : null}

          {/* Auto toggle */}
          <button
            onClick={() => setAutoProgress(!autoProgress)}
            className={`px-1.5 py-0.5 text-xs rounded flex items-center gap-1 transition-colors ${
              autoProgress
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50'
                : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
            }`}
            title={autoProgress ? 'Auto-progress enabled' : 'Auto-progress disabled'}
          >
            {autoProgress ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />}
          </button>
        </div>

        {/* Timeline controls */}
        <span className="text-xs text-white/40">Zoom:</span>
        <input
          type="range"
          min="10"
          max="200"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-xs text-white/40 w-10">{zoom}px/s</span>
        <button
          onClick={zoomToFit}
          className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors flex items-center gap-1"
          title="Zoom to fit"
        >
          <Maximize2 className="w-3 h-3" />
          Fit
        </button>
        <button
          onClick={handleSplitAtPlayhead}
          disabled={!canSplit}
          className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
            canSplit
              ? 'bg-white/10 hover:bg-white/20'
              : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
          title="Split clip at playhead (S)"
        >
          <Scissors className="w-3 h-3" />
          Split
        </button>
        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
            snapEnabled
              ? 'bg-brand-500/30 text-brand-400 border border-brand-500/50'
              : 'bg-white/10 hover:bg-white/20'
          }`}
          title="Toggle snap to edges"
        >
          <Magnet className="w-3 h-3" />
          Snap
        </button>
        <div className="ml-auto text-xs text-white/40 font-mono">
          {formatTime(duration)}
        </div>
      </div>

      {/* Timeline tracks */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative"
        onScroll={handleScroll}
        onClick={handleTimelineClick}
      >
        <div style={{ width: timelineWidth + LABEL_WIDTH, minWidth: '100%' }} className="relative">
          {/* Ruler - always at top */}
          <div className="h-6 border-b border-white/10 relative bg-black/30">
            <div
              className="absolute left-0 top-0 h-full bg-black/50 flex items-center px-2 z-10 border-r border-white/10"
              style={{ width: LABEL_WIDTH }}
            >
              <span className="text-[10px] text-white/40 uppercase">Time</span>
            </div>
            <div className="h-full relative" style={{ marginLeft: LABEL_WIDTH }}>
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
          </div>

          {/* Clips Track - top */}
          <div
            className="h-14 border-b border-white/10 relative"
            onContextMenu={(e) => handleContextMenu(e, 'clips')}
          >
            <div
              className="absolute left-0 top-0 h-full bg-black/50 flex items-center px-2 z-10 border-r border-white/10"
              style={{ width: LABEL_WIDTH }}
            >
              <span className="text-[10px] text-white/40 uppercase">Clips</span>
            </div>
            <div className="h-full relative" style={{ marginLeft: LABEL_WIDTH, minWidth: timelineWidth }}>
              {/* Scene boundary indicators */}
              {sceneBoundaryLines.map((line, i) => (
                <div
                  key={`scene-line-${i}`}
                  className="absolute top-0 bottom-0 w-px bg-brand-500/30 pointer-events-none"
                  style={{ left: line.time * zoom }}
                />
              ))}

              {clips.map((clip: Clip) => {
                const hasVideo = clip.video || videos[`video-${clip.id}`]
                const isSelected = selectedClipIds.includes(clip.id)
                const isHoveredStart = hoveredEdge?.clipId === clip.id && hoveredEdge?.edge === 'start'
                const isHoveredEnd = hoveredEdge?.clipId === clip.id && hoveredEdge?.edge === 'end'
                const isTrimming = trimState?.clipId === clip.id
                const isDraggingThis = dragState?.clipId === clip.id
                const isAnyDragging = dragState !== null || trimState !== null

                // Check for issues
                const overlappingClips = getOverlappingClips(clip.id, clip.startTime, clip.endTime)
                const hasOverlap = overlappingClips.length > 0
                const fitsInScene = clipFitsInScene(clip)

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
                        : hasOverlap
                        ? 'bg-red-500/30 border-red-500/50'
                        : !fitsInScene
                        ? 'bg-yellow-500/30 border-yellow-500/50'
                        : hasVideo
                        ? 'bg-green-500/30 border-green-500/50 hover:bg-green-500/40'
                        : 'bg-white/10 border-white/20 hover:bg-white/20'
                    } ${cursor} ${isDraggingThis ? 'z-30 shadow-lg ring-2 ring-brand-500' : ''} ${isAnyDragging && !isDraggingThis ? 'opacity-50' : ''}`}
                    style={{
                      left: clip.startTime * zoom,
                      width: Math.max((clip.endTime - clip.startTime) * zoom, 40),
                    }}
                    title={
                      hasOverlap
                        ? `Overlaps with: ${overlappingClips.map(c => c.title).join(', ')}`
                        : !fitsInScene
                        ? 'Clip extends beyond scene boundaries'
                        : clip.title
                    }
                    onClick={(e) => {
                      if (!hoveredEdge && !dragState) {
                        e.stopPropagation()
                        const multi = e.metaKey || e.ctrlKey || e.shiftKey
                        onClipSelect?.(clip.id, multi)
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, 'clips', clip.id)}
                    onMouseMove={(e) => {
                      if (dragState) return
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
                      if (e.button !== 0) return
                      const edge = getEdgeAtPosition(e.currentTarget, e.clientX)
                      if (edge) {
                        handleTrimStart(clip.id, edge, e)
                      } else {
                        handleDragStart(clip.id, e)
                      }
                    }}
                  >
                    {/* Start edge handle */}
                    <div className={`absolute left-0 top-0 bottom-0 w-2 transition-colors ${isHoveredStart ? 'bg-brand-500/50' : ''}`} />
                    <span className="text-[10px] text-white truncate px-2 flex-1">{clip.title}</span>
                    {/* Status indicators */}
                    {hasOverlap && (
                      <span className="text-[8px] bg-red-500/50 px-1 rounded mr-1">OVL</span>
                    )}
                    {!fitsInScene && !hasOverlap && (
                      <span className="text-[8px] bg-yellow-500/50 px-1 rounded mr-1">OUT</span>
                    )}
                    {/* End edge handle */}
                    <div className={`absolute right-0 top-0 bottom-0 w-2 transition-colors ${isHoveredEnd ? 'bg-brand-500/50' : ''}`} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Scenes Track */}
          <div
            className="h-10 border-b border-white/10 relative bg-white/5"
            onContextMenu={(e) => handleContextMenu(e, 'scenes')}
          >
            <div
              className="absolute left-0 top-0 h-full bg-black/50 flex items-center px-2 z-10 border-r border-white/10"
              style={{ width: LABEL_WIDTH }}
            >
              <span className="text-[10px] text-white/40 uppercase">Scenes</span>
            </div>
            <div className="h-full relative" style={{ marginLeft: LABEL_WIDTH, width: timelineWidth }}>
              {scenes.map((scene: Scene) => {
                const sceneClips = clips.filter((c: Clip) => c.sceneId === scene.id)
                const hasClipsOutside = sceneClips.some((c: Clip) =>
                  c.startTime < scene.startTime || c.endTime > scene.endTime
                )

                return (
                  <div
                    key={scene.id}
                    className={`absolute top-1 bottom-1 rounded border flex items-center px-2 overflow-hidden cursor-pointer transition-colors ${
                      hasClipsOutside
                        ? 'bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30'
                        : 'bg-brand-500/30 border-brand-500/50 hover:bg-brand-500/40'
                    }`}
                    style={{
                      left: scene.startTime * zoom,
                      width: (scene.endTime - scene.startTime) * zoom,
                    }}
                    title={hasClipsOutside ? 'Some clips extend beyond this scene' : scene.title}
                    onContextMenu={(e) => handleContextMenu(e, 'scenes', scene.id)}
                  >
                    <span className="text-xs text-white truncate">{scene.title}</span>
                    {sceneClips.length > 0 && (
                      <span className="ml-auto text-[10px] text-white/50">{sceneClips.length}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Transcript Track */}
          {transcript.length > 0 && (
            <TranscriptTrack
              segments={transcript}
              zoom={zoom}
              labelWidth={LABEL_WIDTH}
              duration={duration}
              onSeek={onSeek}
              onUpdateSegment={(id, updates) => updateSegment(id, updates)}
              findSnapPoint={findSnapPoint}
            />
          )}

          {/* Waveform Track - at bottom */}
          {audioUrl && (
            <WaveformTrack
              audioUrl={audioUrl}
              duration={duration}
              zoom={zoom}
              currentTime={currentTime}
              onSeek={onSeek}
              labelWidth={LABEL_WIDTH}
              beats={audioFile?.beats}
            />
          )}

          {/* Snap indicator line */}
          {activeSnapPoint !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-green-400 z-30 pointer-events-none"
              style={{ left: activeSnapPoint * zoom + LABEL_WIDTH }}
            />
          )}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-brand-500 z-20 cursor-ew-resize"
            style={{ left: currentTime * zoom + LABEL_WIDTH }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setIsDragging(true)
            }}
          >
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-brand-500 rounded-full" />
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu !== null}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : { x: 0, y: 0 }}
        items={getContextMenuItems()}
        onClose={() => setContextMenu(null)}
      />
    </div>
  )
}

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Music, Upload, Layers, Film, Download,
  Play, Pause, Loader2, ChevronRight, ChevronDown, ChevronUp,
  Users, Clapperboard, Clock, MapPin, Heart, Image, Sparkles, X, Video, Keyboard,
  Plus, Trash2, FolderOpen
} from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { Timeline } from '@/components/timeline'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal'
import { StorageIndicator } from '@/components/ui/StorageIndicator'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { GenerationQueue } from '@/components/ui/GenerationQueue'
import { ExportDialog } from '@/components/ui/ExportDialog'
import { MediaLibraryModal } from '@/components/ui/MediaLibrary'
import { DetailPanel } from '@/components/studio/DetailPanel'
import { useWorkflowAutomation } from '@/hooks/useWorkflowAutomation'
import { formatTime } from '@/lib/utils'
import { AVAILABLE_MODELS } from '@/lib/gemini'
import type { TranscriptSegment, Scene, Clip, Frame, GeneratedVideo } from '@/types'

type Step = 'upload' | 'transcribe' | 'plan' | 'generate' | 'export'

// Veo 3.1 video duration constraints
const VEO_DURATIONS = [4, 6, 8] as const
const VEO_MAX_DURATION = 8 // seconds
const VEO_DEFAULT_DURATION = 8 // Use max for best quality

const STEPS: { id: Step; label: string; icon: typeof Music }[] = [
  { id: 'upload', label: 'Audio', icon: Upload },
  { id: 'transcribe', label: 'Transcribe', icon: Music },
  { id: 'plan', label: 'Plan', icon: Layers },
  { id: 'generate', label: 'Generate', icon: Film },
  { id: 'export', label: 'Export', icon: Download },
]

export default function StudioPage() {
  return (
    <ToastProvider>
      <StudioPageContent />
    </ToastProvider>
  )
}

function StudioPageContent() {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement>(null)
  const { showToast } = useToast()
  const {
    audioFile,
    setAudioFile,
    transcript,
    setTranscript,
    scenes,
    setScenes,
    updateScene,
    clips,
    setClips,
    updateClip,
    deleteClip,
    addClip,
    createScene,
    deleteSceneWithClips,
    getClipsForScene,
    createClip,
    generationQueue,
    queueAllFrames,
    queueAllVideos,
    queueFrame,
    queueVideo,
    isClipQueued,
    startQueue,
    frames,
    setFrame,
    videos,
    setVideo,
    globalStyle,
    setGlobalStyle,
    modelSettings,
    setModelSettings,
    timeline,
    selectClip,
    clearSelection,
    saveToHistory,
    undo,
    redo,
  } = useProjectStore()

  // Workflow automation
  const {
    startTranscription,
    startPlanning,
    stage: workflowStage,
    progress: workflowProgress,
    error: workflowError,
  } = useWorkflowAutomation({
    onTranscriptionComplete: () => showToast('Transcription complete', 'success'),
    onPlanningComplete: () => showToast('Scene planning complete', 'success'),
    onError: (message) => showToast(message, 'error'),
  })

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null)
  // Use store's multi-select, but keep a single "active" clip for detail panel
  const selectedClipIds = timeline?.selectedClipIds ?? []
  const selectedClipId = selectedClipIds.length > 0 ? selectedClipIds[selectedClipIds.length - 1] : null
  const [framePrompt, setFramePrompt] = useState('')
  const [motionPrompt, setMotionPrompt] = useState('')
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const [showQueueModal, setShowQueueModal] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showMediaLibrary, setShowMediaLibrary] = useState(false)
  const [leftPanelTab, setLeftPanelTab] = useState<'lyrics' | 'scenes'>('scenes')

  // Scene/Clip management state
  const [sceneToDelete, setSceneToDelete] = useState<{ id: string; clipCount: number } | null>(null)
  const [showCreateClipForm, setShowCreateClipForm] = useState(false)
  const [newClipSceneId, setNewClipSceneId] = useState<string>('')
  const [newClipStart, setNewClipStart] = useState(0)
  const [newClipEnd, setNewClipEnd] = useState(VEO_MAX_DURATION)
  const [newClipTitle, setNewClipTitle] = useState('')

  // Check if any clips have videos generated
  const clipsWithVideos = clips.filter((c: Clip) => c.video || videos[`video-${c.id}`])
  const hasVideos = clipsWithVideos.length > 0

  // Determine current step based on state
  const currentStep: Step = !audioFile
    ? 'upload'
    : transcript.length === 0
    ? 'transcribe'
    : scenes.length === 0
    ? 'plan'
    : hasVideos
    ? 'export'
    : 'generate'

  // Audio file handling
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [isDraggingAudio, setIsDraggingAudio] = useState(false)

  const processAudioFile = useCallback(async (file: File) => {
    setIsLoadingAudio(true)
    try {
      const url = URL.createObjectURL(file)
      const audio = new Audio(url)
      await new Promise<void>((resolve) => {
        audio.onloadedmetadata = () => resolve()
        audio.onerror = () => resolve()
      })

      setAudioFile({
        id: crypto.randomUUID(),
        name: file.name,
        url,
        duration: audio.duration || 0,
        file,
      })
      showToast('Audio loaded', 'success')
    } catch (error) {
      showToast('Failed to load audio file', 'error')
    } finally {
      setIsLoadingAudio(false)
    }
  }, [setAudioFile, showToast])

  const handleAudioDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingAudio(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      processAudioFile(file)
    }
  }, [processAudioFile])

  const handleAudioFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('audio/')) {
      processAudioFile(file)
    }
  }, [processAudioFile])

  // Audio playback handlers
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleSeek = useCallback((time: number) => {
    const audio = audioRef.current
    if (!audio) return
    const clampedTime = Math.max(0, Math.min(time, audioFile?.duration || 0))
    audio.currentTime = clampedTime
    setCurrentTime(clampedTime)
  }, [audioFile?.duration])

  // Delete selected clip(s)
  const handleDeleteSelectedClip = useCallback(() => {
    if (selectedClipIds.length === 0) return
    saveToHistory()
    selectedClipIds.forEach((id: string) => deleteClip(id))
    clearSelection()
  }, [selectedClipIds, saveToHistory, deleteClip, clearSelection])

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlayback()
          break
        case 'ArrowLeft':
          e.preventDefault()
          handleSeek(currentTime - 5)
          break
        case 'ArrowRight':
          e.preventDefault()
          handleSeek(currentTime + 5)
          break
        case 'Delete':
        case 'Backspace':
          if (selectedClipId) {
            e.preventDefault()
            handleDeleteSelectedClip()
          }
          break
        case 'KeyZ':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            if (e.shiftKey) {
              redo()
            } else {
              undo()
            }
          }
          break
        case 'KeyS':
          // Split clip at playhead (if not Cmd/Ctrl+S which is save)
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            handleSplitAtPlayhead()
          }
          break
        case 'Slash':
          // ? key (Shift + /)
          if (e.shiftKey) {
            e.preventDefault()
            setShowShortcutsModal(true)
          }
          break
        case 'KeyN':
          // N = new scene, Shift+N = new clip
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            if (e.shiftKey) {
              // New clip in current scene at playhead
              const sceneAtPlayhead = scenes.find((s: Scene) =>
                currentTime >= s.startTime && currentTime < s.endTime
              )
              if (sceneAtPlayhead) {
                saveToHistory()
                createClip(sceneAtPlayhead.id, currentTime, Math.min(currentTime + VEO_MAX_DURATION, sceneAtPlayhead.endTime))
                showToast('Clip created', 'success')
              } else {
                showToast('No scene at playhead position', 'error')
              }
            } else {
              // New scene at playhead
              saveToHistory()
              createScene()
              showToast('Scene created', 'success')
            }
          }
          break
        case 'KeyG':
          // G = open generation queue
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            setShowQueueModal(true)
          }
          break
        case 'KeyE':
          // Cmd/Ctrl+E = open export dialog
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            setShowExportDialog(true)
          }
          break
        case 'KeyM':
          // M = open media library
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            setShowMediaLibrary(true)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTime, selectedClipIds, isPlaying, scenes, togglePlayback, handleSeek, handleDeleteSelectedClip, handleSplitAtPlayhead, undo, redo, saveToHistory, createScene, createClip, showToast])

  // Get selected clip and its scene
  const selectedClip = clips.find((c: Clip) => c.id === selectedClipId)
  const selectedScene = selectedClip ? scenes.find((s: Scene) => s.id === selectedClip.sceneId) : null
  const selectedClipVideo = selectedClip?.video || (selectedClipId ? videos[`video-${selectedClipId}`] : null)

  // Auto-fill frame prompt when clip is selected
  useEffect(() => {
    if (!selectedClip || !selectedScene) {
      return
    }

    // Find the transcript segment for this clip
    const segment = transcript.find((s: TranscriptSegment) => s.id === selectedClip.segmentId)
    const clipText = segment?.text || selectedClip.title

    // Build prompt from scene context
    const parts: string[] = []

    // Add scene setting
    if (selectedScene.where) {
      parts.push(`Setting: ${selectedScene.where}`)
    }
    if (selectedScene.when) {
      parts.push(`Time: ${selectedScene.when}`)
    }

    // Add characters/subjects
    if (selectedScene.who && selectedScene.who.length > 0) {
      parts.push(`Featuring: ${selectedScene.who.join(', ')}`)
    }

    // Add action/mood
    if (selectedScene.what) {
      parts.push(`Action: ${selectedScene.what}`)
    }
    if (selectedScene.why) {
      parts.push(`Mood: ${selectedScene.why}`)
    }

    // Add the clip's specific content
    if (clipText) {
      parts.push(`Moment: "${clipText}"`)
    }

    // Add global style hint
    if (globalStyle) {
      parts.push(`Style: ${globalStyle}`)
    }

    const autoPrompt = parts.join('. ')
    setFramePrompt(autoPrompt)
  }, [selectedClipId, selectedClip, selectedScene, transcript, globalStyle])

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Hidden audio element */}
      {audioFile && <audio ref={audioRef} src={audioFile.url} preload="auto" />}

      {/* Header */}
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center cursor-pointer"
            onClick={() => router.push('/')}
          >
            <Music className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold">Radiostar</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            const isActive = step.id === currentStep
            const isPast = STEPS.findIndex((s) => s.id === currentStep) > i

            return (
              <div
                key={step.id}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
                  ${isActive ? 'bg-brand-500/20 text-brand-500' : ''}
                  ${isPast ? 'text-white/60' : ''}
                  ${!isActive && !isPast ? 'text-white/30' : ''}
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{step.label}</span>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-4 justify-end">
          {/* Queue indicator - always visible */}
          <button
            onClick={() => setShowQueueModal(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              generationQueue.items.length > 0
                ? 'bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/30'
                : 'bg-white/5 hover:bg-white/10 border border-white/10'
            }`}
            title="Generation queue (G)"
          >
            {generationQueue.isProcessing && !generationQueue.isPaused ? (
              <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
            ) : (
              <Layers className={`w-4 h-4 ${generationQueue.items.length > 0 ? 'text-brand-400' : 'text-white/60'}`} />
            )}
            {generationQueue.items.length > 0 ? (
              <span className="text-brand-400">
                {generationQueue.items.filter(i => i.status === 'complete').length}/
                {generationQueue.items.length}
              </span>
            ) : (
              <span className="text-white/60">Queue</span>
            )}
          </button>
          <button
            onClick={() => setShowMediaLibrary(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors"
            title="Media library (M)"
          >
            <FolderOpen className="w-4 h-4 text-white/60" />
            <span className="text-white/60">Library</span>
          </button>
          <StorageIndicator />
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-4 h-4 text-white/60" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Upper section: 3-column layout */}
        <div className="flex-1 flex min-h-0">
          {/* Left panel - Tabbed Properties */}
          <aside className="w-80 border-r border-white/10 flex flex-col flex-shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-white/10 flex-shrink-0">
              <button
                onClick={() => setLeftPanelTab('lyrics')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  leftPanelTab === 'lyrics'
                    ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-500/5'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                Lyrics {transcript.length > 0 && `(${transcript.length})`}
              </button>
              <button
                onClick={() => setLeftPanelTab('scenes')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  leftPanelTab === 'scenes'
                    ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-500/5'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                Scenes {scenes.length > 0 && `(${scenes.length})`}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
              {leftPanelTab === 'lyrics' ? (
                <div className="space-y-2">
                  {transcript.length === 0 ? (
                    <div className="text-center py-8">
                      <Music className="w-8 h-8 text-white/20 mx-auto mb-2" />
                      <p className="text-sm text-white/40">No lyrics yet</p>
                      <p className="text-xs text-white/30 mt-1">
                        {audioFile ? 'Transcribe audio to see lyrics' : 'Upload audio first'}
                      </p>
                    </div>
                  ) : (
                    transcript.map((segment: TranscriptSegment) => (
                      <div
                        key={segment.id}
                        className="p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
                        onClick={() => handleSeek(segment.start)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 uppercase">
                            {segment.type}
                          </span>
                          <span className="text-xs text-white/40">
                            {formatTime(segment.start)}
                          </span>
                        </div>
                        <p className="text-sm text-white/70 line-clamp-2">{segment.text}</p>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Add scene button */}
                  {audioFile && (
                    <button
                      onClick={() => {
                        saveToHistory()
                        createScene()
                        showToast('Scene created', 'success')
                      }}
                      className="w-full p-2 border border-dashed border-white/20 hover:border-white/40 rounded-lg text-sm text-white/50 hover:text-white/70 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Scene
                    </button>
                  )}

                  {scenes.length === 0 ? (
                    <div className="text-center py-8">
                      <Layers className="w-8 h-8 text-white/20 mx-auto mb-2" />
                      <p className="text-sm text-white/40">No scenes yet</p>
                      <p className="text-xs text-white/30 mt-1">
                        {audioFile
                          ? transcript.length > 0
                            ? 'Plan scenes from lyrics'
                            : 'Transcribe audio first'
                          : 'Upload audio first'
                        }
                      </p>
                    </div>
                  ) : (
                    scenes.map((scene: Scene) => {
                      const isExpanded = expandedSceneId === scene.id
                      const sceneClips = clips.filter((c: Clip) => c.sceneId === scene.id)
                      return (
                        <div
                          key={scene.id}
                          className="group rounded-lg bg-white/5 border border-white/10 overflow-hidden"
                        >
                          <div
                            className="p-3 cursor-pointer hover:bg-white/5 transition-colors flex items-start justify-between gap-2"
                            onClick={() => setExpandedSceneId(isExpanded ? null : scene.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium truncate text-sm">{scene.title}</p>
                                <span className="text-xs text-white/40 flex-shrink-0">
                                  {formatTime(scene.startTime)}
                                </span>
                              </div>
                              <p className="text-xs text-white/50 line-clamp-1">{scene.description}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSceneToDelete({ id: scene.id, clipCount: sceneClips.length })
                                }}
                                className="p-1 hover:bg-red-500/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete scene"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-white/40 hover:text-red-400" />
                              </button>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-white/40" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-white/40" />
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-3 pb-3 pt-1 border-t border-white/10 space-y-3">
                              {/* Editable 5 Ws */}
                              <div className="flex items-start gap-2">
                                <Users className="w-3.5 h-3.5 text-brand-400 mt-2 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs text-white/40 uppercase mb-1">Who</p>
                                  <input
                                    type="text"
                                    value={scene.who?.join(', ') || ''}
                                    onChange={(e) => updateScene(scene.id, { who: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                    placeholder="Characters/subjects..."
                                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500"
                                  />
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <Clapperboard className="w-3.5 h-3.5 text-brand-400 mt-2 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs text-white/40 uppercase mb-1">What</p>
                                  <input
                                    type="text"
                                    value={scene.what || ''}
                                    onChange={(e) => updateScene(scene.id, { what: e.target.value })}
                                    placeholder="Action/event..."
                                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500"
                                  />
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <Clock className="w-3.5 h-3.5 text-brand-400 mt-2 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs text-white/40 uppercase mb-1">When</p>
                                  <input
                                    type="text"
                                    value={scene.when || ''}
                                    onChange={(e) => updateScene(scene.id, { when: e.target.value })}
                                    placeholder="Time period..."
                                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500"
                                  />
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <MapPin className="w-3.5 h-3.5 text-brand-400 mt-2 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs text-white/40 uppercase mb-1">Where</p>
                                  <input
                                    type="text"
                                    value={scene.where || ''}
                                    onChange={(e) => updateScene(scene.id, { where: e.target.value })}
                                    placeholder="Location..."
                                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500"
                                  />
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <Heart className="w-3.5 h-3.5 text-brand-400 mt-2 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs text-white/40 uppercase mb-1">Why</p>
                                  <input
                                    type="text"
                                    value={scene.why || ''}
                                    onChange={(e) => updateScene(scene.id, { why: e.target.value })}
                                    placeholder="Mood/motivation..."
                                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500"
                                  />
                                </div>
                              </div>

                              {/* Clips in this scene */}
                              <div className="mt-3 pt-3 border-t border-white/10">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs text-white/40 uppercase">Clips ({sceneClips.length})</p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      saveToHistory()
                                      const newStart = sceneClips.length > 0
                                        ? sceneClips[sceneClips.length - 1].endTime
                                        : scene.startTime
                                      const newEnd = Math.min(newStart + VEO_MAX_DURATION, scene.endTime)
                                      if (newEnd > newStart) {
                                        createClip(scene.id, newStart, newEnd)
                                        showToast('Clip created', 'success')
                                      } else {
                                        showToast('No room for new clip in scene', 'error')
                                      }
                                    }}
                                    className="p-1 hover:bg-white/10 rounded transition-colors"
                                    title="Add clip to scene"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-white/60" />
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {sceneClips.map((clip: Clip) => {
                                    const isSelected = selectedClipIds.includes(clip.id)
                                    const startFrame = clip.startFrame || frames[`frame-${clip.id}-start`]
                                    const endFrame = clip.endFrame || frames[`frame-${clip.id}-end`]
                                    return (
                                      <div
                                        key={clip.id}
                                        className={`p-2 rounded text-xs cursor-pointer transition-colors ${
                                          isSelected
                                            ? 'bg-brand-500/20 border border-brand-500/50'
                                            : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          isSelected ? clearSelection() : selectClip(clip.id)
                                        }}
                                      >
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-white/70 truncate font-medium">{clip.title}</span>
                                          <span className="text-white/40 flex-shrink-0 ml-2">
                                            {(clip.endTime - clip.startTime).toFixed(1)}s
                                          </span>
                                        </div>
                                        {(startFrame || endFrame) && (
                                          <div className="flex gap-1 mt-2">
                                            {startFrame && (
                                              <div className="relative w-12 h-8 rounded overflow-hidden bg-white/10">
                                                <img
                                                  src={typeof startFrame === 'object' ? startFrame.url : ''}
                                                  alt="Start"
                                                  className="w-full h-full object-cover"
                                                />
                                                <span className="absolute bottom-0 left-0 text-[8px] bg-black/50 px-0.5">S</span>
                                              </div>
                                            )}
                                            {endFrame && (
                                              <div className="relative w-12 h-8 rounded overflow-hidden bg-white/10">
                                                <img
                                                  src={typeof endFrame === 'object' ? endFrame.url : ''}
                                                  alt="End"
                                                  className="w-full h-full object-cover"
                                                />
                                                <span className="absolute bottom-0 left-0 text-[8px] bg-black/50 px-0.5">E</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {sceneClips.length === 0 && (
                                    <p className="text-xs text-white/30 italic py-2">No clips yet</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* Center - Preview */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Preview area or Detail Panel */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              {selectedClip && selectedScene ? (
                <div className="w-full h-full max-w-4xl">
                  <DetailPanel
                    clip={selectedClip}
                    scene={selectedScene}
                    onClose={() => clearSelection()}
                    framePrompt={framePrompt}
                    setFramePrompt={setFramePrompt}
                    motionPrompt={motionPrompt}
                    setMotionPrompt={setMotionPrompt}
                  />
                </div>
              ) : (
                <div className="w-full max-w-3xl aspect-video bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
                  {!audioFile ? (
                    <label
                      className={`w-full h-full flex flex-col items-center justify-center cursor-pointer transition-colors rounded-xl ${
                        isDraggingAudio ? 'bg-brand-500/10' : 'hover:bg-white/5'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingAudio(true) }}
                      onDragLeave={() => setIsDraggingAudio(false)}
                      onDrop={handleAudioDrop}
                    >
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleAudioFileSelect}
                      />
                      {isLoadingAudio ? (
                        <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
                      ) : (
                        <Music className="w-12 h-12 text-white/20 mb-4" />
                      )}
                      <p className="text-lg text-white/60 font-medium">
                        {isLoadingAudio ? 'Loading audio...' : 'Drop your audio here'}
                      </p>
                      <p className="text-sm text-white/30 mt-2">
                        or click to browse
                      </p>
                    </label>
                  ) : transcript.length > 0 ? (
                    <div className="text-center p-8">
                      <p className="text-white/60 mb-2">
                        {transcript.find((s: TranscriptSegment) => s.start <= currentTime && s.end >= currentTime)?.text || 'Select a clip to edit'}
                      </p>
                      <p className="text-sm text-white/30">
                        Click a clip in the timeline to edit
                      </p>
                    </div>
                  ) : (
                    <p className="text-white/30">Transcribe audio to begin</p>
                  )}
                </div>
              )}
            </div>
          </div>

        {/* Right panel - Actions */}
        <aside className="w-80 border-l border-white/10 p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-6">
            {/* Workflow status info - shown during early stages */}
            {(currentStep === 'transcribe' || currentStep === 'plan') && (
              <div>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Workflow Progress
                </h3>
                <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
                  <p className="text-sm text-white/60">
                    {currentStep === 'transcribe'
                      ? 'Click "Transcribe" in the workflow bar above to analyze your audio'
                      : 'Click "Plan Scenes" in the workflow bar above to create scenes'}
                  </p>
                  <p className="text-xs text-white/30 mt-2">
                    {workflowStage === 'transcribing' && `Transcribing... ${workflowProgress.transcription}%`}
                    {workflowStage === 'planning' && `Planning... ${workflowProgress.planning}%`}
                    {workflowStage === 'audio_loaded' && 'Ready to transcribe'}
                    {workflowStage === 'transcribed' && 'Transcription complete - ready to plan scenes'}
                  </p>
                </div>
              </div>
            )}

            {(currentStep === 'generate' || currentStep === 'export') && (
              <div className="space-y-6">
                {/* Batch Generation */}
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                    Batch Generation
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        queueAllFrames('both')
                        setShowQueueModal(true)
                        startQueue()
                      }}
                      disabled={clips.length === 0}
                      className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate All Frames
                    </button>
                    <button
                      onClick={() => {
                        queueAllVideos()
                        setShowQueueModal(true)
                        startQueue()
                      }}
                      disabled={clips.length === 0}
                      className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Film className="w-4 h-4" />
                      Generate All Videos
                    </button>
                    <button
                      onClick={() => setShowQueueModal(true)}
                      className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/60 transition-colors flex items-center justify-center gap-2"
                    >
                      <Layers className="w-4 h-4" />
                      View Queue ({generationQueue.items.length})
                    </button>
                  </div>
                </div>

                {/* Selected clip info */}
                {selectedClip ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                        Selected Clip
                      </h3>
                      <button
                        onClick={() => clearSelection()}
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        <X className="w-3 h-3 text-white/40" />
                      </button>
                    </div>
                    <div className="p-3 rounded-lg bg-brand-500/10 border border-brand-500/30">
                      <p className="font-medium text-sm truncate">{selectedClip.title}</p>
                      <p className="text-xs text-white/50 mt-1">
                        {formatTime(selectedClip.startTime)} - {formatTime(selectedClip.endTime)}
                      </p>
                      {selectedScene && (
                        <p className="text-xs text-white/40 mt-1">Scene: {selectedScene.title}</p>
                      )}
                    </div>

                    {/* Frame Generation */}
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                        Generate Frame
                      </h4>
                      <textarea
                        value={framePrompt}
                        onChange={(e) => setFramePrompt(e.target.value)}
                        placeholder="Describe the frame... (e.g., 'Wide shot of singer on rooftop at sunset')"
                        className="w-full h-20 p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-500"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            if (selectedClipId) {
                              queueFrame(selectedClipId, 'start', framePrompt.trim() || undefined)
                              showToast('Start frame queued', 'success')
                            }
                          }}
                          disabled={isClipQueued(selectedClipId!, 'frame', 'start')}
                          className="flex-1 py-2 px-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {isClipQueued(selectedClipId!, 'frame', 'start') ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          {isClipQueued(selectedClipId!, 'frame', 'start') ? 'Queued' : 'Start Frame'}
                        </button>
                        <button
                          onClick={() => {
                            if (selectedClipId) {
                              queueFrame(selectedClipId, 'end', framePrompt.trim() || undefined)
                              showToast('End frame queued', 'success')
                            }
                          }}
                          disabled={isClipQueued(selectedClipId!, 'frame', 'end')}
                          className="flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {isClipQueued(selectedClipId!, 'frame', 'end') ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          {isClipQueued(selectedClipId!, 'frame', 'end') ? 'Queued' : 'End Frame'}
                        </button>
                      </div>

                      {/* Upload frames */}
                      <div className="mt-4">
                        <p className="text-xs text-white/40 uppercase mb-2">Or Upload</p>
                        <div className="flex gap-2">
                          <label className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-lg text-xs text-center cursor-pointer transition-colors">
                            <Upload className="w-4 h-4 mx-auto mb-1 text-white/40" />
                            Start
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file && selectedClipId) {
                                  const reader = new FileReader()
                                  reader.onload = () => {
                                    const frame: Frame = {
                                      id: `frame-${selectedClipId}-start-${Date.now()}`,
                                      clipId: selectedClipId,
                                      type: 'start',
                                      source: 'upload',
                                      url: reader.result as string,
                                    }
                                    setFrame(frame)
                                    updateClip(selectedClipId, { startFrame: frame })
                                  }
                                  reader.readAsDataURL(file)
                                }
                                e.target.value = ''
                              }}
                            />
                          </label>
                          <label className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-lg text-xs text-center cursor-pointer transition-colors">
                            <Upload className="w-4 h-4 mx-auto mb-1 text-white/40" />
                            End
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file && selectedClipId) {
                                  const reader = new FileReader()
                                  reader.onload = () => {
                                    const frame: Frame = {
                                      id: `frame-${selectedClipId}-end-${Date.now()}`,
                                      clipId: selectedClipId,
                                      type: 'end',
                                      source: 'upload',
                                      url: reader.result as string,
                                    }
                                    setFrame(frame)
                                    updateClip(selectedClipId, { endFrame: frame })
                                  }
                                  reader.readAsDataURL(file)
                                }
                                e.target.value = ''
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Generated frames preview */}
                      {(selectedClip.startFrame || selectedClip.endFrame) && (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          {selectedClip.startFrame && (
                            <div>
                              <p className="text-xs text-white/40 mb-1">Start Frame</p>
                              <div className="aspect-video rounded-lg overflow-hidden bg-white/5">
                                <img
                                  src={typeof selectedClip.startFrame === 'object' ? selectedClip.startFrame.url : ''}
                                  alt="Start frame"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          )}
                          {selectedClip.endFrame && (
                            <div>
                              <p className="text-xs text-white/40 mb-1">End Frame</p>
                              <div className="aspect-video rounded-lg overflow-hidden bg-white/5">
                                <img
                                  src={typeof selectedClip.endFrame === 'object' ? selectedClip.endFrame.url : ''}
                                  alt="End frame"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Video Generation */}
                      {selectedClip.startFrame && (
                        <div className="mt-6 pt-4 border-t border-white/10">
                          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                            Generate Video
                          </h4>
                          <textarea
                            value={motionPrompt}
                            onChange={(e) => setMotionPrompt(e.target.value)}
                            placeholder="Describe the motion... (e.g., 'Camera slowly zooms in, character turns head')"
                            className="w-full h-16 p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-500"
                          />
                          <button
                            onClick={() => {
                              if (selectedClipId) {
                                queueVideo(selectedClipId, motionPrompt.trim() || undefined)
                                showToast('Video queued', 'success')
                              }
                            }}
                            disabled={isClipQueued(selectedClipId!, 'video')}
                            className="w-full mt-2 py-3 px-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            {isClipQueued(selectedClipId!, 'video') ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Queued...
                              </>
                            ) : (
                              <>
                                <Video className="w-4 h-4" />
                                Generate Video Clip
                              </>
                            )}
                          </button>
                          {isClipQueued(selectedClipId!, 'video') && (
                            <p className="text-xs text-white/40 mt-2 text-center">
                              Added to queue. Check progress in the queue panel.
                            </p>
                          )}

                          {/* Video preview */}
                          {selectedClipVideo && (
                            <div className="mt-4">
                              <p className="text-xs text-white/40 mb-2">Generated Video</p>
                              <div className="aspect-video rounded-lg overflow-hidden bg-white/5">
                                <video
                                  src={typeof selectedClipVideo === 'object' ? selectedClipVideo.url : ''}
                                  controls
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                      Frame Generation
                    </h3>
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
                      <Image className="w-8 h-8 text-white/30 mx-auto mb-2" />
                      <p className="text-sm text-white/50">Select a clip to generate frames</p>
                      <p className="text-xs text-white/30 mt-1">Click on a clip in the left panel</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Export (shown when videos exist) */}
            {currentStep === 'export' && (
              <div>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Export Video
                </h3>
                <div className="space-y-4">
                  {/* Export stats */}
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-sm text-white/70">
                      {clipsWithVideos.length} video clip{clipsWithVideos.length !== 1 ? 's' : ''} ready
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      Total duration: {formatTime(audioFile?.duration || 0)}
                    </p>
                  </div>

                  {/* Platform presets preview */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-white/40">YouTube</p>
                      <p className="text-sm text-white">1080p</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-white/40">TikTok</p>
                      <p className="text-sm text-white">9:16</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-white/40">Instagram</p>
                      <p className="text-sm text-white">Reels</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-white/40">Twitter</p>
                      <p className="text-sm text-white">720p</p>
                    </div>
                  </div>

                  {/* Export button */}
                  <button
                    onClick={() => setShowExportDialog(true)}
                    disabled={clipsWithVideos.length === 0}
                    className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export Video
                  </button>

                  <p className="text-xs text-white/40 text-center">
                    Choose platform, resolution, and audio options
                  </p>
                </div>
              </div>
            )}

            {/* Visual style (shown after transcription) */}
            {transcript.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Visual Style
                </h3>
                <textarea
                  value={globalStyle}
                  onChange={(e) => setGlobalStyle(e.target.value)}
                  placeholder="Describe the visual style... (e.g., 'Neon-lit cyberpunk city at night')"
                  className="w-full h-24 p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-500"
                />
                <p className="text-xs text-white/40 mt-1">
                  Optional: AI will suggest a style if left blank
                </p>
              </div>
            )}

            {/* Model Settings */}
            <div>
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                AI Models
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 block mb-1">Image Generation</label>
                  <select
                    value={modelSettings.image}
                    onChange={(e) => setModelSettings({ image: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    {AVAILABLE_MODELS.image.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">Video Generation</label>
                  <select
                    value={modelSettings.video}
                    onChange={(e) => setModelSettings({ video: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    {AVAILABLE_MODELS.video.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} - {m.description}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </aside>
        </div>

        {/* Unified Timeline - full width at bottom */}
        <div className="h-[280px] flex-shrink-0 border-t border-white/10">
          {audioFile ? (
            <Timeline
              duration={audioFile.duration}
              currentTime={currentTime}
              onSeek={handleSeek}
              onClipSelect={selectClip}
              selectedClipIds={selectedClipIds}
              transcript={transcript}
              audioUrl={audioFile.url}
              isPlaying={isPlaying}
              onTogglePlayback={togglePlayback}
              onStartTranscription={startTranscription}
              onStartPlanning={startPlanning}
              onStartGeneration={() => {
                queueAllFrames('both')
                startQueue()
                setShowQueueModal(true)
              }}
            />
          ) : (
            <label
              className={`h-full flex flex-col items-center justify-center cursor-pointer transition-colors ${
                isDraggingAudio ? 'bg-brand-500/10' : 'bg-black/30 hover:bg-white/5'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingAudio(true) }}
              onDragLeave={() => setIsDraggingAudio(false)}
              onDrop={handleAudioDrop}
            >
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleAudioFileSelect}
              />
              <div className="text-center">
                <div className="flex items-center gap-2 text-white/30 mb-2">
                  <div className="w-8 h-4 rounded bg-white/10" />
                  <div className="w-12 h-4 rounded bg-white/10" />
                  <div className="w-6 h-4 rounded bg-white/10" />
                  <div className="w-10 h-4 rounded bg-white/10" />
                </div>
                <p className="text-sm text-white/40">
                  {isLoadingAudio ? 'Loading audio...' : 'Add audio to see timeline'}
                </p>
              </div>
            </label>
          )}
        </div>
      </main>

      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* Generation queue modal */}
      <GenerationQueue
        isOpen={showQueueModal}
        onClose={() => setShowQueueModal(false)}
      />

      {/* Export dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />

      {/* Media library */}
      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
      />

      {/* Scene delete confirmation */}
      <ConfirmDialog
        isOpen={sceneToDelete !== null}
        onClose={() => setSceneToDelete(null)}
        onConfirm={() => {
          if (sceneToDelete) {
            saveToHistory()
            // If scene has clips, delete them too (could also reassign)
            deleteSceneWithClips(sceneToDelete.id)
            showToast('Scene deleted', 'success')
          }
        }}
        title="Delete Scene"
        message={
          sceneToDelete?.clipCount
            ? `This scene contains ${sceneToDelete.clipCount} clip${sceneToDelete.clipCount > 1 ? 's' : ''}. Deleting the scene will also delete all its clips and any generated frames/videos.`
            : 'Are you sure you want to delete this scene?'
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Music, Upload, Layers, Download, Settings,
  Play, Pause, Loader2,
  Clapperboard, FolderOpen, LayoutGrid, Globe,
  AlignLeft, Camera,
} from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { Timeline } from '@/components/timeline'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal'
import { ProjectSwitcher } from '@/components/ui/ProjectSwitcher'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { GenerationQueuePanel, useQueueProcessor } from '@/components/ui/GenerationQueue'
import { ExportDialog } from '@/components/ui/ExportDialog'
import { MediaLibraryPanel } from '@/components/ui/MediaLibrary'
import { DetailPanel } from '@/components/studio/DetailPanel'
import { ElementsPanel } from '@/components/studio/ElementsPanel'
import { LyricsNavigator } from '@/components/studio/LyricsNavigator'
import { StoryboardView } from '@/components/studio/StoryboardView'
import { ScenesTab } from '@/components/studio/ScenesTab'
import { WorldElementDetailView } from '@/components/studio/WorldElementDetail'
import { LyricsPanel } from '@/components/studio/LyricsPanel'
import { CameraSettingsEditor } from '@/components/studio/CameraSettingsEditor'
import { useWorkflowAutomation } from '@/hooks/useWorkflowAutomation'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { formatTime } from '@/lib/utils'
import { AVAILABLE_MODELS } from '@/lib/gemini'
import { detectBeats } from '@/lib/beat-detection'
import type { TranscriptSegment, Scene, Clip } from '@/types'

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
    scenes,
    clips,
    updateClip,
    deleteClip,
    addClip,
    deleteSceneWithClips,
    createClip,
    generationQueue,
    queueAllFrames,
    queueAllVideos,
    startQueue,
    frames,
    videos,
    globalStyle,
    setGlobalStyle,
    modelSettings,
    setModelSettings,
    timeline,
    selectClip,
    clearSelection,
    saveToHistory,
    elements,
    getResolvedElementsForScene,
    setBeats,
    cameraSettings,
    setCameraSettings,
  } = useProjectStore()

  // Workflow automation
  const {
    startTranscription,
    startPlanning,
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
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<'library' | 'queue'>('library')
  const [showSettingsPopover, setShowSettingsPopover] = useState(false)
  const [centerTab, setCenterTab] = useState<'lyrics' | 'world' | 'scenes' | 'clips'>('lyrics')
  const [isDetectingBeats, setIsDetectingBeats] = useState(false)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)

  // Scene/Clip management state
  const [sceneToDelete, setSceneToDelete] = useState<{ id: string; clipCount: number } | null>(null)

  // Keep queue processing alive regardless of which tab is shown
  useQueueProcessor()

  // Check if any clips have videos generated
  const clipsWithVideos = clips.filter((c: Clip) => c.video || videos[`video-${c.id}`])
  const hasVideos = clipsWithVideos.length > 0

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
  }, [audioFile])

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
  useKeyboardShortcuts({
    currentTime,
    isPlaying,
    togglePlayback,
    handleSeek,
    handleDeleteSelectedClip,
    handleSplitAtPlayhead,
    setCenterTab,
    setRightPanelTab,
    setShowShortcutsModal,
    setShowExportDialog,
    showToast,
  })

  // Get selected clip and its scene
  const selectedClip = clips.find((c: Clip) => c.id === selectedClipId)
  const selectedScene = selectedClip?.sceneId ? scenes.find((s: Scene) => s.id === selectedClip.sceneId) : null
  // Auto-fill frame prompt when clip is selected
  useEffect(() => {
    if (!selectedClip) return

    // Find the transcript segment for this clip
    const segment = selectedClip.segmentId
      ? transcript.find((s: TranscriptSegment) => s.id === selectedClip.segmentId)
      : undefined
    const clipText = segment?.text || selectedClip.title

    const parts: string[] = []

    if (selectedScene) {
      // Build prompt from resolved elements
      const resolvedElements = getResolvedElementsForScene(selectedScene.id)

      if (resolvedElements.length > 0) {
        // Group by category
        const byCategory: Record<string, typeof resolvedElements> = {}
        for (const el of resolvedElements) {
          ;(byCategory[el.category] = byCategory[el.category] || []).push(el)
        }

        if (byCategory.where) parts.push(`Setting: ${byCategory.where.map(e => e.overrideDescription || e.description || e.name).join('; ')}`)
        if (byCategory.when) parts.push(`Time: ${byCategory.when.map(e => e.overrideDescription || e.description || e.name).join('; ')}`)
        if (byCategory.who) parts.push(`Featuring: ${byCategory.who.map(e => e.name).join(', ')}`)
        if (byCategory.what) parts.push(`Action: ${byCategory.what.map(e => e.overrideDescription || e.description || e.name).join('; ')}`)
        if (byCategory.why) parts.push(`Mood: ${byCategory.why.map(e => e.overrideDescription || e.description || e.name).join('; ')}`)
      } else {
        // Fallback to legacy fields
        if (selectedScene.where) parts.push(`Setting: ${selectedScene.where}`)
        if (selectedScene.when) parts.push(`Time: ${selectedScene.when}`)
        if (selectedScene.who?.length) parts.push(`Featuring: ${selectedScene.who.join(', ')}`)
        if (selectedScene.what) parts.push(`Action: ${selectedScene.what}`)
        if (selectedScene.why) parts.push(`Mood: ${selectedScene.why}`)
      }
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
    setDefaultPrompt(autoPrompt)
  }, [selectedClipId, selectedClip, selectedScene, transcript, globalStyle, elements, getResolvedElementsForScene])

  return (
    <div
      className="h-screen flex flex-col bg-black"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          if (!audioFile) setIsDraggingAudio(true)
        }
      }}
      onDragLeave={(e) => {
        // Only reset when leaving the root element
        if (e.currentTarget === e.target) setIsDraggingAudio(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsDraggingAudio(false)
        const file = e.dataTransfer.files[0]
        if (file && file.type.startsWith('audio/')) {
          processAudioFile(file)
        }
      }}
    >
      {/* Hidden audio element */}
      {audioFile && <audio ref={audioRef} src={audioFile.url} preload="auto" />}

      {/* Page-level drag overlay */}
      {isDraggingAudio && !audioFile && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-brand-500/60 rounded-2xl p-12 text-center">
            <Music className="w-16 h-16 text-brand-400 mx-auto mb-4" />
            <p className="text-xl text-white/80 font-medium">Drop your audio file</p>
            <p className="text-sm text-white/40 mt-2">MP3, WAV, FLAC, etc.</p>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Upper section: 3-column layout */}
        <div className="flex-1 flex min-h-0">
          {/* Left panel - Tabbed Properties */}
          <aside className="w-80 border-r border-white/10 flex flex-col flex-shrink-0 min-h-0">
            {/* Brand + Project Switcher + Export/Settings */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 flex-shrink-0">
              <div
                className="w-7 h-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center cursor-pointer flex-shrink-0"
                onClick={() => router.push('/')}
                title="Home"
              >
                <Music className="w-3.5 h-3.5 text-white" />
              </div>
              <ProjectSwitcher />
              <div className="ml-auto flex items-center gap-1">
                {hasVideos && (
                  <button
                    onClick={() => setShowExportDialog(true)}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
                    title="Export video (⌘E)"
                  >
                    <Download className="w-4 h-4 text-white/50" />
                  </button>
                )}
                <div className="relative">
                  <button
                    onClick={() => setShowSettingsPopover(!showSettingsPopover)}
                    className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                      showSettingsPopover ? 'bg-white/10' : 'hover:bg-white/10'
                    }`}
                    title="AI model settings"
                  >
                    <Settings className="w-4 h-4 text-white/50" />
                  </button>
                  {showSettingsPopover && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSettingsPopover(false)} />
                      <div className="absolute right-0 top-full mt-1 w-64 bg-neutral-900 border border-white/10 rounded-lg shadow-xl z-50 p-3 space-y-3">
                        <p className="text-xs font-semibold text-white/40 uppercase">AI Models</p>
                        <div>
                          <label className="text-xs text-white/40 block mb-1">Image Generation</label>
                          <select
                            value={modelSettings.image}
                            onChange={(e) => setModelSettings({ image: e.target.value })}
                            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-brand-500"
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
                            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-brand-500"
                          >
                            {AVAILABLE_MODELS.video.map((m) => (
                              <option key={m.id} value={m.id}>{m.name} - {m.description}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Song */}
            <div className="px-3 py-2.5 border-b border-white/10 flex-shrink-0">
              {audioFile ? (
                <div className="flex items-center gap-3 group">
                  <button
                    onClick={togglePlayback}
                    className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0 hover:brightness-110 transition-all shadow-lg shadow-brand-500/20"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 text-white" />
                    ) : (
                      <Play className="w-4 h-4 text-white ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{audioFile.name.replace(/\.[^/.]+$/, '')}</p>
                    <p className="text-[11px] text-white/40">{formatTime(audioFile.duration)}</p>
                  </div>
                  <label className="p-1.5 hover:bg-white/10 rounded-md cursor-pointer transition-colors opacity-0 group-hover:opacity-100" title="Replace audio">
                    <Upload className="w-3.5 h-3.5 text-white/40" />
                    <input type="file" accept="audio/*" className="hidden" onChange={handleAudioFileSelect} />
                  </label>
                </div>
              ) : (
                <label
                  className={`flex items-center gap-3 cursor-pointer rounded-lg p-2 -m-2 transition-colors ${
                    isDraggingAudio ? 'bg-brand-500/10' : 'hover:bg-white/5'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingAudio(true) }}
                  onDragLeave={() => setIsDraggingAudio(false)}
                  onDrop={handleAudioDrop}
                >
                  <input type="file" accept="audio/*" className="hidden" onChange={handleAudioFileSelect} />
                  <div className="w-9 h-9 rounded-lg border border-dashed border-white/20 flex items-center justify-center flex-shrink-0">
                    {isLoadingAudio ? (
                      <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                    ) : (
                      <Music className="w-4 h-4 text-white/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/50">{isLoadingAudio ? 'Loading...' : 'Add a song'}</p>
                    <p className="text-[11px] text-white/30">Drop audio or click to browse</p>
                  </div>
                </label>
              )}
            </div>

            {/* Lyrics navigator — always visible */}
            <div className="flex-1 overflow-y-auto p-4">
              <LyricsNavigator onSeek={handleSeek} currentTime={currentTime} />
            </div>

          </aside>

          {/* Center - Tab-driven workspace */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Center tab bar */}
            <div className="flex border-b border-white/10 flex-shrink-0">
              {([
                { id: 'lyrics' as const, icon: AlignLeft, label: 'Lyrics', count: transcript.length },
                { id: 'scenes' as const, icon: Clapperboard, label: 'Scenes', count: scenes.length },
                { id: 'world' as const, icon: Globe, label: 'World', count: elements.length },
                { id: 'clips' as const, icon: LayoutGrid, label: 'Clips', count: clips.length },
              ]).map(({ id, icon: Icon, label, count }) => (
                <button
                  key={id}
                  onClick={() => setCenterTab(id)}
                  className={`px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    centerTab === id
                      ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-500/5'
                      : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label} {count > 0 && `(${count})`}
                </button>
              ))}
            </div>

            {/* Center content — priority: clip selected → detail, then tab-driven */}
            <div className="flex-1 flex overflow-hidden">
              {selectedClip ? (
                /* Clip selected — always show DetailPanel regardless of tab */
                <div className="w-full h-full max-w-4xl mx-auto p-4">
                  <DetailPanel
                    clip={selectedClip}
                    scene={selectedScene ?? undefined}
                    onClose={() => clearSelection()}
                    defaultPrompt={defaultPrompt}
                  />
                </div>
              ) : centerTab === 'lyrics' ? (
                /* Lyrics tab — full editor */
                !audioFile ? (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <label
                      className={`w-full max-w-3xl aspect-video rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        isDraggingAudio ? 'bg-brand-500/10 border-brand-500/40' : 'hover:bg-white/5'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingAudio(true) }}
                      onDragLeave={() => setIsDraggingAudio(false)}
                      onDrop={handleAudioDrop}
                    >
                      <input type="file" accept="audio/*" className="hidden" onChange={handleAudioFileSelect} />
                      {isLoadingAudio ? (
                        <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
                      ) : (
                        <Music className="w-12 h-12 text-white/20 mb-4" />
                      )}
                      <p className="text-lg text-white/60 font-medium">
                        {isLoadingAudio ? 'Loading audio...' : 'Drop your audio here'}
                      </p>
                      <p className="text-sm text-white/30 mt-2">or click to browse</p>
                    </label>
                  </div>
                ) : (
                  <div className="w-full h-full overflow-y-auto p-4">
                    <div className="max-w-3xl mx-auto">
                      <LyricsPanel onSeek={handleSeek} currentTime={currentTime} />
                    </div>
                  </div>
                )
              ) : centerTab === 'scenes' ? (
                <ScenesTab
                  expandedSceneId={expandedSceneId}
                  setExpandedSceneId={setExpandedSceneId}
                  onDeleteScene={(id, clipCount) => setSceneToDelete({ id, clipCount })}
                  onSwitchToQueue={() => setRightPanelTab('queue')}
                />
              ) : centerTab === 'clips' ? (
                /* Clips tab (was Storyboard) */
                clips.length > 0 ? (
                  <div className="w-full h-full p-4">
                    <StoryboardView
                      clips={clips}
                      scenes={scenes}
                      frames={frames}
                      selectedClipIds={selectedClipIds}
                      onSelectClip={(clipId) => selectClip(clipId)}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <LayoutGrid className="w-12 h-12 text-white/10 mx-auto mb-4" />
                      <p className="text-white/40">No clips yet</p>
                      <p className="text-sm text-white/25 mt-1">Create scenes and add clips to see the storyboard</p>
                    </div>
                  </div>
                )
              ) : centerTab === 'world' ? (
                /* World tab — side-by-side when element selected */
                <div className="w-full h-full flex overflow-hidden">
                  <div className={`${selectedElementId && elements.find(e => e.id === selectedElementId) ? 'w-80 flex-shrink-0 border-r border-white/10' : 'flex-1'} overflow-y-auto p-4`}>
                    <div className={selectedElementId && elements.find(e => e.id === selectedElementId) ? '' : 'max-w-2xl mx-auto'}>
                      <ElementsPanel
                        onSelectElement={(id) => setSelectedElementId(id)}
                        selectedElementId={selectedElementId}
                        globalStyle={globalStyle}
                        onStyleChange={setGlobalStyle}
                        showStyle={transcript.length > 0}
                      />
                      {/* Global camera & film settings */}
                      <div className="mt-6 pt-6 border-t border-white/10">
                        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5" />
                          Camera & Film
                        </h3>
                        <CameraSettingsEditor
                          settings={cameraSettings}
                          onChange={setCameraSettings}
                        />
                      </div>
                    </div>
                  </div>
                  {selectedElementId && elements.find(e => e.id === selectedElementId) && (
                    <div className="flex-1 overflow-y-auto p-4">
                      <WorldElementDetailView
                        elementId={selectedElementId}
                        onClose={() => setSelectedElementId(null)}
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

        {/* Right panel - Library/Queue */}
        <aside className="w-80 border-l border-white/10 flex flex-col flex-shrink-0 min-h-0">
          {/* Tab header */}
          <div className="flex border-b border-white/10 flex-shrink-0">
            <button
              onClick={() => setRightPanelTab('library')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                rightPanelTab === 'library'
                  ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-500/5'
                  : 'text-white/50 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Library
            </button>
            <button
              onClick={() => setRightPanelTab('queue')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                rightPanelTab === 'queue'
                  ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-500/5'
                  : 'text-white/50 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              {generationQueue.isProcessing && !generationQueue.isPaused ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Layers className="w-3.5 h-3.5" />
              )}
              Queue
              {generationQueue.items.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  generationQueue.isProcessing
                    ? 'bg-brand-500/30 text-brand-400'
                    : 'bg-white/10 text-white/50'
                }`}>
                  {generationQueue.items.filter(i => i.status === 'complete').length}/{generationQueue.items.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {rightPanelTab === 'library' ? (
              <MediaLibraryPanel />
            ) : (
              <GenerationQueuePanel />
            )}
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
                setRightPanelTab('queue')
              }}
              onDetectBeats={async () => {
                if (!audioFile?.url) return
                setIsDetectingBeats(true)
                try {
                  const response = await fetch(audioFile.url)
                  const buffer = await response.arrayBuffer()
                  const beats = await detectBeats(buffer)
                  setBeats(beats)
                  showToast(`${beats.length} beats detected`, 'success')
                } catch {
                  showToast('Beat detection failed', 'error')
                } finally {
                  setIsDetectingBeats(false)
                }
              }}
              isDetectingBeats={isDetectingBeats}
              onAutoCutBeats={() => {
                if (!audioFile?.beats || audioFile.beats.length === 0 || scenes.length === 0) return
                saveToHistory()
                let created = 0
                for (const scene of scenes) {
                  const sceneBeats = audioFile.beats!.filter(
                    (b: number) => b >= scene.startTime && b < scene.endTime
                  )
                  if (sceneBeats.length < 2) continue
                  for (let i = 0; i < sceneBeats.length - 1; i++) {
                    const start = sceneBeats[i]
                    const end = sceneBeats[i + 1]
                    if (end - start >= 0.5) {
                      createClip(start, end, undefined, scene.id)
                      created++
                    }
                  }
                }
                showToast(`${created} clips created on beats`, 'success')
              }}
              canAutoCutBeats={!!(audioFile?.beats && audioFile.beats.length > 0 && scenes.length > 0)}
              beatCount={audioFile?.beats?.length}
              onQueueAllFrames={() => {
                queueAllFrames('both')
                startQueue()
                setRightPanelTab('queue')
              }}
              onQueueAllVideos={() => {
                queueAllVideos()
                startQueue()
                setRightPanelTab('queue')
              }}
              onShowQueue={() => setRightPanelTab('queue')}
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

      {/* Generation queue processing is handled by useQueueProcessor() hook */}

      {/* Export dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />

      {/* Media library is now inline in right sidebar */}

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
            ? `This scene contains ${sceneToDelete.clipCount} clip${sceneToDelete.clipCount > 1 ? 's' : ''}. They will become free-floating (unassociated with any scene).`
            : 'Are you sure you want to delete this scene?'
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}

'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Music, Upload, Layers, Film, Download,
  Play, Pause, Loader2, ChevronRight, ChevronDown, ChevronUp,
  Users, Clapperboard, Clock, MapPin, Heart, Image, Sparkles, X
} from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { Waveform } from '@/components/ui/Waveform'
import { formatTime } from '@/lib/utils'
import type { TranscriptSegment, Scene, Clip, Frame } from '@/types'

type Step = 'upload' | 'transcribe' | 'plan' | 'generate' | 'export'

const STEPS: { id: Step; label: string; icon: typeof Music }[] = [
  { id: 'upload', label: 'Audio', icon: Upload },
  { id: 'transcribe', label: 'Transcribe', icon: Music },
  { id: 'plan', label: 'Plan', icon: Layers },
  { id: 'generate', label: 'Generate', icon: Film },
  { id: 'export', label: 'Export', icon: Download },
]

export default function StudioPage() {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement>(null)
  const {
    audioFile,
    transcript,
    setTranscript,
    scenes,
    setScenes,
    updateScene,
    clips,
    setClips,
    updateClip,
    frames,
    setFrame,
    globalStyle,
    setGlobalStyle,
  } = useProjectStore()

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)
  const [isPlanning, setIsPlanning] = useState(false)
  const [planningError, setPlanningError] = useState<string | null>(null)
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [framePrompt, setFramePrompt] = useState('')
  const [isGeneratingFrame, setIsGeneratingFrame] = useState(false)
  const [frameError, setFrameError] = useState<string | null>(null)
  const [generatingFrameType, setGeneratingFrameType] = useState<'start' | 'end'>('start')

  // Determine current step based on state
  const currentStep: Step = !audioFile
    ? 'upload'
    : transcript.length === 0
    ? 'transcribe'
    : scenes.length === 0
    ? 'plan'
    : 'generate'

  // Redirect to home if no audio
  useEffect(() => {
    if (!audioFile) {
      const timeout = setTimeout(() => {
        if (!useProjectStore.getState().audioFile) {
          router.push('/')
        }
      }, 500)
      return () => clearTimeout(timeout)
    }
  }, [audioFile, router])

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

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (time: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = time
    setCurrentTime(time)
  }

  const handleTranscribe = async () => {
    if (!audioFile?.file) return

    setIsTranscribing(true)
    setTranscriptionError(null)

    try {
      const formData = new FormData()
      formData.append('audio', audioFile.file)

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Transcription API error:', data)
        throw new Error(data.details || data.error || 'Transcription failed')
      }

      if (data.segments) {
        setTranscript(data.segments as TranscriptSegment[])
      }
    } catch (error) {
      console.error('Transcription error:', error)
      setTranscriptionError('Failed to transcribe audio. Please try again.')
    } finally {
      setIsTranscribing(false)
    }
  }

  const handlePlanScenes = async () => {
    if (transcript.length === 0) return

    setIsPlanning(true)
    setPlanningError(null)

    try {
      const response = await fetch('/api/plan-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          style: globalStyle,
          duration: audioFile?.duration,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Scene planning API error:', data)
        throw new Error(data.details || data.error || 'Scene planning failed')
      }

      if (data.scenes) {
        const newScenes = data.scenes as Scene[]
        setScenes(newScenes)

        // Auto-generate clips from transcript segments mapped to scenes
        const newClips = transcript.flatMap((segment, segIndex) => {
          // Find which scene this segment belongs to based on time overlap
          const matchingScene = newScenes.find(scene =>
            segment.start >= scene.startTime && segment.start < scene.endTime
          ) || newScenes.find(scene =>
            // Fallback: find scene that overlaps with segment
            segment.start < scene.endTime && segment.end > scene.startTime
          )

          if (!matchingScene) return []

          return [{
            id: `clip-${segment.id}`,
            sceneId: matchingScene.id,
            segmentId: segment.id,
            title: `${segment.type.charAt(0).toUpperCase() + segment.type.slice(1)} - ${segment.text.slice(0, 30)}...`,
            startTime: segment.start,
            endTime: segment.end,
            order: segIndex,
          }]
        })

        setClips(newClips)
      }
      if (data.globalStyle && !globalStyle) {
        setGlobalStyle(data.globalStyle)
      }
    } catch (error) {
      console.error('Scene planning error:', error)
      setPlanningError('Failed to plan scenes. Please try again.')
    } finally {
      setIsPlanning(false)
    }
  }

  const handleGenerateFrame = async (type: 'start' | 'end') => {
    if (!selectedClipId || !framePrompt.trim()) return

    const clip = clips.find(c => c.id === selectedClipId)
    if (!clip) return

    const scene = scenes.find(s => s.id === clip.sceneId)

    setIsGeneratingFrame(true)
    setGeneratingFrameType(type)
    setFrameError(null)

    try {
      const response = await fetch('/api/generate-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: framePrompt,
          clipId: selectedClipId,
          type,
          scene,
          globalStyle,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Frame generation failed')
      }

      if (data.frame) {
        setFrame(data.frame as Frame)
        // Update clip with frame reference
        updateClip(selectedClipId, {
          [type === 'start' ? 'startFrame' : 'endFrame']: data.frame,
        })
      }
    } catch (error) {
      console.error('Frame generation error:', error)
      setFrameError(error instanceof Error ? error.message : 'Failed to generate frame')
    } finally {
      setIsGeneratingFrame(false)
    }
  }

  // Get selected clip and its scene
  const selectedClip = clips.find(c => c.id === selectedClipId)
  const selectedScene = selectedClip ? scenes.find(s => s.id === selectedClip.sceneId) : null

  if (!audioFile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioFile.url} preload="auto" />

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

        <div className="w-24" />
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left panel - Properties */}
        <aside className="w-80 border-r border-white/10 p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-6">
            {/* Audio info */}
            <div>
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Audio
              </h3>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="font-medium truncate">{audioFile.name}</p>
                <p className="text-sm text-white/40 mt-1">
                  {formatTime(audioFile.duration)}
                </p>
              </div>
            </div>

            {/* Transcript segments */}
            {transcript.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Transcript ({transcript.length} segments)
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {transcript.map((segment) => (
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
                  ))}
                </div>
              </div>
            )}

            {/* Scenes */}
            {scenes.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Scenes ({scenes.length})
                </h3>
                <div className="space-y-2">
                  {scenes.map((scene) => {
                    const isExpanded = expandedSceneId === scene.id
                    return (
                      <div
                        key={scene.id}
                        className="rounded-lg bg-white/5 border border-white/10 overflow-hidden"
                      >
                        <div
                          className="p-3 cursor-pointer hover:bg-white/5 transition-colors flex items-start justify-between gap-2"
                          onClick={() => setExpandedSceneId(isExpanded ? null : scene.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{scene.title}</p>
                              <span className="text-xs text-white/40 flex-shrink-0">
                                {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
                              </span>
                            </div>
                            <p className="text-xs text-white/50 line-clamp-1">{scene.description}</p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-white/40 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
                          )}
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
                            {(() => {
                              const sceneClips = clips.filter(c => c.sceneId === scene.id)
                              if (sceneClips.length === 0) return null
                              return (
                                <div className="mt-3 pt-3 border-t border-white/10">
                                  <p className="text-xs text-white/40 uppercase mb-2">Clips ({sceneClips.length})</p>
                                  <div className="space-y-2">
                                    {sceneClips.map(clip => {
                                      const isSelected = selectedClipId === clip.id
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
                                            setSelectedClipId(isSelected ? null : clip.id)
                                          }}
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-white/70 truncate font-medium">{clip.title}</span>
                                            <span className="text-white/40 flex-shrink-0 ml-2">
                                              {formatTime(clip.startTime)}
                                            </span>
                                          </div>
                                          {/* Frame thumbnails */}
                                          {(startFrame || endFrame) && (
                                            <div className="flex gap-1 mt-2">
                                              {startFrame && (
                                                <div className="relative w-12 h-8 rounded overflow-hidden bg-white/10">
                                                  <img
                                                    src={typeof startFrame === 'object' ? startFrame.url : ''}
                                                    alt="Start frame"
                                                    className="w-full h-full object-cover"
                                                  />
                                                  <span className="absolute bottom-0 left-0 text-[8px] bg-black/50 px-0.5">S</span>
                                                </div>
                                              )}
                                              {endFrame && (
                                                <div className="relative w-12 h-8 rounded overflow-hidden bg-white/10">
                                                  <img
                                                    src={typeof endFrame === 'object' ? endFrame.url : ''}
                                                    alt="End frame"
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
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Center - Preview / Timeline */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Preview area */}
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-3xl aspect-video bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
              {transcript.length > 0 ? (
                <div className="text-center p-8">
                  <p className="text-white/60 mb-2">
                    {transcript.find(s => s.start <= currentTime && s.end >= currentTime)?.text || 'Ready for scene planning'}
                  </p>
                  <p className="text-sm text-white/30">
                    {formatTime(currentTime)} / {formatTime(audioFile.duration)}
                  </p>
                </div>
              ) : (
                <p className="text-white/30">Transcribe audio to begin</p>
              )}
            </div>
          </div>

          {/* Waveform & Controls */}
          <div className="border-t border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={togglePlayback}
                className="w-10 h-10 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white ml-0.5" />
                )}
              </button>
              <span className="text-sm text-white/60 font-mono w-24">
                {formatTime(currentTime)} / {formatTime(audioFile.duration)}
              </span>
            </div>

            <Waveform
              audioUrl={audioFile.url}
              currentTime={currentTime}
              duration={audioFile.duration}
              onSeek={handleSeek}
              className="h-20"
            />
          </div>
        </div>

        {/* Right panel - Actions */}
        <aside className="w-80 border-l border-white/10 p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-6">
            {currentStep === 'transcribe' && (
              <div>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Transcription
                </h3>
                <button
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      Start Transcription
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className="text-xs text-white/40 mt-2">
                  Analyze audio for word-level timestamps and segment detection
                </p>
                {transcriptionError && (
                  <p className="text-xs text-red-400 mt-2">{transcriptionError}</p>
                )}
              </div>
            )}

            {currentStep === 'plan' && (
              <div>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Scene Planning
                </h3>
                <button
                  onClick={handlePlanScenes}
                  disabled={isPlanning}
                  className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isPlanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Planning...
                    </>
                  ) : (
                    <>
                      Plan Scenes with AI
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className="text-xs text-white/40 mt-2">
                  Break down the song into visual scenes with the 5 Ws
                </p>
                {planningError && (
                  <p className="text-xs text-red-400 mt-2">{planningError}</p>
                )}
              </div>
            )}

            {currentStep === 'generate' && (
              <div className="space-y-6">
                {/* Selected clip info */}
                {selectedClip ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                        Selected Clip
                      </h3>
                      <button
                        onClick={() => setSelectedClipId(null)}
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
                          onClick={() => handleGenerateFrame('start')}
                          disabled={isGeneratingFrame || !framePrompt.trim()}
                          className="flex-1 py-2 px-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {isGeneratingFrame && generatingFrameType === 'start' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          Start Frame
                        </button>
                        <button
                          onClick={() => handleGenerateFrame('end')}
                          disabled={isGeneratingFrame || !framePrompt.trim()}
                          className="flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {isGeneratingFrame && generatingFrameType === 'end' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          End Frame
                        </button>
                      </div>
                      {frameError && (
                        <p className="text-xs text-red-400 mt-2">{frameError}</p>
                      )}

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
          </div>
        </aside>
      </main>
    </div>
  )
}

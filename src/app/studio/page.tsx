'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Music, Upload, Layers, Film, Download,
  Play, Pause, Loader2, ChevronRight
} from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { Waveform } from '@/components/ui/Waveform'
import { formatTime } from '@/lib/utils'
import type { TranscriptSegment } from '@/types'

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
  const { audioFile, transcript, setTranscript, scenes } = useProjectStore()

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)

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
                  {scenes.map((scene) => (
                    <div
                      key={scene.id}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:border-white/20"
                    >
                      <p className="font-medium">{scene.title}</p>
                      <p className="text-xs text-white/40 mt-1 line-clamp-2">{scene.description}</p>
                    </div>
                  ))}
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
                <button className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                  Plan Scenes with AI
                  <ChevronRight className="w-4 h-4" />
                </button>
                <p className="text-xs text-white/40 mt-2">
                  Break down the song into visual scenes with the 5 Ws
                </p>
              </div>
            )}

            {currentStep === 'generate' && (
              <div>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Generation
                </h3>
                <div className="space-y-2">
                  <button className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors">
                    Generate Frames
                  </button>
                  <button className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors">
                    Generate Videos
                  </button>
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
                  placeholder="Describe the visual style... (e.g., 'Neon-lit cyberpunk city at night')"
                  className="w-full h-24 p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-500"
                />
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}

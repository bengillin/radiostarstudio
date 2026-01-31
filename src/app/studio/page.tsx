'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Music, Upload, Layers, Film, Download } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'

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
  const { audioFile, transcript, scenes } = useProjectStore()

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
      // Give a moment for store to rehydrate
      const timeout = setTimeout(() => {
        if (!useProjectStore.getState().audioFile) {
          router.push('/')
        }
      }, 500)
      return () => clearTimeout(timeout)
    }
  }, [audioFile, router])

  if (!audioFile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-white/40">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
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
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
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

        <div className="w-24" /> {/* Spacer for centering */}
      </header>

      {/* Main content */}
      <main className="flex-1 flex">
        {/* Left panel - Properties */}
        <aside className="w-80 border-r border-white/10 p-4 overflow-y-auto">
          <div className="space-y-6">
            {/* Audio info */}
            <div>
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Audio
              </h3>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="font-medium truncate">{audioFile.name}</p>
                <p className="text-sm text-white/40 mt-1">
                  {audioFile.duration > 0
                    ? `${Math.floor(audioFile.duration / 60)}:${Math.floor(audioFile.duration % 60).toString().padStart(2, '0')}`
                    : 'Loading...'}
                </p>
              </div>
            </div>

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
                      <p className="text-xs text-white/40 mt-1">{scene.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Center - Preview / Timeline */}
        <div className="flex-1 flex flex-col">
          {/* Preview area */}
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-3xl aspect-video bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
              <p className="text-white/30">Preview</p>
            </div>
          </div>

          {/* Timeline placeholder */}
          <div className="h-48 border-t border-white/10 bg-white/5 p-4">
            <div className="h-full rounded-lg border border-dashed border-white/20 flex items-center justify-center">
              <p className="text-white/30">Timeline - Coming in Phase 5</p>
            </div>
          </div>
        </div>

        {/* Right panel - Actions */}
        <aside className="w-80 border-l border-white/10 p-4 overflow-y-auto">
          <div className="space-y-6">
            {currentStep === 'transcribe' && (
              <div>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Transcription
                </h3>
                <button className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 rounded-lg font-medium transition-colors">
                  Start Transcription
                </button>
                <p className="text-xs text-white/40 mt-2">
                  Analyze audio for word-level timestamps
                </p>
              </div>
            )}

            {currentStep === 'plan' && (
              <div>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Scene Planning
                </h3>
                <button className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 rounded-lg font-medium transition-colors">
                  Plan Scenes with AI
                </button>
                <p className="text-xs text-white/40 mt-2">
                  Break down the song into visual scenes
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
          </div>
        </aside>
      </main>
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Music, Sparkles, ArrowRight, Loader2 } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'

export default function Home() {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { setAudioFile } = useProjectStore()

  const processAudioFile = useCallback(async (file: File) => {
    setIsLoading(true)
    const url = URL.createObjectURL(file)

    // Get audio duration
    const audio = new Audio(url)
    await new Promise<void>((resolve) => {
      audio.onloadedmetadata = () => resolve()
      audio.onerror = () => resolve()
    })

    const duration = audio.duration || 0

    setAudioFile({
      id: crypto.randomUUID(),
      name: file.name,
      url,
      duration,
      file,
    })

    router.push('/studio')
  }, [setAudioFile, router])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      processAudioFile(file)
    }
  }, [processAudioFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('audio/')) {
      processAudioFile(file)
    }
  }, [processAudioFile])

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl">Radiostar</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-display font-bold mb-6 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            Video killed the radio star.
            <br />
            <span className="text-brand-500">Make more.</span>
          </h1>
          <p className="text-lg text-white/60 max-w-lg mx-auto">
            Transform your audio into fully visualized music videos with AI-powered scene planning, frame generation, and timeline editing.
          </p>
        </div>

        {/* Upload Zone */}
        <div
          className={`
            relative w-full max-w-xl aspect-video rounded-2xl border-2 border-dashed
            transition-all duration-200 cursor-pointer
            ${isDragging
              ? 'border-brand-500 bg-brand-500/10'
              : 'border-white/20 hover:border-white/40 bg-white/5'
            }
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            {isLoading ? (
              <>
                <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
                <p className="font-medium text-white/80">Loading audio...</p>
              </>
            ) : (
              <>
                <div className={`
                  w-16 h-16 rounded-full flex items-center justify-center transition-colors
                  ${isDragging ? 'bg-brand-500/20' : 'bg-white/10'}
                `}>
                  <Upload className={`w-8 h-8 ${isDragging ? 'text-brand-500' : 'text-white/60'}`} />
                </div>
                <div className="text-center">
                  <p className="font-medium text-white/80">
                    Drop your audio file here
                  </p>
                  <p className="text-sm text-white/40 mt-1">
                    or click to browse
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20">
          {[
            { icon: Music, title: 'Audio Analysis', desc: 'Word-level transcription with beat detection' },
            { icon: Sparkles, title: 'AI Generation', desc: 'Frames and video clips powered by Gemini & Veo' },
            { icon: ArrowRight, title: 'Timeline Editor', desc: 'Arrange, trim, and export your final video' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl bg-white/5 border border-white/10">
              <Icon className="w-8 h-8 text-brand-500 mb-4" />
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-white/50">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto text-center text-sm text-white/40">
          radiostar.studio
        </div>
      </footer>
    </main>
  )
}

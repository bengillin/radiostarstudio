'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X, Image, Video, Sparkles, Loader2,
  Check, Grid2x2, ChevronDown,
} from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { formatTime } from '@/lib/utils'
import type { Clip, Scene, Frame, GeneratedVideo } from '@/types'

interface DetailPanelProps {
  clip: Clip
  scene?: Scene
  onClose: () => void
  defaultPrompt: string
}

export function DetailPanel({
  clip,
  scene,
  onClose,
  defaultPrompt,
}: DetailPanelProps) {
  const {
    frames,
    videos,
    globalStyle,
    modelSettings,
    updateClip,
    setFrame,
    getFramesForClip,
    getVideosForClip,
    getResolvedElementsForScene,
    queueFrame,
    queueVideo,
    isClipQueued,
    generationQueue,
  } = useProjectStore()

  const isStartFrameQueued = isClipQueued(clip.id, 'frame', 'start')
  const isEndFrameQueued = isClipQueued(clip.id, 'frame', 'end')
  const isVideoQueued = isClipQueued(clip.id, 'video')

  // Separate prompts for start and end frames
  const [startPrompt, setStartPrompt] = useState(defaultPrompt)
  const [endPrompt, setEndPrompt] = useState(defaultPrompt)
  const [motionPrompt, setMotionPrompt] = useState('')
  const [showProperties, setShowProperties] = useState(false)

  // Reset prompts when clip changes
  useEffect(() => {
    setStartPrompt(defaultPrompt)
    setEndPrompt(defaultPrompt)
  }, [clip.id, defaultPrompt])

  // Inline variation state (per frame type)
  const [variations, setVariations] = useState<{
    frameType: 'start' | 'end' | null
    items: Frame[]
    isLoading: boolean
  }>({ frameType: null, items: [], isLoading: false })

  const generateVariations = useCallback(async (frameType: 'start' | 'end') => {
    const prompt = frameType === 'start' ? startPrompt : endPrompt
    setVariations({ frameType, items: [], isLoading: true })

    try {
      const resolvedElements = scene ? getResolvedElementsForScene(scene.id) : []
      const elementsPayload = resolvedElements.map(e => ({
        category: e.category,
        name: e.name,
        description: e.overrideDescription || e.description,
      }))

      const isImagen = modelSettings.image.startsWith('imagen')

      if (isImagen) {
        const res = await fetch('/api/generate-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt || `Cinematic ${frameType} frame`,
            clipId: clip.id,
            type: frameType,
            scene: scene ? { title: scene.title } : null,
            elements: elementsPayload,
            globalStyle,
            model: modelSettings.image,
            count: 4,
          }),
        })
        const data = await res.json()
        if (data.frames) {
          setVariations(s => ({ ...s, isLoading: false, items: data.frames }))
        } else if (data.frame) {
          setVariations(s => ({ ...s, isLoading: false, items: [data.frame] }))
        } else {
          setVariations(s => ({ ...s, isLoading: false }))
        }
      } else {
        const suffixes = ['', ' Slightly different angle.', ' Alternative composition.', ' Different lighting.']
        const promises = suffixes.map((suffix) =>
          fetch('/api/generate-frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: (prompt || `Cinematic ${frameType} frame`) + suffix,
              clipId: clip.id,
              type: frameType,
              scene: scene ? { title: scene.title } : null,
              elements: elementsPayload,
              globalStyle,
              model: modelSettings.image,
            }),
          }).then(r => r.json()).then(data => {
            if (data.frame) {
              setVariations(s => ({ ...s, items: [...s.items, data.frame] }))
            }
            return data.frame || null
          }).catch(() => null)
        )
        await Promise.all(promises)
        setVariations(s => ({ ...s, isLoading: false }))
      }
    } catch {
      setVariations(s => ({ ...s, isLoading: false }))
    }
  }, [clip.id, scene, startPrompt, endPrompt, globalStyle, modelSettings.image, getResolvedElementsForScene])

  const handleVariationSelect = useCallback((frame: Frame) => {
    for (const v of variations.items) {
      setFrame(v)
    }
    if (frame.type === 'start') {
      updateClip(clip.id, { startFrame: frame })
    } else {
      updateClip(clip.id, { endFrame: frame })
    }
    setVariations({ frameType: null, items: [], isLoading: false })
  }, [variations.items, clip.id, setFrame, updateClip])

  // Frame data
  const startFrames = getFramesForClip(clip.id, 'start')
  const endFrames = getFramesForClip(clip.id, 'end')
  const clipVideos = getVideosForClip(clip.id)

  const activeStartFrame = clip.startFrame
  const activeEndFrame = clip.endFrame
  const activeVideo = clip.video

  const setActiveFrame = (frame: Frame) => {
    if (frame.type === 'start') {
      updateClip(clip.id, { startFrame: frame })
    } else {
      updateClip(clip.id, { endFrame: frame })
    }
  }

  const setActiveVideo = (video: GeneratedVideo) => {
    updateClip(clip.id, { video })
  }

  // Queue progress for this clip
  const queueItem = generationQueue.items.find(
    i => i.clipId === clip.id && (i.status === 'processing' || i.status === 'pending')
  )

  // Resolved elements for prompt context display
  const resolvedElements = scene ? getResolvedElementsForScene(scene.id) : []

  return (
    <div className="h-full flex flex-col bg-black/80 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      {/* Compact header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="font-semibold text-white truncate">{clip.title}</h2>
          <span className="text-xs text-white/40 flex-shrink-0">
            {formatTime(clip.startTime)}–{formatTime(clip.endTime)}
            {scene && ` · ${scene.title}`}
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0">
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Prompt context — compact, always visible */}
        {resolvedElements.length > 0 && (
          <div className="px-4 py-2 border-b border-white/5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-white/30 uppercase">Context:</span>
            {resolvedElements.map(el => (
              <span key={el.id} className="px-1.5 py-0.5 rounded text-[10px] bg-white/8 text-white/50">
                {el.name}
              </span>
            ))}
            {globalStyle && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-brand-500/10 text-brand-400/60 truncate max-w-[200px]">
                {globalStyle}
              </span>
            )}
          </div>
        )}

        {/* Side-by-side frames */}
        <div className="grid grid-cols-2 gap-3 p-4">
          {/* Start Frame */}
          <FrameColumn
            label="Start Frame"
            frameType="start"
            activeFrame={activeStartFrame}
            allFrames={startFrames}
            isQueued={isStartFrameQueued}
            prompt={startPrompt}
            onPromptChange={setStartPrompt}
            onGenerate={() => queueFrame(clip.id, 'start', startPrompt.trim() || undefined)}
            onGenerateVariations={() => generateVariations('start')}
            onSetActive={setActiveFrame}
            variationsLoading={variations.frameType === 'start' && variations.isLoading}
            variations={variations.frameType === 'start' ? variations.items : []}
            showVariations={variations.frameType === 'start'}
            onSelectVariation={handleVariationSelect}
            onDismissVariations={() => setVariations({ frameType: null, items: [], isLoading: false })}
            queueProgress={queueItem?.clipId === clip.id && queueItem?.frameType === 'start' ? queueItem.progress : undefined}
          />

          {/* End Frame */}
          <FrameColumn
            label="End Frame"
            frameType="end"
            activeFrame={activeEndFrame}
            allFrames={endFrames}
            isQueued={isEndFrameQueued}
            prompt={endPrompt}
            onPromptChange={setEndPrompt}
            onGenerate={() => queueFrame(clip.id, 'end', endPrompt.trim() || undefined)}
            onGenerateVariations={() => generateVariations('end')}
            onSetActive={setActiveFrame}
            variationsLoading={variations.frameType === 'end' && variations.isLoading}
            variations={variations.frameType === 'end' ? variations.items : []}
            showVariations={variations.frameType === 'end'}
            onSelectVariation={handleVariationSelect}
            onDismissVariations={() => setVariations({ frameType: null, items: [], isLoading: false })}
            queueProgress={queueItem?.clipId === clip.id && queueItem?.frameType === 'end' ? queueItem.progress : undefined}
          />
        </div>

        {/* Video section */}
        <div className="px-4 pb-4 space-y-3">
          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center gap-2 mb-3">
              <Video className="w-4 h-4 text-white/50" />
              <span className="text-sm font-medium text-white/80">Video</span>
              {clipVideos.length > 0 && (
                <span className="text-xs text-white/30">{clipVideos.length} version{clipVideos.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Video preview */}
            {isVideoQueued ? (
              <div className="aspect-video rounded-lg bg-gradient-to-br from-purple-500/15 to-brand-500/15 border border-purple-500/20 flex items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                <div>
                  <p className="text-sm text-white/70">Generating video...</p>
                  {queueItem?.type === 'video' && queueItem.progress > 0 && (
                    <div className="w-32 h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${queueItem.progress}%` }} />
                    </div>
                  )}
                </div>
              </div>
            ) : activeVideo ? (
              <div className="aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/15">
                <video
                  src={typeof activeVideo === 'object' ? activeVideo.url : ''}
                  controls
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="aspect-video rounded-lg bg-white/3 border border-white/8 border-dashed flex flex-col items-center justify-center gap-1.5">
                <Video className="w-6 h-6 text-white/20" />
                <p className="text-xs text-white/30">
                  {activeStartFrame ? 'Ready to generate' : 'Generate a start frame first'}
                </p>
              </div>
            )}

            {/* Video version history */}
            {clipVideos.length > 1 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                {clipVideos.map((video: GeneratedVideo) => {
                  const isActive = activeVideo?.id === video.id
                  return (
                    <button
                      key={video.id}
                      onClick={() => setActiveVideo(video)}
                      className={`flex-shrink-0 px-2.5 py-1.5 rounded text-xs transition-colors ${
                        isActive
                          ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      {video.model} · {video.generatedAt ? new Date(video.generatedAt).toLocaleTimeString() : '?'}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Motion prompt + generate */}
            {activeStartFrame && (
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={motionPrompt}
                  onChange={(e) => setMotionPrompt(e.target.value)}
                  placeholder="Motion description... (e.g., 'Camera slowly zooms in')"
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-500"
                />
                <button
                  onClick={() => queueVideo(clip.id, motionPrompt.trim() || undefined)}
                  disabled={isVideoQueued}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-2 flex-shrink-0"
                >
                  {isVideoQueued ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Video className="w-4 h-4" />
                  )}
                  Generate
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible properties */}
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowProperties(!showProperties)}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors w-full"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showProperties ? 'rotate-180' : ''}`} />
            Properties
          </button>
          {showProperties && (
            <div className="mt-2 space-y-3">
              <div>
                <label className="text-[10px] text-white/30 uppercase block mb-0.5">Title</label>
                <input
                  type="text"
                  value={clip.title}
                  onChange={(e) => updateClip(clip.id, { title: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/30 uppercase block mb-0.5">Start</label>
                  <input
                    type="number"
                    step="0.1"
                    value={clip.startTime}
                    onChange={(e) => updateClip(clip.id, { startTime: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 uppercase block mb-0.5">End</label>
                  <input
                    type="number"
                    step="0.1"
                    value={clip.endTime}
                    onChange={(e) => updateClip(clip.id, { endTime: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Reusable column for start/end frame */
function FrameColumn({
  label,
  frameType,
  activeFrame,
  allFrames,
  isQueued,
  prompt,
  onPromptChange,
  onGenerate,
  onGenerateVariations,
  onSetActive,
  variationsLoading,
  variations,
  showVariations,
  onSelectVariation,
  onDismissVariations,
  queueProgress,
}: {
  label: string
  frameType: 'start' | 'end'
  activeFrame: Frame | null | undefined
  allFrames: Frame[]
  isQueued: boolean
  prompt: string
  onPromptChange: (v: string) => void
  onGenerate: () => void
  onGenerateVariations: () => void
  onSetActive: (f: Frame) => void
  variationsLoading: boolean
  variations: Frame[]
  showVariations: boolean
  onSelectVariation: (f: Frame) => void
  onDismissVariations: () => void
  queueProgress?: number
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/60">{label}</span>
        {allFrames.length > 1 && (
          <span className="text-[10px] text-white/30">{allFrames.length} versions</span>
        )}
      </div>

      {/* Preview */}
      {isQueued ? (
        <div className="aspect-video rounded-lg bg-gradient-to-br from-brand-500/15 to-purple-500/15 border border-brand-500/20 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
          {queueProgress !== undefined && queueProgress > 0 ? (
            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${queueProgress}%` }} />
            </div>
          ) : (
            <p className="text-[10px] text-white/40">Queued</p>
          )}
        </div>
      ) : activeFrame && typeof activeFrame === 'object' ? (
        <div className="aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/15">
          <img src={activeFrame.url} alt={label} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-video rounded-lg bg-white/3 border border-white/8 border-dashed flex items-center justify-center">
          <Image className="w-5 h-5 text-white/15" />
        </div>
      )}

      {/* Version thumbnails */}
      {allFrames.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {allFrames.map((frame: Frame) => {
            const isActive = activeFrame?.id === frame.id
            return (
              <button
                key={frame.id}
                onClick={() => onSetActive(frame)}
                className={`relative flex-shrink-0 w-12 h-8 rounded overflow-hidden border transition-colors ${
                  isActive ? 'border-brand-500' : 'border-transparent hover:border-white/30'
                }`}
              >
                <img src={frame.url} alt="" className="w-full h-full object-cover" />
                {isActive && (
                  <div className="absolute bottom-0 right-0 bg-brand-500 p-0.5 rounded-tl">
                    <Check className="w-2 h-2" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Inline variations (2x2 grid) */}
      {showVariations && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40">
              {variationsLoading ? `Loading ${variations.length}/4...` : 'Pick one'}
            </span>
            <button onClick={onDismissVariations} className="text-[10px] text-white/30 hover:text-white/50">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {[0, 1, 2, 3].map(i => {
              const v = variations[i]
              return v ? (
                <button
                  key={v.id}
                  onClick={() => onSelectVariation(v)}
                  className="aspect-video rounded overflow-hidden border border-white/10 hover:border-brand-500/50 transition-colors"
                >
                  <img src={v.url} alt="" className="w-full h-full object-cover" />
                </button>
              ) : (
                <div
                  key={i}
                  className="aspect-video rounded bg-white/5 border border-white/8 flex items-center justify-center"
                >
                  {variationsLoading ? (
                    <Loader2 className="w-3 h-3 text-white/20 animate-spin" />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Prompt + actions */}
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={`Describe the ${frameType} frame...`}
        rows={2}
        className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/25 resize-none focus:outline-none focus:border-brand-500 leading-relaxed"
      />
      <div className="flex gap-1.5">
        <button
          onClick={onGenerate}
          disabled={isQueued}
          className="flex-1 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          {isQueued ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          {isQueued ? 'Queued' : 'Generate'}
        </button>
        <button
          onClick={onGenerateVariations}
          disabled={isQueued || variationsLoading}
          className="py-1.5 px-2.5 bg-white/8 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors flex items-center gap-1"
          title="Generate 4 variations"
        >
          <Grid2x2 className="w-3 h-3" />
          4x
        </button>
      </div>
    </div>
  )
}

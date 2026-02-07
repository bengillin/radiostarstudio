'use client'

import { useState, useCallback } from 'react'
import {
  X, ChevronDown, ChevronUp, Image, Video, Sparkles, Clock,
  Check, Trash2, Play, Loader2, Clapperboard, Grid2x2
} from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { SceneElementSelector } from '@/components/studio/SceneElementSelector'
import { VariationPicker } from '@/components/studio/VariationPicker'
import { formatTime } from '@/lib/utils'
import type { Clip, Scene, Frame, GeneratedVideo } from '@/types'

interface DetailPanelProps {
  clip: Clip
  scene?: Scene
  onClose: () => void
  framePrompt: string
  setFramePrompt: (prompt: string) => void
  motionPrompt: string
  setMotionPrompt: (prompt: string) => void
}

export function DetailPanel({
  clip,
  scene,
  onClose,
  framePrompt,
  setFramePrompt,
  motionPrompt,
  setMotionPrompt,
}: DetailPanelProps) {
  const {
    frames,
    videos,
    globalStyle,
    modelSettings,
    updateClip,
    updateScene,
    setFrame,
    getFramesForClip,
    getVideosForClip,
    getResolvedElementsForScene,
    queueFrame,
    queueVideo,
    isClipQueued,
  } = useProjectStore()

  // Check if frames/videos are queued
  const isStartFrameQueued = isClipQueued(clip.id, 'frame', 'start')
  const isEndFrameQueued = isClipQueued(clip.id, 'frame', 'end')
  const isVideoQueued = isClipQueued(clip.id, 'video')
  const [activeTab, setActiveTab] = useState<'frames' | 'video' | 'properties'>('frames')
  const [expandedSection, setExpandedSection] = useState<'start' | 'end' | 'video' | null>('start')

  // Variation picker state
  const [variationState, setVariationState] = useState<{
    isOpen: boolean
    isLoading: boolean
    frameType: 'start' | 'end'
    variations: Frame[]
  }>({ isOpen: false, isLoading: false, frameType: 'start', variations: [] })

  const generateVariations = useCallback(async (frameType: 'start' | 'end') => {
    setVariationState({ isOpen: true, isLoading: true, frameType, variations: [] })

    try {
      const resolvedElements = scene ? getResolvedElementsForScene(scene.id) : []
      const elementsPayload = resolvedElements.map(e => ({
        category: e.category,
        name: e.name,
        description: e.overrideDescription || e.description,
      }))

      const isImagen = modelSettings.image.startsWith('imagen')

      if (isImagen) {
        // Single Imagen call with count=4
        const res = await fetch('/api/generate-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: framePrompt || `Cinematic ${frameType} frame`,
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
          setVariationState(s => ({ ...s, isLoading: false, variations: data.frames }))
        } else if (data.frame) {
          setVariationState(s => ({ ...s, isLoading: false, variations: [data.frame] }))
        } else {
          setVariationState(s => ({ ...s, isLoading: false }))
        }
      } else {
        // 4 parallel Gemini calls with slight prompt variations
        const suffixes = [
          '', // original prompt
          ' Slightly different angle.',
          ' Alternative composition.',
          ' Different lighting.',
        ]
        const promises = suffixes.map((suffix, i) =>
          fetch('/api/generate-frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: (framePrompt || `Cinematic ${frameType} frame`) + suffix,
              clipId: clip.id,
              type: frameType,
              scene: scene ? { title: scene.title } : null,
              elements: elementsPayload,
              globalStyle,
              model: modelSettings.image,
            }),
          }).then(r => r.json()).then(data => {
            if (data.frame) {
              // Update as each arrives
              setVariationState(s => ({ ...s, variations: [...s.variations, data.frame] }))
            }
            return data.frame || null
          }).catch(() => null)
        )
        await Promise.all(promises)
        setVariationState(s => ({ ...s, isLoading: false }))
      }
    } catch {
      setVariationState(s => ({ ...s, isLoading: false }))
    }
  }, [clip.id, scene, framePrompt, globalStyle, modelSettings.image, getResolvedElementsForScene])

  const handleVariationSelect = useCallback((frame: Frame) => {
    // Save all variations as versions
    for (const v of variationState.variations) {
      setFrame(v)
    }
    // Set selected as active
    if (frame.type === 'start') {
      updateClip(clip.id, { startFrame: frame })
    } else {
      updateClip(clip.id, { endFrame: frame })
    }
    setVariationState({ isOpen: false, isLoading: false, frameType: 'start', variations: [] })
  }, [variationState.variations, clip.id, setFrame, updateClip])

  // Get all versions for this clip
  const startFrames = getFramesForClip(clip.id, 'start')
  const endFrames = getFramesForClip(clip.id, 'end')
  const clipVideos = getVideosForClip(clip.id)

  // Current active versions
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

  return (
    <div className="h-full flex flex-col bg-black/80 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h2 className="font-semibold text-white">{clip.title}</h2>
          <p className="text-xs text-white/50">
            {formatTime(clip.startTime)} - {formatTime(clip.endTime)}{scene ? ` · Scene: ${scene.title}` : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['frames', 'video', 'properties'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-white border-b-2 border-brand-500'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {tab === 'frames' && <Image className="w-4 h-4 inline mr-2" />}
            {tab === 'video' && <Video className="w-4 h-4 inline mr-2" />}
            {tab === 'properties' && <Clapperboard className="w-4 h-4 inline mr-2" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'frames' && (
          <div className="space-y-6">
            {/* Start Frame Section */}
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'start' ? null : 'start')}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <span className="font-medium">Start Frame</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">{startFrames.length} version{startFrames.length !== 1 ? 's' : ''}</span>
                  {expandedSection === 'start' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {expandedSection === 'start' && (
                <div className="p-4 space-y-4">
                  {/* Active Frame Preview */}
                  {isStartFrameQueued ? (
                    <div className="aspect-video rounded-lg bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/30 flex flex-col items-center justify-center gap-3 animate-pulse">
                      <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                      <p className="text-sm text-white/60">Queued for generation...</p>
                    </div>
                  ) : activeStartFrame ? (
                    <div className="aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/20">
                      <img
                        src={typeof activeStartFrame === 'object' ? activeStartFrame.url : ''}
                        alt="Active start frame"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video rounded-lg bg-white/5 border border-white/10 border-dashed flex items-center justify-center">
                      <p className="text-sm text-white/40">No start frame yet</p>
                    </div>
                  )}

                  {/* Version History */}
                  {(startFrames.length > 0 || isStartFrameQueued) && (
                    <div>
                      <p className="text-xs text-white/40 mb-2">Version History</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {/* Generating placeholder */}
                        {isStartFrameQueued && (
                          <div className="relative flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 border-brand-500/50 bg-gradient-to-br from-brand-500/20 to-purple-500/20 animate-pulse flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
                          </div>
                        )}
                        {startFrames.map((frame: Frame) => {
                          const isActive = activeStartFrame?.id === frame.id
                          return (
                            <button
                              key={frame.id}
                              onClick={() => setActiveFrame(frame)}
                              className={`relative flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 transition-colors ${
                                isActive ? 'border-brand-500' : 'border-transparent hover:border-white/30'
                              }`}
                            >
                              <img src={frame.url} alt="" className="w-full h-full object-cover" />
                              {isActive && (
                                <div className="absolute bottom-0 right-0 bg-brand-500 p-0.5 rounded-tl">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Generate New */}
                  <div className="space-y-2">
                    <textarea
                      value={framePrompt}
                      onChange={(e) => setFramePrompt(e.target.value)}
                      placeholder="Describe the start frame..."
                      className="w-full h-20 p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => queueFrame(clip.id, 'start', framePrompt.trim() || undefined)}
                        disabled={isStartFrameQueued}
                        className="flex-1 py-2 px-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {isStartFrameQueued ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Queued...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => generateVariations('start')}
                        disabled={isStartFrameQueued || variationState.isLoading}
                        className="py-2 px-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                        title="Generate 4 variations to pick from"
                      >
                        <Grid2x2 className="w-4 h-4" />
                        4x
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* End Frame Section */}
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'end' ? null : 'end')}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <span className="font-medium">End Frame</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">{endFrames.length} version{endFrames.length !== 1 ? 's' : ''}</span>
                  {expandedSection === 'end' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {expandedSection === 'end' && (
                <div className="p-4 space-y-4">
                  {isEndFrameQueued ? (
                    <div className="aspect-video rounded-lg bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/30 flex flex-col items-center justify-center gap-3 animate-pulse">
                      <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                      <p className="text-sm text-white/60">Queued for generation...</p>
                    </div>
                  ) : activeEndFrame ? (
                    <div className="aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/20">
                      <img
                        src={typeof activeEndFrame === 'object' ? activeEndFrame.url : ''}
                        alt="Active end frame"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video rounded-lg bg-white/5 border border-white/10 border-dashed flex items-center justify-center">
                      <p className="text-sm text-white/40">No end frame yet (optional)</p>
                    </div>
                  )}

                  {(endFrames.length > 0 || isEndFrameQueued) && (
                    <div>
                      <p className="text-xs text-white/40 mb-2">Version History</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {/* Generating placeholder */}
                        {isEndFrameQueued && (
                          <div className="relative flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 border-brand-500/50 bg-gradient-to-br from-brand-500/20 to-purple-500/20 animate-pulse flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
                          </div>
                        )}
                        {endFrames.map((frame: Frame) => {
                          const isActive = activeEndFrame?.id === frame.id
                          return (
                            <button
                              key={frame.id}
                              onClick={() => setActiveFrame(frame)}
                              className={`relative flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 transition-colors ${
                                isActive ? 'border-brand-500' : 'border-transparent hover:border-white/30'
                              }`}
                            >
                              <img src={frame.url} alt="" className="w-full h-full object-cover" />
                              {isActive && (
                                <div className="absolute bottom-0 right-0 bg-brand-500 p-0.5 rounded-tl">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <textarea
                      value={framePrompt}
                      onChange={(e) => setFramePrompt(e.target.value)}
                      placeholder="Describe the end frame..."
                      className="w-full h-20 p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => queueFrame(clip.id, 'end', framePrompt.trim() || undefined)}
                        disabled={isEndFrameQueued}
                        className="flex-1 py-2 px-4 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {isEndFrameQueued ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Queued...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => generateVariations('end')}
                        disabled={isEndFrameQueued || variationState.isLoading}
                        className="py-2 px-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                        title="Generate 4 variations to pick from"
                      >
                        <Grid2x2 className="w-4 h-4" />
                        4x
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="space-y-4">
            {/* Active Video Preview */}
            {isVideoQueued ? (
              <div className="aspect-video rounded-lg bg-gradient-to-br from-purple-500/20 to-brand-500/20 border border-purple-500/30 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                <div className="text-center">
                  <p className="text-sm text-white/80">Video queued for generation</p>
                  <p className="text-xs text-white/40 mt-1">Check the queue panel for progress</p>
                </div>
              </div>
            ) : activeVideo ? (
              <div className="aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/20">
                <video
                  src={typeof activeVideo === 'object' ? activeVideo.url : ''}
                  controls
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="aspect-video rounded-lg bg-white/5 border border-white/10 border-dashed flex flex-col items-center justify-center gap-2">
                <Video className="w-8 h-8 text-white/30" />
                <p className="text-sm text-white/40">No video generated yet</p>
                {!activeStartFrame && (
                  <p className="text-xs text-white/30">Generate a start frame first</p>
                )}
              </div>
            )}

            {/* Version History */}
            {clipVideos.length > 0 && (
              <div>
                <p className="text-xs text-white/40 mb-2">Version History ({clipVideos.length})</p>
                <div className="space-y-2">
                  {clipVideos.map((video: GeneratedVideo) => {
                    const isActive = activeVideo?.id === video.id
                    return (
                      <button
                        key={video.id}
                        onClick={() => setActiveVideo(video)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isActive
                            ? 'border-brand-500 bg-brand-500/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <Play className="w-4 h-4 text-white/60" />
                        <div className="flex-1 text-left">
                          <p className="text-sm text-white truncate">{video.motionPrompt?.substring(0, 50) || 'Video'}</p>
                          <p className="text-xs text-white/40">
                            {video.model} · {video.generatedAt ? new Date(video.generatedAt).toLocaleString() : 'Unknown date'}
                          </p>
                        </div>
                        {isActive && <Check className="w-4 h-4 text-brand-500" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Generate Video */}
            {activeStartFrame && (
              <div className="space-y-2 pt-4 border-t border-white/10">
                <textarea
                  value={motionPrompt}
                  onChange={(e) => setMotionPrompt(e.target.value)}
                  placeholder="Describe the motion... (e.g., 'Camera slowly zooms in')"
                  className="w-full h-20 p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-500"
                />
                <button
                  onClick={() => queueVideo(clip.id, motionPrompt.trim() || undefined)}
                  disabled={isVideoQueued}
                  className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isVideoQueued ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Queued...
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4" />
                      Generate Video
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="space-y-4">
            {/* Clip Properties */}
            <div>
              <label className="text-xs text-white/40 uppercase block mb-1">Title</label>
              <input
                type="text"
                value={clip.title}
                onChange={(e) => updateClip(clip.id, { title: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/40 uppercase block mb-1">Start Time</label>
                <input
                  type="number"
                  step="0.1"
                  value={clip.startTime}
                  onChange={(e) => updateClip(clip.id, { startTime: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase block mb-1">End Time</label>
                <input
                  type="number"
                  step="0.1"
                  value={clip.endTime}
                  onChange={(e) => updateClip(clip.id, { endTime: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Scene Properties */}
            {scene && (
              <div className="pt-4 border-t border-white/10">
                <h3 className="text-sm font-medium mb-3">Scene: {scene.title}</h3>

                <div className="space-y-3">
                  {(['who', 'what', 'when', 'where', 'why'] as const).map((category) => (
                    <SceneElementSelector
                      key={category}
                      sceneId={scene.id}
                      category={category}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Variation Picker Modal */}
      {variationState.isOpen && (
        <VariationPicker
          variations={variationState.variations}
          isLoading={variationState.isLoading}
          expectedCount={4}
          onSelect={handleVariationSelect}
          onClose={() => setVariationState({ isOpen: false, isLoading: false, frameType: 'start', variations: [] })}
        />
      )}
    </div>
  )
}

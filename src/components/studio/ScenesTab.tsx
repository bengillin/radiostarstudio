'use client'

import { Clip, Scene } from '@/types'
import { useProjectStore } from '@/store/project-store'
import { useToast } from '@/components/ui/Toast'
import { SceneElementSelector } from '@/components/studio/SceneElementSelector'
import { CameraSettingsEditor } from '@/components/studio/CameraSettingsEditor'
import {
  Plus, Trash2, ChevronDown, ChevronUp, Layers,
  Loader2, Camera, Sparkles,
} from 'lucide-react'
import { formatTime } from '@/lib/utils'

const VEO_MAX_DURATION = 8

interface ScenesTabProps {
  expandedSceneId: string | null
  setExpandedSceneId: (id: string | null) => void
  onDeleteScene: (id: string, clipCount: number) => void
  onSwitchToQueue: () => void
}

export function ScenesTab({ expandedSceneId, setExpandedSceneId, onDeleteScene, onSwitchToQueue }: ScenesTabProps) {
  const { showToast } = useToast()
  const {
    transcript,
    scenes,
    clips,
    frames,
    videos,
    elements,
    elementImages,
    generationQueue,
    getResolvedElementsForScene,
    saveToHistory,
    createScene,
    createClip,
    updateScene,
    selectClip,
    clearSelection,
    addToQueue,
    startQueue,
    cameraSettings,
    timeline,
  } = useProjectStore()

  const selectedClipIds = timeline?.selectedClipIds ?? []

  return (
    <div className="w-full h-full overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto space-y-3">
        {/* Add scene button */}
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

        {scenes.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40">No scenes yet</p>
            <p className="text-sm text-white/25 mt-1">
              {transcript.length > 0
                ? 'Plan scenes from your lyrics to build the story'
                : 'Transcribe your audio first, then plan scenes'
              }
            </p>
          </div>
        ) : (
          scenes.map((scene: Scene) => {
            const isExpanded = expandedSceneId === scene.id
            const sceneClips = clips.filter((c: Clip) => c.sceneId === scene.id)
            const resolvedElements = getResolvedElementsForScene(scene.id)
            const elementImageThumbs = resolvedElements.flatMap(el =>
              el.referenceImageIds.slice(0, 1).map(imgId => elementImages[imgId]).filter(Boolean)
            ).slice(0, 4)
            const sceneFrameCount = sceneClips.filter(c =>
              c.startFrame || Object.values(frames).some((f: any) => f.clipId === c.id && f.type === 'start')
            ).length
            const sceneVideoCount = sceneClips.filter(c =>
              c.video || Object.values(videos).some((v: any) => v.clipId === c.id && v.status === 'complete')
            ).length
            const hasAllVideos = sceneClips.length > 0 && sceneVideoCount === sceneClips.length

            return (
              <div
                key={scene.id}
                className="group rounded-lg bg-white/5 border border-white/10 overflow-hidden"
              >
                {/* Scene card header */}
                <div
                  className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedSceneId(isExpanded ? null : scene.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium truncate text-sm">{scene.title}</p>
                        <span className="text-xs text-white/40 flex-shrink-0">
                          {formatTime(scene.startTime)} – {formatTime(scene.endTime)}
                        </span>
                        {sceneClips.length > 0 && (
                          <span className="text-[10px] text-white/30 flex-shrink-0">
                            {sceneClips.length} clip{sceneClips.length !== 1 ? 's' : ''}
                            {sceneFrameCount > 0 && ` · ${sceneFrameCount} frames`}
                            {sceneVideoCount > 0 && ` · ${sceneVideoCount} videos`}
                          </span>
                        )}
                      </div>
                      {scene.description && (
                        <p className="text-xs text-white/50 line-clamp-2 mb-2">{scene.description}</p>
                      )}
                      {/* Element pills + reference image thumbnails */}
                      <div className="flex items-center gap-2">
                        {elementImageThumbs.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {elementImageThumbs.map(img => (
                              <img
                                key={img.id}
                                src={img.url}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover border border-black/50"
                              />
                            ))}
                          </div>
                        )}
                        {resolvedElements.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {resolvedElements.map((el) => (
                              <span
                                key={el.id}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-white/60"
                              >
                                {el.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Generate All for Scene */}
                      {sceneClips.length > 0 && !hasAllVideos && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const items: Array<{ type: 'frame' | 'video'; clipId: string; frameType?: 'start' | 'end' }> = []
                            for (const c of sceneClips) {
                              const hasStart = c.startFrame || Object.values(frames).some((f: any) => f.clipId === c.id && f.type === 'start')
                              const hasEnd = c.endFrame || Object.values(frames).some((f: any) => f.clipId === c.id && f.type === 'end')
                              const hasVid = c.video || Object.values(videos).some((v: any) => v.clipId === c.id && v.status === 'complete')
                              if (!hasStart) items.push({ type: 'frame', clipId: c.id, frameType: 'start' })
                              if (!hasEnd) items.push({ type: 'frame', clipId: c.id, frameType: 'end' })
                              if (hasStart && !hasVid) items.push({ type: 'video', clipId: c.id })
                            }
                            if (items.length > 0) {
                              addToQueue(items)
                              startQueue()
                              onSwitchToQueue()
                              showToast(`Queued ${items.length} items for "${scene.title}"`, 'success')
                            } else {
                              showToast('Nothing to generate', 'info')
                            }
                          }}
                          className="p-1.5 hover:bg-brand-500/20 rounded transition-colors"
                          title="Generate all frames & videos for this scene"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                        </button>
                      )}
                      {hasAllVideos && (
                        <span className="text-[10px] text-green-400 px-1.5 py-0.5 bg-green-500/10 rounded">Done</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteScene(scene.id, sceneClips.length)
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

                  {/* Clip thumbnails — collapsed view */}
                  {!isExpanded && sceneClips.length > 0 && (
                    <div className="flex gap-1.5 mt-2 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
                      {sceneClips.map((clip: Clip) => {
                        const startFrame = clip.startFrame || Object.values(frames).find((f: any) => f.clipId === clip.id && f.type === 'start')
                        const isQueued = generationQueue.items.some(i => i.clipId === clip.id && (i.status === 'pending' || i.status === 'processing'))
                        return (
                          <button
                            key={clip.id}
                            onClick={() => selectClip(clip.id)}
                            className="flex-shrink-0 rounded-md overflow-hidden border border-white/10 hover:border-brand-500/50 transition-colors relative"
                            title={clip.title}
                          >
                            {startFrame && typeof startFrame === 'object' ? (
                              <img
                                src={(startFrame as any).url}
                                alt={clip.title}
                                className="w-20 h-12 object-cover"
                              />
                            ) : (
                              <div className="w-20 h-12 bg-white/5 flex items-center justify-center">
                                <span className="text-[10px] text-white/30 truncate px-1">{clip.title}</span>
                              </div>
                            )}
                            {isQueued && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Loader2 className="w-3 h-3 text-brand-400 animate-spin" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Expanded scene editor */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-white/10 space-y-3">
                    <div>
                      <textarea
                        value={scene.description}
                        onChange={(e) => updateScene(scene.id, { description: e.target.value })}
                        placeholder="Scene description..."
                        rows={2}
                        className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/30 focus:outline-none focus:border-brand-500 resize-none"
                      />
                    </div>

                    {/* Element selectors for 5 Ws */}
                    {(['who', 'what', 'when', 'where', 'why'] as const).map((category) => (
                      <SceneElementSelector
                        key={category}
                        sceneId={scene.id}
                        category={category}
                      />
                    ))}

                    {/* Per-scene camera overrides */}
                    <details className="group/cam">
                      <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-white/40 hover:text-white/60 transition-colors mt-3 pt-3 border-t border-white/10">
                        <Camera className="w-3.5 h-3.5" />
                        Camera Overrides
                        <ChevronDown className="w-3 h-3 ml-auto group-open/cam:rotate-180 transition-transform" />
                      </summary>
                      <div className="mt-2">
                        <CameraSettingsEditor
                          isOverride
                          settings={scene.cameraOverrides || {}}
                          onChange={(overrides) => updateScene(scene.id, { cameraOverrides: overrides })}
                          globalDefaults={cameraSettings}
                        />
                      </div>
                    </details>

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
                              createClip(newStart, newEnd, undefined, scene.id)
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
                          const startFrame = clip.startFrame || Object.values(frames).find((f: any) => f.clipId === clip.id && f.type === 'start')
                          const endFrame = clip.endFrame || Object.values(frames).find((f: any) => f.clipId === clip.id && f.type === 'end')
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
                                  {startFrame && typeof startFrame === 'object' && (
                                    <div className="relative w-12 h-8 rounded overflow-hidden bg-white/10">
                                      <img
                                        src={(startFrame as any).url}
                                        alt="Start"
                                        className="w-full h-full object-cover"
                                      />
                                      <span className="absolute bottom-0 left-0 text-[8px] bg-black/50 px-0.5">S</span>
                                    </div>
                                  )}
                                  {endFrame && typeof endFrame === 'object' && (
                                    <div className="relative w-12 h-8 rounded overflow-hidden bg-white/10">
                                      <img
                                        src={(endFrame as any).url}
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
    </div>
  )
}

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getActiveProjectId, getStoreKey } from '@/lib/project-manager'
import type {
  AudioFile,
  TranscriptSegment,
  Scene,
  Clip,
  Frame,
  GeneratedVideo,
  TimelineState,
  Project,
  QueueItem,
  GenerationQueue,
  WorkflowState,
  WorkflowStage,
  WorkflowError,
  WorldElement,
  ElementCategory,
  ElementReferenceImage,
} from '@/types'
import * as assetCache from '@/lib/asset-cache'

interface HistoryEntry {
  scenes: Scene[]
  clips: Clip[]
  timestamp: number
}

interface ProjectStore {
  // Project
  project: Project | null
  setProject: (project: Project | null) => void

  // Audio
  audioFile: AudioFile | null
  setAudioFile: (file: AudioFile | null) => void
  setBeats: (beats: number[]) => void

  // Transcript
  transcript: TranscriptSegment[]
  setTranscript: (segments: TranscriptSegment[]) => void
  updateSegment: (id: string, updates: Partial<TranscriptSegment>) => void
  addSegment: (segment: TranscriptSegment) => void
  deleteSegment: (id: string) => void

  // Scenes & Clips
  scenes: Scene[]
  setScenes: (scenes: Scene[]) => void
  addScene: (scene: Scene) => void
  updateScene: (id: string, updates: Partial<Scene>) => void
  deleteScene: (id: string) => void

  // Enhanced scene management
  createScene: (afterSceneId?: string) => string  // Returns new scene ID
  deleteSceneWithClips: (id: string, reassignToSceneId?: string) => void
  reorderScenes: () => void  // Recalculates scene boundaries to be sequential
  getSceneAtTime: (time: number) => Scene | null

  clips: Clip[]
  setClips: (clips: Clip[]) => void
  addClip: (clip: Clip) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  deleteClip: (id: string) => void

  // Enhanced clip management
  createClip: (startTime: number, endTime: number, title?: string, sceneId?: string) => string  // Returns new clip ID
  handleClipMoved: (clipId: string, newStartTime: number, newEndTime: number) => void
  getClipsForScene: (sceneId: string) => Clip[]

  // Frames
  frames: Record<string, Frame>
  setFrame: (frame: Frame) => void
  deleteFrame: (id: string) => void
  getFramesForClip: (clipId: string, type?: 'start' | 'end') => Frame[]

  // Videos
  videos: Record<string, GeneratedVideo>
  setVideo: (video: GeneratedVideo) => void
  deleteVideo: (id: string) => void
  updateVideoStatus: (id: string, status: GeneratedVideo['status'], error?: string) => void
  getVideosForClip: (clipId: string) => GeneratedVideo[]

  // Timeline
  timeline: TimelineState
  setTimeline: (updates: Partial<TimelineState>) => void
  setPlayheadTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  selectClip: (id: string, multi?: boolean) => void
  clearSelection: () => void

  // Global
  globalStyle: string
  setGlobalStyle: (style: string) => void

  // Model settings
  modelSettings: {
    text: string
    image: string
    video: string
  }
  setModelSettings: (settings: Partial<{ text: string; image: string; video: string }>) => void

  // History (Undo/Redo)
  history: HistoryEntry[]
  historyIndex: number
  saveToHistory: () => void
  undo: () => void
  redo: () => void

  // Asset cache
  assetsLoaded: boolean
  rehydrateAssets: () => Promise<void>
  getStorageStats: () => Promise<{ frameCount: number; videoCount: number; estimatedSize: string }>
  clearAssetCache: () => Promise<void>

  // Generation queue
  generationQueue: GenerationQueue
  addToQueue: (items: Omit<QueueItem, 'id' | 'status' | 'progress' | 'retryCount' | 'createdAt' | 'startedAt' | 'completedAt'>[]) => void
  removeFromQueue: (itemId: string) => void
  clearQueue: () => void
  updateQueueItem: (itemId: string, updates: Partial<QueueItem>) => void
  startQueue: () => void
  pauseQueue: () => void
  resumeQueue: () => void
  queueAllFrames: (type: 'start' | 'end' | 'both') => void
  queueAllVideos: () => void
  queueFrame: (clipId: string, frameType: 'start' | 'end', prompt?: string) => void
  queueVideo: (clipId: string, motionPrompt?: string) => void
  isClipQueued: (clipId: string, type: 'frame' | 'video', frameType?: 'start' | 'end') => boolean

  // Workflow
  workflow: WorkflowState
  setWorkflowStage: (stage: WorkflowStage) => void
  setWorkflowProgress: (key: 'transcription' | 'planning' | 'generation', value: number) => void
  setWorkflowError: (error: Omit<WorkflowError, 'timestamp'> | null) => void
  setAutoProgress: (enabled: boolean) => void
  clearWorkflowError: () => void

  // World Elements
  elements: WorldElement[]
  setElements: (elements: WorldElement[]) => void
  addElement: (element: WorldElement) => void
  updateElement: (id: string, updates: Partial<WorldElement>) => void
  deleteElement: (id: string) => void
  getElementsByCategory: (category: ElementCategory) => WorldElement[]

  // Element reference images (metadata in state, blobs in IndexedDB)
  elementImages: Record<string, ElementReferenceImage>
  setElementImage: (image: ElementReferenceImage) => void
  deleteElementImage: (imageId: string, elementId: string) => void

  // Scene element references
  addElementToScene: (sceneId: string, elementId: string) => void
  removeElementFromScene: (sceneId: string, elementId: string) => void
  setSceneElementOverride: (sceneId: string, elementId: string, overrideDescription: string | undefined) => void
  getResolvedElementsForScene: (sceneId: string) => Array<WorldElement & { overrideDescription?: string }>

  // Reset
  reset: () => void
}

const initialTimelineState: TimelineState = {
  zoom: 50, // pixels per second
  scrollX: 0,
  playheadTime: 0,
  isPlaying: false,
  selectedClipIds: [],
  selectedSceneId: null,
  dragState: null,
}

const initialWorkflowState: WorkflowState = {
  stage: 'empty',
  autoProgress: true, // Auto-advance through stages by default
  error: null,
  progress: {
    transcription: 0,
    planning: 0,
    generation: 0,
  },
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // Project
      project: null,
      setProject: (project) => set({ project }),

      // Audio
      audioFile: null,
      setAudioFile: (audioFile) => set((state) => ({
        audioFile,
        // Clear transcript when loading new audio
        transcript: [],
        scenes: [],
        clips: [],
        // Update workflow stage
        workflow: {
          ...state.workflow,
          stage: audioFile ? 'audio_loaded' : 'empty',
          error: null,
          progress: { transcription: 0, planning: 0, generation: 0 },
        },
      })),
      setBeats: (beats) => set((state) => ({
        audioFile: state.audioFile ? { ...state.audioFile, beats } : null,
      })),

      // Transcript
      transcript: [],
      setTranscript: (transcript) => set({ transcript }),
      updateSegment: (id, updates) => set((state) => ({
        transcript: state.transcript.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
      })),
      addSegment: (segment) => set((state) => ({
        transcript: [...state.transcript, segment].sort((a, b) => a.start - b.start),
      })),
      deleteSegment: (id) => set((state) => ({
        transcript: state.transcript.filter((s) => s.id !== id),
        clips: state.clips.map((c) =>
          c.segmentId === id ? { ...c, segmentId: undefined } : c
        ),
      })),

      // Scenes
      scenes: [],
      setScenes: (scenes) => set({ scenes }),
      addScene: (scene) => set((state) => ({ scenes: [...state.scenes, scene] })),
      updateScene: (id, updates) => set((state) => ({
        scenes: state.scenes.map((s) => s.id === id ? { ...s, ...updates } : s)
      })),
      deleteScene: (id) => set((state) => ({
        scenes: state.scenes.filter((s) => s.id !== id)
      })),

      // Enhanced scene management
      createScene: (afterSceneId) => {
        const { scenes, audioFile } = get()
        const audioDuration = audioFile?.duration ?? 180 // default 3 min
        const newSceneId = `scene-${Date.now()}`

        let newStartTime: number
        let newEndTime: number
        let insertIndex: number

        if (afterSceneId) {
          // Insert after specified scene
          const afterScene = scenes.find(s => s.id === afterSceneId)
          const afterIndex = scenes.findIndex(s => s.id === afterSceneId)
          if (afterScene && afterIndex !== -1) {
            newStartTime = afterScene.endTime
            // Find next scene to determine end time
            const nextScene = scenes[afterIndex + 1]
            newEndTime = nextScene ? nextScene.startTime : Math.min(afterScene.endTime + 10, audioDuration)
            insertIndex = afterIndex + 1
          } else {
            // Fallback to end
            const lastScene = scenes[scenes.length - 1]
            newStartTime = lastScene ? lastScene.endTime : 0
            newEndTime = Math.min(newStartTime + 10, audioDuration)
            insertIndex = scenes.length
          }
        } else {
          // Add at end
          const lastScene = scenes[scenes.length - 1]
          newStartTime = lastScene ? lastScene.endTime : 0
          newEndTime = Math.min(newStartTime + 10, audioDuration)
          insertIndex = scenes.length
        }

        const newScene: Scene = {
          id: newSceneId,
          title: `Scene ${scenes.length + 1}`,
          description: '',
          startTime: newStartTime,
          endTime: newEndTime,
          clips: [],
          order: insertIndex,
          who: [],
          what: '',
          when: '',
          where: '',
          why: '',
          aesthetic: {
            style: '',
            colorPalette: [],
            lighting: '',
            cameraMovement: '',
          },
        }

        // Insert at correct position
        const newScenes = [...scenes]
        newScenes.splice(insertIndex, 0, newScene)

        // Update order for all scenes
        newScenes.forEach((s, i) => {
          s.order = i
        })

        set({ scenes: newScenes })
        return newSceneId
      },

      deleteSceneWithClips: (id, reassignToSceneId) => {
        const { scenes, clips } = get()
        const sceneToDelete = scenes.find(s => s.id === id)
        if (!sceneToDelete) return

        // Find clips belonging to this scene
        const sceneClips = clips.filter(c => c.sceneId === id)

        let updatedClips = clips
        if (sceneClips.length > 0) {
          if (reassignToSceneId) {
            // Reassign clips to specified scene
            updatedClips = clips.map(c =>
              c.sceneId === id ? { ...c, sceneId: reassignToSceneId } : c
            )
          } else {
            // Orphan clips — clear sceneId so they become free-floating
            updatedClips = clips.map(c =>
              c.sceneId === id ? { ...c, sceneId: undefined } : c
            )
          }
        }

        // Remove scene and reorder
        const newScenes = scenes.filter(s => s.id !== id)
        newScenes.forEach((s, i) => {
          s.order = i
        })

        set({ scenes: newScenes, clips: updatedClips })
      },

      reorderScenes: () => {
        const { scenes } = get()
        if (scenes.length === 0) return

        // Sort by startTime
        const sortedScenes = [...scenes].sort((a, b) => a.startTime - b.startTime)

        // Update order based on sorted position
        sortedScenes.forEach((s, i) => {
          s.order = i
        })

        set({ scenes: sortedScenes })
      },

      getSceneAtTime: (time) => {
        const { scenes } = get()
        return scenes.find(s => time >= s.startTime && time < s.endTime) ?? null
      },

      // Clips
      clips: [],
      setClips: (clips) => set({ clips }),
      addClip: (clip) => set((state) => ({ clips: [...state.clips, clip] })),
      updateClip: (id, updates) => set((state) => ({
        clips: state.clips.map((c) => c.id === id ? { ...c, ...updates } : c)
      })),
      deleteClip: (id) => set((state) => ({
        clips: state.clips.filter((c) => c.id !== id)
      })),

      // Enhanced clip management
      createClip: (startTime, endTime, title, sceneId) => {
        const { clips, scenes, transcript } = get()
        const newClipId = `clip-${Date.now()}`

        // Auto-detect scene from time overlap if not provided
        const midpoint = (startTime + endTime) / 2
        const resolvedSceneId = sceneId || scenes.find(s => midpoint >= s.startTime && midpoint < s.endTime)?.id
        // Auto-detect segment from time overlap
        const resolvedSegmentId = transcript.find(s => midpoint >= s.start && midpoint < s.end)?.id

        const existingClips = resolvedSceneId ? clips.filter(c => c.sceneId === resolvedSceneId) : clips
        const newClip: Clip = {
          id: newClipId,
          sceneId: resolvedSceneId,
          segmentId: resolvedSegmentId,
          title: title || `Clip ${existingClips.length + 1}`,
          startTime,
          endTime,
          order: existingClips.length,
        }

        set((state) => ({ clips: [...state.clips, newClip] }))
        return newClipId
      },

      handleClipMoved: (clipId, newStartTime, newEndTime) => {
        const { scenes, clips, transcript } = get()
        const clip = clips.find(c => c.id === clipId)
        if (!clip) return

        const clipMidpoint = (newStartTime + newEndTime) / 2

        // Auto-associate with overlapping scene/segment (or clear if none)
        const targetScene = scenes.find(s =>
          clipMidpoint >= s.startTime && clipMidpoint < s.endTime
        )
        const targetSegment = transcript.find(s =>
          clipMidpoint >= s.start && clipMidpoint < s.end
        )

        const updatedClips = clips.map(c =>
          c.id === clipId
            ? {
                ...c,
                startTime: newStartTime,
                endTime: newEndTime,
                sceneId: targetScene?.id,
                segmentId: targetSegment?.id,
              }
            : c
        )

        set({ clips: updatedClips })
      },

      getClipsForScene: (sceneId) => {
        const { clips } = get()
        return clips
          .filter(c => c.sceneId === sceneId)
          .sort((a, b) => a.startTime - b.startTime)
      },

      // Frames
      frames: {},
      setFrame: (frame) => {
        // Save to IndexedDB in background
        assetCache.saveFrame({
          id: frame.id,
          clipId: frame.clipId,
          type: frame.type,
          source: frame.source,
          url: frame.url,
          prompt: frame.prompt,
          generatedAt: frame.generatedAt ? String(frame.generatedAt) : undefined,
          model: frame.model,
        }).catch((err) => console.error('Failed to cache frame:', err))

        // Update Zustand state
        set((state) => ({
          frames: { ...state.frames, [frame.id]: frame }
        }))
      },
      deleteFrame: (id) => {
        // Delete from IndexedDB in background
        assetCache.deleteFrame(id).catch((err) => console.error('Failed to delete cached frame:', err))

        // Update Zustand state
        set((state) => {
          const { [id]: _, ...rest } = state.frames
          return { frames: rest }
        })
      },
      getFramesForClip: (clipId, type) => {
        const { frames } = get()
        return Object.values(frames)
          .filter((f: Frame) => f.clipId === clipId && (!type || f.type === type))
          .sort((a: Frame, b: Frame) => {
            const dateA = a.generatedAt ? new Date(a.generatedAt).getTime() : 0
            const dateB = b.generatedAt ? new Date(b.generatedAt).getTime() : 0
            return dateB - dateA // newest first
          })
      },

      // Videos
      videos: {},
      setVideo: (video) => {
        // Save to IndexedDB in background
        assetCache.saveVideo({
          id: video.id,
          clipId: video.clipId,
          url: video.url,
          duration: video.duration,
          status: video.status,
          startFrameId: video.startFrameId,
          endFrameId: video.endFrameId,
          motionPrompt: video.motionPrompt,
          model: video.model,
          generatedAt: video.generatedAt ? String(video.generatedAt) : undefined,
          jobId: video.jobId,
          error: video.error,
        }).catch((err) => console.error('Failed to cache video:', err))

        // Update Zustand state
        set((state) => ({
          videos: { ...state.videos, [video.id]: video }
        }))
      },
      deleteVideo: (id) => {
        // Delete from IndexedDB in background
        assetCache.deleteVideo(id).catch((err) => console.error('Failed to delete cached video:', err))

        // Update Zustand state
        set((state) => {
          const { [id]: _, ...rest } = state.videos
          return { videos: rest }
        })
      },
      updateVideoStatus: (id, status, error) => {
        // Update IndexedDB in background
        assetCache.getVideo(id).then((cached) => {
          if (cached) {
            assetCache.saveVideo({ ...cached, status, error })
          }
        }).catch((err) => console.error('Failed to update cached video status:', err))

        // Update Zustand state
        set((state) => ({
          videos: {
            ...state.videos,
            [id]: { ...state.videos[id], status, error }
          }
        }))
      },
      getVideosForClip: (clipId) => {
        const { videos } = get()
        return Object.values(videos)
          .filter((v: GeneratedVideo) => v.clipId === clipId)
          .sort((a: GeneratedVideo, b: GeneratedVideo) => {
            const dateA = a.generatedAt ? new Date(a.generatedAt).getTime() : 0
            const dateB = b.generatedAt ? new Date(b.generatedAt).getTime() : 0
            return dateB - dateA // newest first
          })
      },

      // Timeline
      timeline: initialTimelineState,
      setTimeline: (updates) => set((state) => ({
        timeline: { ...state.timeline, ...updates }
      })),
      setPlayheadTime: (time) => set((state) => ({
        timeline: { ...state.timeline, playheadTime: time }
      })),
      setIsPlaying: (isPlaying) => set((state) => ({
        timeline: { ...state.timeline, isPlaying }
      })),
      selectClip: (id, multi = false) => set((state) => ({
        timeline: {
          ...state.timeline,
          selectedClipIds: multi
            ? state.timeline.selectedClipIds.includes(id)
              ? state.timeline.selectedClipIds.filter((i) => i !== id)
              : [...state.timeline.selectedClipIds, id]
            : [id]
        }
      })),
      clearSelection: () => set((state) => ({
        timeline: { ...state.timeline, selectedClipIds: [], selectedSceneId: null }
      })),

      // Global style
      globalStyle: '',
      setGlobalStyle: (globalStyle) => set({ globalStyle }),

      // Model settings
      modelSettings: {
        text: 'gemini-3-pro-preview',
        image: 'gemini-3-pro-image-preview',
        video: 'veo-3.1-generate-preview',
      },
      setModelSettings: (settings) => set((state) => ({
        modelSettings: { ...state.modelSettings, ...settings },
      })),

      // History (Undo/Redo)
      history: [],
      historyIndex: -1,

      saveToHistory: () => set((state) => {
        const { scenes, clips, history, historyIndex } = state
        // Truncate future history if we're not at the end
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push({
          scenes: JSON.parse(JSON.stringify(scenes)),
          clips: JSON.parse(JSON.stringify(clips)),
          timestamp: Date.now(),
        })
        // Keep last 50 entries
        if (newHistory.length > 50) newHistory.shift()
        return { history: newHistory, historyIndex: newHistory.length - 1 }
      }),

      undo: () => set((state) => {
        const { history, historyIndex } = state
        if (historyIndex <= 0) return state
        const prev = history[historyIndex - 1]
        return {
          scenes: JSON.parse(JSON.stringify(prev.scenes)),
          clips: JSON.parse(JSON.stringify(prev.clips)),
          historyIndex: historyIndex - 1,
        }
      }),

      redo: () => set((state) => {
        const { history, historyIndex } = state
        if (historyIndex >= history.length - 1) return state
        const next = history[historyIndex + 1]
        return {
          scenes: JSON.parse(JSON.stringify(next.scenes)),
          clips: JSON.parse(JSON.stringify(next.clips)),
          historyIndex: historyIndex + 1,
        }
      }),

      // Asset cache
      assetsLoaded: false,
      rehydrateAssets: async () => {
        try {
          if (!assetCache.isIndexedDBAvailable()) {
            console.warn('IndexedDB not available, skipping asset rehydration')
            set({ assetsLoaded: true })
            return
          }

          // Load all frames from IndexedDB
          const cachedFrames = await assetCache.getAllFrames()
          const framesMap: Record<string, Frame> = {}
          for (const cached of cachedFrames) {
            framesMap[cached.id] = {
              id: cached.id,
              clipId: cached.clipId,
              type: cached.type,
              source: cached.source,
              url: cached.url,
              prompt: cached.prompt,
              generatedAt: cached.generatedAt ? new Date(cached.generatedAt) : undefined,
              model: cached.model,
            }
          }

          // Load all videos from IndexedDB
          const cachedVideos = await assetCache.getAllVideos()
          const videosMap: Record<string, GeneratedVideo> = {}
          for (const cached of cachedVideos) {
            videosMap[cached.id] = {
              id: cached.id,
              clipId: cached.clipId,
              url: cached.url,
              duration: cached.duration,
              status: cached.status,
              startFrameId: cached.startFrameId,
              endFrameId: cached.endFrameId,
              motionPrompt: cached.motionPrompt,
              model: cached.model,
              generatedAt: cached.generatedAt ? new Date(cached.generatedAt) : undefined,
              jobId: cached.jobId,
              error: cached.error,
            }
          }

          // Load element images from IndexedDB
          const cachedElementImages = await assetCache.getAllElementImages()
          const elementImagesMap: Record<string, ElementReferenceImage> = {}
          for (const cached of cachedElementImages) {
            elementImagesMap[cached.id] = {
              id: cached.id,
              elementId: cached.elementId,
              url: cached.url,
              source: cached.source,
              prompt: cached.prompt,
              createdAt: cached.createdAt,
            }
          }

          set({
            frames: framesMap,
            videos: videosMap,
            elementImages: elementImagesMap,
            assetsLoaded: true,
          })

          console.log(`Rehydrated ${cachedFrames.length} frames, ${cachedVideos.length} videos, ${cachedElementImages.length} element images from cache`)
        } catch (err) {
          console.error('Failed to rehydrate assets from cache:', err)
          set({ assetsLoaded: true })
        }
      },
      getStorageStats: () => assetCache.getStorageStats(),
      clearAssetCache: async () => {
        await assetCache.clearAllAssets()
        set({ frames: {}, videos: {} })
      },

      // Generation queue
      generationQueue: {
        items: [],
        isProcessing: false,
        isPaused: false,
      },

      addToQueue: (items) => set((state) => ({
        generationQueue: {
          ...state.generationQueue,
          items: [
            ...state.generationQueue.items,
            ...items.map((item) => ({
              ...item,
              id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              status: 'pending' as const,
              progress: 0,
              retryCount: 0,
              createdAt: new Date(),
            })),
          ],
        },
      })),

      removeFromQueue: (itemId) => set((state) => ({
        generationQueue: {
          ...state.generationQueue,
          items: state.generationQueue.items.filter((i) => i.id !== itemId),
        },
      })),

      clearQueue: () => set((state) => ({
        generationQueue: {
          ...state.generationQueue,
          items: [],
          isProcessing: false,
        },
      })),

      updateQueueItem: (itemId, updates) => set((state) => ({
        generationQueue: {
          ...state.generationQueue,
          items: state.generationQueue.items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
          ),
        },
      })),

      startQueue: () => set((state) => ({
        generationQueue: {
          ...state.generationQueue,
          isProcessing: true,
          isPaused: false,
        },
      })),

      pauseQueue: () => set((state) => ({
        generationQueue: {
          ...state.generationQueue,
          isPaused: true,
        },
      })),

      resumeQueue: () => set((state) => ({
        generationQueue: {
          ...state.generationQueue,
          isPaused: false,
        },
      })),

      queueAllFrames: (type) => {
        const { clips, frames, generationQueue } = get()
        const newItems: Omit<QueueItem, 'id' | 'status' | 'progress' | 'retryCount' | 'createdAt'>[] = []

        for (const clip of clips) {
          const existingStartFrames = Object.values(frames).filter(
            (f: Frame) => f.clipId === clip.id && f.type === 'start'
          )
          const existingEndFrames = Object.values(frames).filter(
            (f: Frame) => f.clipId === clip.id && f.type === 'end'
          )

          // Check if already in queue
          const inQueueStart = generationQueue.items.some(
            (i) => i.clipId === clip.id && i.type === 'frame' && i.frameType === 'start' && i.status !== 'failed'
          )
          const inQueueEnd = generationQueue.items.some(
            (i) => i.clipId === clip.id && i.type === 'frame' && i.frameType === 'end' && i.status !== 'failed'
          )

          if ((type === 'start' || type === 'both') && existingStartFrames.length === 0 && !inQueueStart) {
            newItems.push({ type: 'frame', clipId: clip.id, frameType: 'start' })
          }
          if ((type === 'end' || type === 'both') && existingEndFrames.length === 0 && !inQueueEnd) {
            newItems.push({ type: 'frame', clipId: clip.id, frameType: 'end' })
          }
        }

        if (newItems.length > 0) {
          get().addToQueue(newItems)
        }
      },

      queueAllVideos: () => {
        const { clips, frames, videos, generationQueue } = get()
        const newItems: Omit<QueueItem, 'id' | 'status' | 'progress' | 'retryCount' | 'createdAt'>[] = []

        for (const clip of clips) {
          // Check if clip has start frame
          const hasStartFrame = Object.values(frames).some(
            (f: Frame) => f.clipId === clip.id && f.type === 'start'
          )
          // Check if clip already has video
          const hasVideo = Object.values(videos).some(
            (v: GeneratedVideo) => v.clipId === clip.id && v.status === 'complete'
          )
          // Check if already in queue
          const inQueue = generationQueue.items.some(
            (i) => i.clipId === clip.id && i.type === 'video' && i.status !== 'failed'
          )

          if (hasStartFrame && !hasVideo && !inQueue) {
            newItems.push({ type: 'video', clipId: clip.id })
          }
        }

        if (newItems.length > 0) {
          get().addToQueue(newItems)
        }
      },

      queueFrame: (clipId, frameType, prompt) => {
        const { generationQueue, addToQueue, startQueue } = get()

        // Check if already in queue (pending or processing)
        const alreadyQueued = generationQueue.items.some(
          (i) => i.clipId === clipId && i.type === 'frame' && i.frameType === frameType &&
                 (i.status === 'pending' || i.status === 'processing')
        )

        if (!alreadyQueued) {
          addToQueue([{ type: 'frame', clipId, frameType, prompt }])
          // Auto-start queue if not already processing
          if (!generationQueue.isProcessing) {
            startQueue()
          }
        }
      },

      queueVideo: (clipId, motionPrompt) => {
        const { generationQueue, addToQueue, startQueue } = get()

        // Check if already in queue (pending or processing)
        const alreadyQueued = generationQueue.items.some(
          (i) => i.clipId === clipId && i.type === 'video' &&
                 (i.status === 'pending' || i.status === 'processing')
        )

        if (!alreadyQueued) {
          addToQueue([{ type: 'video', clipId, motionPrompt }])
          // Auto-start queue if not already processing
          if (!generationQueue.isProcessing) {
            startQueue()
          }
        }
      },

      isClipQueued: (clipId, type, frameType) => {
        const { generationQueue } = get()
        return generationQueue.items.some(
          (i) => i.clipId === clipId && i.type === type &&
                 (type === 'video' || i.frameType === frameType) &&
                 (i.status === 'pending' || i.status === 'processing')
        )
      },

      // World Elements
      elements: [],
      setElements: (elements) => set({ elements }),
      addElement: (element) => set((state) => ({
        elements: [...state.elements, element],
      })),
      updateElement: (id, updates) => set((state) => ({
        elements: state.elements.map((e) =>
          e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
        ),
      })),
      deleteElement: (id) => {
        const { scenes } = get()
        // Remove element and clean up scene references
        assetCache.deleteElementImagesByElementId(id)
          .catch((err) => console.error('Failed to delete element images:', err))

        set((state) => ({
          elements: state.elements.filter((e) => e.id !== id),
          // Remove element refs from all scenes
          scenes: state.scenes.map((s) => ({
            ...s,
            elementRefs: s.elementRefs?.filter((r) => r.elementId !== id),
          })),
          // Remove element images from metadata
          elementImages: Object.fromEntries(
            Object.entries(state.elementImages).filter(([, img]) => img.elementId !== id)
          ),
        }))
      },
      getElementsByCategory: (category) => {
        return get().elements.filter((e) => e.category === category)
      },

      // Element reference images
      elementImages: {},
      setElementImage: (image) => {
        // Save to IndexedDB
        assetCache.saveElementImage({
          id: image.id,
          elementId: image.elementId,
          url: image.url,
          source: image.source,
          prompt: image.prompt,
          createdAt: image.createdAt,
        }).catch((err) => console.error('Failed to cache element image:', err))

        set((state) => {
          // Also add to element's referenceImageIds
          const elements = state.elements.map((e) =>
            e.id === image.elementId && !e.referenceImageIds.includes(image.id)
              ? { ...e, referenceImageIds: [...e.referenceImageIds, image.id] }
              : e
          )
          return {
            elementImages: { ...state.elementImages, [image.id]: image },
            elements,
          }
        })
      },
      deleteElementImage: (imageId, elementId) => {
        assetCache.deleteElementImage(imageId)
          .catch((err) => console.error('Failed to delete element image:', err))

        set((state) => {
          const { [imageId]: _, ...rest } = state.elementImages
          return {
            elementImages: rest,
            elements: state.elements.map((e) =>
              e.id === elementId
                ? { ...e, referenceImageIds: e.referenceImageIds.filter((id) => id !== imageId) }
                : e
            ),
          }
        })
      },

      // Scene element references
      addElementToScene: (sceneId, elementId) => set((state) => ({
        scenes: state.scenes.map((s) => {
          if (s.id !== sceneId) return s
          const refs = s.elementRefs || []
          if (refs.some((r) => r.elementId === elementId)) return s
          return { ...s, elementRefs: [...refs, { elementId }] }
        }),
      })),
      removeElementFromScene: (sceneId, elementId) => set((state) => ({
        scenes: state.scenes.map((s) => {
          if (s.id !== sceneId) return s
          return { ...s, elementRefs: (s.elementRefs || []).filter((r) => r.elementId !== elementId) }
        }),
      })),
      setSceneElementOverride: (sceneId, elementId, overrideDescription) => set((state) => ({
        scenes: state.scenes.map((s) => {
          if (s.id !== sceneId) return s
          return {
            ...s,
            elementRefs: (s.elementRefs || []).map((r) =>
              r.elementId === elementId ? { ...r, overrideDescription } : r
            ),
          }
        }),
      })),
      getResolvedElementsForScene: (sceneId) => {
        const { scenes, elements } = get()
        const scene = scenes.find((s) => s.id === sceneId)
        if (!scene) return []

        // If scene has element refs, resolve them
        if (scene.elementRefs && scene.elementRefs.length > 0) {
          const resolved: Array<WorldElement & { overrideDescription?: string }> = []
          for (const ref of scene.elementRefs) {
            const element = elements.find((e) => e.id === ref.elementId)
            if (element) {
              resolved.push({ ...element, overrideDescription: ref.overrideDescription })
            }
          }
          return resolved
        }

        // Fallback: synthesize virtual elements from legacy 5W fields
        const virtual: Array<WorldElement & { overrideDescription?: string }> = []
        const now = new Date().toISOString()
        if (scene.who?.length) {
          for (const name of scene.who) {
            virtual.push({ id: `legacy-who-${name}`, category: 'who', name, description: name, referenceImageIds: [], createdAt: now, updatedAt: now })
          }
        }
        if (scene.what) virtual.push({ id: `legacy-what`, category: 'what', name: scene.what, description: scene.what, referenceImageIds: [], createdAt: now, updatedAt: now })
        if (scene.when) virtual.push({ id: `legacy-when`, category: 'when', name: scene.when, description: scene.when, referenceImageIds: [], createdAt: now, updatedAt: now })
        if (scene.where) virtual.push({ id: `legacy-where`, category: 'where', name: scene.where, description: scene.where, referenceImageIds: [], createdAt: now, updatedAt: now })
        if (scene.why) virtual.push({ id: `legacy-why`, category: 'why', name: scene.why, description: scene.why, referenceImageIds: [], createdAt: now, updatedAt: now })
        return virtual
      },

      // Workflow
      workflow: initialWorkflowState,

      setWorkflowStage: (stage) => set((state) => ({
        workflow: {
          ...state.workflow,
          stage,
          // Reset progress for the new stage
          progress: {
            ...state.workflow.progress,
            ...(stage === 'transcribing' ? { transcription: 0 } : {}),
            ...(stage === 'planning' ? { planning: 0 } : {}),
            ...(stage === 'generating' ? { generation: 0 } : {}),
          },
        },
      })),

      setWorkflowProgress: (key, value) => set((state) => ({
        workflow: {
          ...state.workflow,
          progress: {
            ...state.workflow.progress,
            [key]: value,
          },
        },
      })),

      setWorkflowError: (error) => set((state) => ({
        workflow: {
          ...state.workflow,
          error: error ? { ...error, timestamp: new Date() } : null,
        },
      })),

      setAutoProgress: (enabled) => set((state) => ({
        workflow: {
          ...state.workflow,
          autoProgress: enabled,
        },
      })),

      clearWorkflowError: () => set((state) => ({
        workflow: {
          ...state.workflow,
          error: null,
        },
      })),

      // Reset
      reset: () => {
        // Clear IndexedDB in background
        assetCache.clearAllAssets().catch((err) => console.error('Failed to clear asset cache:', err))

        set((state) => ({
          project: null,
          audioFile: null,
          transcript: [],
          scenes: [],
          clips: [],
          frames: {},
          videos: {},
          elements: [],
          elementImages: {},
          timeline: initialTimelineState,
          globalStyle: '',
          // Keep model settings on reset
          history: [],
          historyIndex: -1,
          assetsLoaded: true,
          generationQueue: { items: [], isProcessing: false, isPaused: false },
          // Reset workflow but keep autoProgress preference
          workflow: {
            ...initialWorkflowState,
            autoProgress: state.workflow.autoProgress,
          },
        }))
      },
    }),
    {
      name: typeof window !== 'undefined' ? getStoreKey(getActiveProjectId()) : 'radiostar-project-default',
      partialize: (state) => ({
        // Only persist these fields
        project: state.project,
        transcript: state.transcript,
        scenes: state.scenes,
        elements: state.elements,
        // Strip large assets from clips before persisting
        clips: state.clips.map((clip) => ({
          id: clip.id,
          sceneId: clip.sceneId,
          segmentId: clip.segmentId,
          title: clip.title,
          startTime: clip.startTime,
          endTime: clip.endTime,
          order: clip.order,
          // Don't persist: startFrame, endFrame, video (large base64 blobs)
        })),
        globalStyle: state.globalStyle,
        modelSettings: state.modelSettings,
        // Persist timeline zoom only
        timeline: { zoom: state.timeline?.zoom ?? 50 },
        // Persist workflow autoProgress preference only
        workflow: { autoProgress: state.workflow?.autoProgress ?? true },
        // Don't persist: audioFile (has File object), frames/videos (large blobs), rest of timeline (UI state)
      }),
      // Custom merge to ensure workflow state is properly initialized
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ProjectStore>
        return {
          ...currentState,
          ...persisted,
          // Ensure elements defaults to empty array
          elements: persisted.elements ?? [],
          // Ensure workflow is properly merged with initial values
          workflow: {
            ...initialWorkflowState,
            autoProgress: persisted.workflow?.autoProgress ?? true,
          },
          // Ensure timeline is properly merged
          timeline: {
            ...currentState.timeline,
            zoom: persisted.timeline?.zoom ?? currentState.timeline?.zoom ?? 50,
          },
        }
      },
    }
  )
)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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

  // Transcript
  transcript: TranscriptSegment[]
  setTranscript: (segments: TranscriptSegment[]) => void

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
  createClip: (sceneId: string, startTime: number, endTime: number, title?: string) => string  // Returns new clip ID
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
  addToQueue: (items: Omit<QueueItem, 'id' | 'status' | 'progress' | 'retryCount' | 'createdAt'>[]) => void
  removeFromQueue: (itemId: string) => void
  clearQueue: () => void
  updateQueueItem: (itemId: string, updates: Partial<QueueItem>) => void
  startQueue: () => void
  pauseQueue: () => void
  resumeQueue: () => void
  queueAllFrames: (type: 'start' | 'end' | 'both') => void
  queueAllVideos: () => void

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

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // Project
      project: null,
      setProject: (project) => set({ project }),

      // Audio
      audioFile: null,
      setAudioFile: (audioFile) => set({
        audioFile,
        // Clear transcript when loading new audio
        transcript: [],
        scenes: [],
        clips: [],
      }),

      // Transcript
      transcript: [],
      setTranscript: (transcript) => set({ transcript }),

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
            // Delete the clips (and their frames/videos remain orphaned in cache)
            updatedClips = clips.filter(c => c.sceneId !== id)
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
      createClip: (sceneId, startTime, endTime, title) => {
        const { clips, scenes } = get()
        const scene = scenes.find(s => s.id === sceneId)
        const sceneClips = clips.filter(c => c.sceneId === sceneId)
        const newClipId = `clip-${Date.now()}`

        const newClip: Clip = {
          id: newClipId,
          sceneId,
          segmentId: '', // No transcript segment for manually created clips
          title: title || `Clip ${sceneClips.length + 1}`,
          startTime,
          endTime,
          order: sceneClips.length,
        }

        set((state) => ({ clips: [...state.clips, newClip] }))
        return newClipId
      },

      handleClipMoved: (clipId, newStartTime, newEndTime) => {
        const { scenes, clips, audioFile } = get()
        const clip = clips.find(c => c.id === clipId)
        if (!clip) return

        const clipMidpoint = (newStartTime + newEndTime) / 2

        // Find scene that contains the clip's midpoint
        let targetScene = scenes.find(s =>
          clipMidpoint >= s.startTime && clipMidpoint < s.endTime
        )

        if (!targetScene) {
          // No scene contains this position - create a new one
          const audioDuration = audioFile?.duration ?? 180
          const newSceneId = `scene-${Date.now()}`

          // Find the best position for new scene
          const newScene: Scene = {
            id: newSceneId,
            title: `Scene ${scenes.length + 1}`,
            description: '',
            startTime: newStartTime,
            endTime: Math.min(newEndTime, audioDuration),
            clips: [],
            order: scenes.length,
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

          // Add new scene and update clip
          const newScenes = [...scenes, newScene].sort((a, b) => a.startTime - b.startTime)
          newScenes.forEach((s, i) => { s.order = i })

          const updatedClips = clips.map(c =>
            c.id === clipId
              ? { ...c, sceneId: newSceneId, startTime: newStartTime, endTime: newEndTime }
              : c
          )

          set({ scenes: newScenes, clips: updatedClips })
        } else {
          // Update clip with new times and potentially new scene
          const updatedClips = clips.map(c =>
            c.id === clipId
              ? { ...c, sceneId: targetScene!.id, startTime: newStartTime, endTime: newEndTime }
              : c
          )

          set({ clips: updatedClips })
        }
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

          set({
            frames: framesMap,
            videos: videosMap,
            assetsLoaded: true,
          })

          console.log(`Rehydrated ${cachedFrames.length} frames and ${cachedVideos.length} videos from cache`)
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

      // Reset
      reset: () => {
        // Clear IndexedDB in background
        assetCache.clearAllAssets().catch((err) => console.error('Failed to clear asset cache:', err))

        set({
          project: null,
          audioFile: null,
          transcript: [],
          scenes: [],
          clips: [],
          frames: {},
          videos: {},
          timeline: initialTimelineState,
          globalStyle: '',
          // Keep model settings on reset
          history: [],
          historyIndex: -1,
          assetsLoaded: true,
          generationQueue: { items: [], isProcessing: false, isPaused: false },
        })
      },
    }),
    {
      name: 'radiostar-project',
      partialize: (state) => ({
        // Only persist these fields
        project: state.project,
        transcript: state.transcript,
        scenes: state.scenes,
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
        // Don't persist: audioFile (has File object), frames/videos (large blobs), rest of timeline (UI state)
      }),
    }
  )
)

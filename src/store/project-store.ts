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
} from '@/types'

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

  clips: Clip[]
  setClips: (clips: Clip[]) => void
  addClip: (clip: Clip) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  deleteClip: (id: string) => void

  // Frames
  frames: Record<string, Frame>
  setFrame: (frame: Frame) => void
  deleteFrame: (id: string) => void

  // Videos
  videos: Record<string, GeneratedVideo>
  setVideo: (video: GeneratedVideo) => void
  updateVideoStatus: (id: string, status: GeneratedVideo['status'], error?: string) => void

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
    (set) => ({
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

      // Frames
      frames: {},
      setFrame: (frame) => set((state) => ({
        frames: { ...state.frames, [frame.id]: frame }
      })),
      deleteFrame: (id) => set((state) => {
        const { [id]: _, ...rest } = state.frames
        return { frames: rest }
      }),

      // Videos
      videos: {},
      setVideo: (video) => set((state) => ({
        videos: { ...state.videos, [video.id]: video }
      })),
      updateVideoStatus: (id, status, error) => set((state) => ({
        videos: {
          ...state.videos,
          [id]: { ...state.videos[id], status, error }
        }
      })),

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
        image: 'imagen-4.0-generate-001',
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

      // Reset
      reset: () => set({
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
      }),
    }),
    {
      name: 'radiostar-project',
      partialize: (state) => ({
        // Only persist these fields
        project: state.project,
        transcript: state.transcript,
        scenes: state.scenes,
        clips: state.clips,
        globalStyle: state.globalStyle,
        modelSettings: state.modelSettings,
        // Persist timeline zoom only
        timeline: { zoom: state.timeline.zoom },
        // Don't persist: audioFile (has File object), frames/videos (large blobs), rest of timeline (UI state)
      }),
    }
  )
)

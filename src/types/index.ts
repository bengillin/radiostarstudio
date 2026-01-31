// ============================================
// AUDIO & TRANSCRIPTION
// ============================================

export interface AudioFile {
  id: string
  name: string
  url: string
  duration: number
  waveformData?: number[]
  file?: File
}

export interface TranscriptWord {
  text: string
  start: number
  end: number
  confidence: number
}

export interface TranscriptSegment {
  id: string
  text: string
  words: TranscriptWord[]
  start: number
  end: number
  type: SegmentType
}

export type SegmentType =
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'intro'
  | 'outro'
  | 'instrumental'
  | 'spoken'

// ============================================
// SCENES & CLIPS
// ============================================

export interface Scene {
  id: string
  title: string
  description: string
  startTime: number
  endTime: number
  clips: Clip[]
  order: number

  // The 5 Ws - narrative planning
  who: string[]
  what: string
  when: string
  where: string
  why: string

  // Visual direction
  aesthetic: VisualAesthetic
}

export interface Clip {
  id: string
  sceneId: string
  segmentId: string
  title: string
  startTime: number
  endTime: number
  order: number

  // Frames
  startFrame?: Frame
  endFrame?: Frame

  // Generated video
  video?: GeneratedVideo
}

export interface VisualAesthetic {
  style: string
  colorPalette: string[]
  lighting: string
  cameraMovement: string
  references?: string[]
}

// ============================================
// FRAMES & VIDEO
// ============================================

export interface Frame {
  id: string
  clipId: string
  type: 'start' | 'end'
  source: 'upload' | 'generated'
  url: string
  prompt?: string
  generatedAt?: Date
  model?: string
}

export interface GeneratedVideo {
  id: string
  clipId: string
  url: string
  duration: number
  status: VideoStatus
  startFrameId: string
  endFrameId?: string
  motionPrompt: string
  model: 'veo' | 'runway' | 'pika'
  generatedAt?: Date
  jobId?: string
  error?: string
}

export type VideoStatus = 'pending' | 'generating' | 'complete' | 'failed'

// ============================================
// PROJECT & EXPORT
// ============================================

export interface Project {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface ExportSettings {
  resolution: '1080p' | '720p' | '4k'
  format: 'mp4' | 'webm' | 'mov'
  fps: 24 | 30 | 60
  quality: 'draft' | 'standard' | 'high'
}

export interface ExportJob {
  id: string
  projectId: string
  status: 'queued' | 'processing' | 'complete' | 'failed'
  progress: number
  outputUrl?: string
  error?: string
}

// ============================================
// TIMELINE STATE
// ============================================

export interface TimelineState {
  zoom: number
  scrollX: number
  playheadTime: number
  isPlaying: boolean
  selectedClipIds: string[]
  selectedSceneId: string | null
  dragState: DragState | null
}

export interface DragState {
  type: 'move' | 'trim-start' | 'trim-end'
  clipId: string
  startX: number
  startTime: number
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface TranscriptionResponse {
  segments: TranscriptSegment[]
  duration: number
}

export interface ScenePlanResponse {
  scenes: Omit<Scene, 'clips'>[]
  globalStyle: string
}

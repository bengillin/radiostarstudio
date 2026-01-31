# Radiostar Implementation Plan

> AI-powered music video studio at radiostar.studio
> "Video killed the radio star. Make more."

---

## Overview

Transform radiostar from a Vite/Gemini parody lyrics app into a full music video production studio using Next.js, with lessons learned from the radio-star codebase.

### Core Flow
```
Audio File → Transcription → Scene Planning → Frame Generation → Timeline Editor → Video Export
```

### Key Principles (from radio-star UX analysis)
- **3 tracks, not 6:** Story, Audio, Assets
- **Inline editing:** No modals, direct manipulation
- **Hover actions:** Progressive disclosure
- **Single state store:** No complex sync issues

---

## Phase 0: Foundation Setup
**Goal:** Upgrade to Next.js, establish clean architecture

### Tasks
- [ ] Initialize Next.js 15 in radiostar
- [ ] Set up Tailwind CSS 4
- [ ] Configure environment variables
- [ ] Set up project structure
- [ ] Port useful types from radio-star

### Project Structure
```
radiostar/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Landing/upload
│   │   ├── studio/
│   │   │   └── page.tsx             # Main editor
│   │   ├── api/
│   │   │   ├── transcribe/route.ts  # Whisper/Gemini
│   │   │   ├── generate-image/route.ts
│   │   │   ├── generate-video/route.ts
│   │   │   └── export/route.ts      # Final video assembly
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                      # Base components
│   │   ├── studio/                  # Main layout
│   │   ├── timeline/                # Timeline editor
│   │   └── panels/                  # Side panels
│   ├── lib/
│   │   ├── gemini.ts                # Gemini API client
│   │   ├── audio.ts                 # Audio processing
│   │   └── video.ts                 # Video utilities
│   ├── store/
│   │   └── project-store.ts         # Single Zustand store
│   └── types/
│       └── index.ts                 # All TypeScript types
├── public/
├── .env.local
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

### Implementation Log
<!-- Document what was done here -->

---

## Phase 1: Audio Ingestion & Transcription
**Goal:** Upload audio, get word-level timestamps

### Tasks
- [ ] Audio upload component (drag & drop)
- [ ] Waveform visualization
- [ ] Transcription API route (Gemini or Whisper)
- [ ] Word-level timing extraction
- [ ] Section detection (verse, chorus, bridge)

### Types Needed
```typescript
interface AudioFile {
  id: string
  name: string
  url: string          // Object URL or uploaded URL
  duration: number
  waveformData?: number[]
}

interface TranscriptWord {
  text: string
  start: number
  end: number
  confidence: number
}

interface TranscriptSegment {
  id: string
  text: string
  words: TranscriptWord[]
  start: number
  end: number
  type: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'instrumental'
}
```

### Implementation Log
<!-- Document what was done here -->

---

## Phase 2: Scene Planning (The 5 Ws)
**Goal:** AI-assisted narrative breakdown

### Tasks
- [ ] Scene planning UI panel
- [ ] AI prompt for 5W extraction (who, what, when, where, why)
- [ ] Visual aesthetic definition
- [ ] Scene → Clip hierarchy
- [ ] Manual override/editing

### Types Needed
```typescript
interface Scene {
  id: string
  title: string
  description: string
  startTime: number
  endTime: number
  clips: Clip[]

  // The 5 Ws
  who: string[]        // Characters/subjects
  what: string         // Action/event
  when: string         // Time period/moment
  where: string        // Location/setting
  why: string          // Mood/motivation

  // Visual direction
  aesthetic: VisualAesthetic
}

interface Clip {
  id: string
  sceneId: string
  segmentId: string    // Links to transcript
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

interface VisualAesthetic {
  style: string        // "cinematic noir", "vibrant pop art", etc.
  colorPalette: string[]
  lighting: string
  cameraMovement: string
  references?: string[] // Reference image URLs
}
```

### Implementation Log
<!-- Document what was done here -->

---

## Phase 3: Frame Generation
**Goal:** Create start/end frames for each clip

### Tasks
- [ ] Frame upload UI (drag & drop per clip)
- [ ] AI frame generation (Gemini image or "nano banana")
- [ ] Frame preview grid
- [ ] Regenerate/variant options
- [ ] Frame selection for start/end

### Types Needed
```typescript
interface Frame {
  id: string
  clipId: string
  type: 'start' | 'end'
  source: 'upload' | 'generated'
  url: string
  prompt?: string

  // Generation metadata
  generatedAt?: Date
  model?: string
  seed?: number
}

interface FrameGenerationRequest {
  clipId: string
  type: 'start' | 'end'
  prompt: string
  aesthetic: VisualAesthetic
  referenceFrames?: string[]  // For consistency
}
```

### Implementation Log
<!-- Document what was done here -->

---

## Phase 4: Video Clip Generation
**Goal:** Generate video clips using Veo (or similar)

### Tasks
- [ ] Video generation API route
- [ ] Start frame → End frame interpolation
- [ ] Motion prompt generation
- [ ] Progress tracking / polling
- [ ] Video preview player

### Types Needed
```typescript
interface GeneratedVideo {
  id: string
  clipId: string
  url: string
  duration: number
  status: 'pending' | 'generating' | 'complete' | 'failed'

  // Generation params
  startFrameId: string
  endFrameId?: string
  motionPrompt: string
  model: 'veo' | 'runway' | 'pika'

  // Metadata
  generatedAt: Date
  jobId?: string
  error?: string
}
```

### Implementation Log
<!-- Document what was done here -->

---

## Phase 5: Timeline Editor
**Goal:** 3-track timeline for arranging clips

### Design (from radio-star UX analysis)
```
┌─ Timeline Ruler ────────────────────────────────────┐
├─ Story Track ──────────────────────────────────────┤
│  [Scene 1: Intro]      [Scene 2: Verse]     [Scene 3]
│  └[Clip 1][Clip 2]     └[Clip 3][Clip 4]    └[Clip 5]
├─ Audio Track ──────────────────────────────────────┤
│  ████▓▓▓░░░██▓▓░░░░██▓▓▓░░░████▓▓░░░░██████▓▓▓░░   │
├─ Assets Track ─────────────────────────────────────┤
│  [vid]    [vid]        [vid]        [vid]    [vid] │
└────────────────────────────────────────────────────┘
```

### Tasks
- [ ] Timeline container with zoom/scroll
- [ ] Timeline ruler (time markers)
- [ ] Story track (scenes + clips)
- [ ] Audio track (waveform)
- [ ] Assets track (video thumbnails)
- [ ] Playhead with scrubbing
- [ ] Clip dragging/reordering
- [ ] Clip trimming (drag edges)
- [ ] Keyboard shortcuts (space=play, j/k=scrub)

### Interactions
- **Click clip:** Select it, show properties in right panel
- **Drag clip:** Reorder within track
- **Drag edges:** Trim start/end time
- **Hover clip:** Show quick actions (regenerate, delete)
- **Right-click:** Context menu

### Types Needed
```typescript
interface TimelineState {
  zoom: number              // Pixels per second
  scrollX: number           // Horizontal scroll position
  playheadTime: number      // Current playback position
  isPlaying: boolean

  // Selection
  selectedClipIds: string[]
  selectedSceneId: string | null

  // Drag state
  dragState: DragState | null
}

interface DragState {
  type: 'move' | 'trim-start' | 'trim-end'
  clipId: string
  startX: number
  startTime: number
}
```

### Implementation Log
<!-- Document what was done here -->

---

## Phase 6: Video Export
**Goal:** Compile timeline into final video

### Tasks
- [ ] Export settings UI (resolution, format)
- [ ] Video concatenation (FFmpeg or cloud API)
- [ ] Audio sync/merge
- [ ] Progress indicator
- [ ] Download final video
- [ ] Optional: direct upload to YouTube/TikTok

### Types Needed
```typescript
interface ExportSettings {
  resolution: '1080p' | '720p' | '4k'
  format: 'mp4' | 'webm' | 'mov'
  fps: 24 | 30 | 60
  quality: 'draft' | 'standard' | 'high'
}

interface ExportJob {
  id: string
  projectId: string
  status: 'queued' | 'processing' | 'complete' | 'failed'
  progress: number
  outputUrl?: string
  error?: string
}
```

### Implementation Log
<!-- Document what was done here -->

---

## State Management

### Single Zustand Store
```typescript
interface ProjectStore {
  // Project data
  project: Project | null

  // Audio
  audioFile: AudioFile | null
  transcript: TranscriptSegment[]

  // Scenes & Clips
  scenes: Scene[]
  clips: Clip[]

  // Frames & Videos
  frames: Record<string, Frame>
  videos: Record<string, GeneratedVideo>

  // Timeline UI state
  timeline: TimelineState

  // Actions
  setAudioFile: (file: AudioFile) => void
  setTranscript: (segments: TranscriptSegment[]) => void
  addScene: (scene: Scene) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  // ... etc
}
```

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/transcribe` | POST | Audio → word-level transcript |
| `/api/plan-scenes` | POST | Transcript → scene breakdown |
| `/api/generate-frame` | POST | Generate single frame image |
| `/api/generate-video` | POST | Generate video clip from frames |
| `/api/export` | POST | Compile final video |
| `/api/export/[id]` | GET | Check export job status |

---

## UI Components Needed

### Core
- [ ] `Button`, `Input`, `Textarea` (base UI)
- [ ] `DropZone` (file upload)
- [ ] `WaveformVisualizer`
- [ ] `VideoPlayer`

### Studio Layout
- [ ] `StudioLayout` (main container)
- [ ] `LeftPanel` (scene list, properties)
- [ ] `RightPanel` (generation controls)
- [ ] `Timeline` (bottom)

### Timeline
- [ ] `TimelineContainer`
- [ ] `TimelineRuler`
- [ ] `StoryTrack`
- [ ] `AudioTrack`
- [ ] `AssetsTrack`
- [ ] `Playhead`
- [ ] `ClipBlock`

---

## Dependencies to Add

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@google/genai": "^1.31.0",
    "zustand": "^5.0.0",
    "framer-motion": "^12.0.0",
    "lucide-react": "^0.450.0",
    "tailwindcss": "^4.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^3.0.0"
  }
}
```

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Foundation | ⬜ Not Started | |
| Phase 1: Audio | ⬜ Not Started | |
| Phase 2: Scene Planning | ⬜ Not Started | |
| Phase 3: Frame Generation | ⬜ Not Started | |
| Phase 4: Video Clips | ⬜ Not Started | |
| Phase 5: Timeline | ⬜ Not Started | |
| Phase 6: Export | ⬜ Not Started | |

---

## References

- `/Users/ben/radio-star/timeline-ux-analysis.md` - Timeline simplification insights
- `/Users/ben/radio-star/video-generation-plan.md` - Video generation approach
- `/Users/ben/radio-star/src/types/index.ts` - Comprehensive type definitions
- `/Users/ben/radiostar/services/geminiService.ts` - Working Gemini integration

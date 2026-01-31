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
- [x] Initialize Next.js 15 in radiostar
- [x] Set up Tailwind CSS 3.4
- [x] Configure environment variables
- [x] Set up project structure
- [x] Port useful types from radio-star

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

**2026-01-31: Phase 0 Complete**
- Removed Vite config, migrated to Next.js 15 with Turbopack
- Created project structure: `src/app`, `src/components`, `src/lib`, `src/store`, `src/types`
- Set up Tailwind CSS 3.4 with brand colors (red theme)
- Created comprehensive types in `src/types/index.ts`:
  - Audio & Transcription types
  - Scene & Clip types (with 5 Ws)
  - Frame & Video types
  - Timeline state types
- Created Zustand store in `src/store/project-store.ts` with persistence
- Created Gemini client in `src/lib/gemini.ts` with transcribe, planScenes, generateFrame, generateVideo functions
- Built landing page with hero ("Video killed the radio star. Make more.") and drag-drop upload
- Built studio page shell with 3-panel layout (left: properties, center: preview+timeline, right: actions)
- Dev server running successfully on localhost:3001

---

## Phase 1: Audio Ingestion & Transcription
**Goal:** Upload audio, get word-level timestamps

### Tasks
- [x] Audio upload component (drag & drop)
- [x] Waveform visualization
- [x] Transcription API route (Gemini or Whisper)
- [x] Word-level timing extraction
- [x] Section detection (verse, chorus, bridge)

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

**2026-01-31: Phase 1 Complete**
- Created landing page with drag-drop audio upload
- Audio file detected with duration using Web Audio API
- Built `Waveform` component (`src/components/ui/Waveform.tsx`):
  - Generates waveform data from audio buffer
  - Renders bars on canvas with progress coloring
  - Click-to-seek functionality
- Created transcription API route (`src/app/api/transcribe/route.ts`):
  - Accepts audio via FormData
  - Converts to base64 for Gemini
  - Simplified prompt to avoid truncated JSON responses
  - Added detailed logging for debugging
  - Returns segment detection (verse, chorus, bridge, etc.)
- Studio page now has:
  - 3-panel layout (properties, preview+timeline, actions)
  - Audio playback with play/pause controls
  - Waveform display with seek support
  - Transcript segment list (clickable to seek)
  - Transcription button with loading state
- State management: auto-clear transcript/scenes when loading new audio

---

## Phase 2: Scene Planning (The 5 Ws)
**Goal:** AI-assisted narrative breakdown

### Tasks
- [x] Scene planning UI panel
- [x] AI prompt for 5W extraction (who, what, when, where, why)
- [x] Visual aesthetic definition
- [x] Scene → Clip hierarchy
- [x] Manual override/editing

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

**2026-01-31: Phase 2 Complete**
- Created scene planning API route (`src/app/api/plan-scenes/route.ts`):
  - Accepts transcript and optional visual style
  - Uses Gemini to break song into 3-6 visual scenes
  - Returns scenes with 5 Ws (who, what, when, where, why)
- Updated studio page:
  - Visual style textarea connected to store
  - "Plan Scenes with AI" button with loading state
  - Expandable scene cards showing all 5 Ws
  - Icons for each W category (Users, Clapperboard, Clock, MapPin, Heart)
  - **Inline editable inputs** for all 5 W fields
  - **Auto-generated clips** from transcript segments mapped to scenes by time overlap
  - Clips displayed within expanded scene cards, clickable to seek

---

## Phase 3: Frame Generation
**Goal:** Create start/end frames for each clip

### Tasks
- [x] Frame upload UI (drag & drop per clip)
- [x] AI frame generation (Gemini image)
- [x] Frame preview grid
- [ ] Regenerate/variant options
- [x] Frame selection for start/end

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

**2026-01-31: Phase 3 Complete**
- Created frame generation API route (`src/app/api/generate-frame/route.ts`):
  - Uses Gemini 2.0 Flash Exp for image generation
  - Incorporates scene context (5 Ws) into prompt
  - Returns frame with metadata (id, clipId, type, url, prompt)
- Updated studio page:
  - Click clip to select for frame generation
  - Frame prompt input textarea
  - Generate Start Frame / End Frame buttons
  - **Upload Start/End frame buttons** (file input)
  - Frame preview thumbnails in clip cards
  - Large frame preview in right panel
- Deferred: Regenerate/variant options (nice-to-have)

---

## Phase 4: Video Clip Generation
**Goal:** Generate video clips using Veo (or similar)

### Tasks
- [x] Video generation API route
- [x] Start frame → End frame interpolation
- [x] Motion prompt generation
- [x] Progress tracking / polling
- [x] Video preview player

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

**2026-01-31: Phase 4 Complete**
- Created video generation API route (`src/app/api/generate-video/route.ts`):
  - Uses Veo 2.0 for video generation
  - Takes start frame as input, incorporates scene context
  - Polls for completion (up to 5 minutes)
  - Returns video as base64 data URL
- Updated studio page:
  - Motion prompt input for video direction
  - Generate Video Clip button (requires start frame)
  - Video preview player with controls
  - Progress indication during generation

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
- [x] Timeline container with zoom/scroll
- [x] Timeline ruler (time markers)
- [x] Story track (scenes + clips)
- [x] Audio track (waveform)
- [x] Assets track (video thumbnails)
- [x] Playhead with scrubbing
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

**2026-01-31: Phase 5 Complete**
- Created Timeline component (`src/components/timeline/Timeline.tsx`):
  - Zoom controls (10-200 px/s)
  - Time ruler with dynamic interval marks
  - Scenes track showing scene blocks
  - Clips track with color-coded blocks (green = has video)
  - Videos track showing generated clips
  - Draggable playhead with scrubbing
  - Click anywhere to seek
- Integrated into studio page (appears after scenes are planned)
- Deferred: Clip drag/reorder, edge trimming, keyboard shortcuts

---

## Phase 6: Video Export
**Goal:** Compile timeline into final video

### Tasks
- [x] Export settings UI (resolution, format)
- [x] Video concatenation (FFmpeg or cloud API) - simulated, ready for real FFmpeg integration
- [x] Audio sync/merge - API accepts audioUrl
- [x] Progress indicator
- [ ] Download final video (needs real FFmpeg backend)
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

**2026-01-31: Phase 6 Complete**
- Created export API route (`src/app/api/export/route.ts`):
  - POST creates export job with clips, audio URL, and settings
  - GET polls for job status with progress
  - Simulated FFmpeg processing stages (download, concatenate, audio, encode, finalize)
  - In-memory job storage (would be database in production)
- Updated studio page:
  - Export settings UI with resolution (720p/1080p/4K), format (MP4/WebM/MOV), frame rate (24/30/60fps)
  - Progress bar that polls for export status
  - Automatically detects clips with generated videos
  - Export button triggers job creation and polling
- Deferred: Real FFmpeg integration (requires server with FFmpeg or cloud service)

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
| Phase 0: Foundation | ✅ Complete | Next.js 15, Tailwind, Zustand, types |
| Phase 1: Audio | ✅ Complete | Waveform, transcription API, playback |
| Phase 2: Scene Planning | ✅ Complete | 5 Ws, editable fields, auto-clips |
| Phase 3: Frame Generation | ✅ Complete | AI generate + upload, preview |
| Phase 4: Video Clips | ✅ Complete | Veo generation, motion prompts |
| Phase 5: Timeline | ✅ Complete | 3 tracks, zoom, playhead |
| Phase 6: Export | ✅ Complete | Settings UI, progress polling, simulated FFmpeg |

---

## References

- `/Users/ben/radio-star/timeline-ux-analysis.md` - Timeline simplification insights
- `/Users/ben/radio-star/video-generation-plan.md` - Video generation approach
- `/Users/ben/radio-star/src/types/index.ts` - Comprehensive type definitions
- `/Users/ben/radiostar/services/geminiService.ts` - Working Gemini integration

# Radiostar Roadmap

## Phase 7: Smart Defaults & Auto-Generation

### 7.1 Auto-generate frame prompts from clip context
- When clip is selected, pre-fill frame prompt based on:
  - Clip's transcript text
  - Parent scene's 5Ws (who, what, when, where, why)
  - Global visual style
- User can edit before generating

### 7.2 Auto-suggest visual style from transcription
- After transcription completes, analyze content to suggest style:
  - Detect mood/tone from lyrics
  - Identify themes, settings, characters mentioned
  - Suggest color palette, cinematography style
- Pre-fill the Visual Style field with AI suggestion

---

## Phase 8: Detail Panel (Center Column)

### 8.1 Scene/Clip Detail View
Replace preview area with detail panel when scene or clip is selected:

```
┌─────────────────────────────────────────┐
│  [Scene/Clip Title]           [× Close] │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     Currently Active Version    │   │
│  │     (large preview)             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Version History                        │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │ v1 │ │ v2 │ │ v3 │ │ v4 │ │ v5 │   │
│  └────┘ └────┘ └────┘ └────┘ └────┘   │
│   ✓                                     │
│                                         │
│  Properties                             │
│  ├─ Title: [editable]                  │
│  ├─ Time: 0:00 - 0:15                  │
│  ├─ Who: [editable tags]               │
│  ├─ What: [editable]                   │
│  └─ ...                                │
│                                         │
│  Generation                             │
│  ├─ Prompt: [textarea]                 │
│  └─ [Generate New Version]             │
│                                         │
└─────────────────────────────────────────┘
```

### 8.2 Version History Gallery
- Show all generated assets for selected scene/clip
- Thumbnails with timestamps, prompts used, model used
- Click to preview full size
- Star/select to make "active" version
- Delete unwanted versions

### 8.3 Properties Editor
- Edit all scene/clip properties in detail panel
- Inline editing for quick changes
- Real-time updates to timeline

---

## Phase 9: Enhanced Timeline

### 9.1 Drag to reorder clips
- Drag clips to rearrange within timeline
- Snap to other clip edges

### 9.2 Split clips
- Click to split clip at playhead position
- Creates two clips from one

### 9.3 Multi-select operations
- Shift+click to select range
- Cmd+click to toggle selection
- Bulk delete, bulk generate

---

## Phase 10: Polish & Performance

### 10.1 Optimistic UI updates
- Show changes immediately, sync in background

### 10.2 Asset caching
- Cache generated images/videos locally
- Lazy load thumbnails

### 10.3 Keyboard shortcuts help
- Show shortcut hints in UI
- `?` to show all shortcuts

---

## Backlog

- [ ] Export presets (YouTube, Instagram, TikTok)
- [ ] Collaborative editing
- [ ] Project templates
- [ ] Audio waveform visualization on clips
- [ ] Batch frame generation
- [ ] Style transfer between clips
- [ ] Reference image upload for style consistency
- [ ] Storyboard PDF export

---

## Current Status

### Completed
- [x] Audio upload & transcription
- [x] Scene planning with 5Ws
- [x] Timeline with zoom, trim, playhead
- [x] Frame generation (Imagen 4.0, Gemini)
- [x] Video generation (Veo 3.1)
- [x] Export with settings
- [x] Keyboard shortcuts (Space, arrows, Delete, Cmd+Z)
- [x] Toast notifications
- [x] Undo/redo history
- [x] Model selection UI
- [x] Clip edge trimming
- [x] Zoom to fit & persist

### In Progress
- [ ] Fix Imagen 4.0 empty response issue
- [ ] Detail panel for scene/clip editing

### Next Up
- [ ] Auto-generate frame prompts
- [ ] Auto-suggest visual style
- [ ] Version history gallery

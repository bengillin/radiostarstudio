# Radiostar Backlog

Feature ideas and enhancements for future development.

---

## High Priority

### Asset Caching with IndexedDB
**Problem:** Generated frames and videos are lost on page refresh since they're too large for localStorage.

**Solution:**
- Use IndexedDB to store generated assets (frames, videos)
- Store asset metadata in Zustand/localStorage, actual blobs in IndexedDB
- Lazy load thumbnails from IndexedDB on mount
- Add cache management UI (clear cache, show storage used)

**Implementation:**
- Create `src/lib/asset-cache.ts` with IndexedDB wrapper
- Store frames/videos by ID with clipId index
- On app load, rehydrate clip assets from IndexedDB
- Add storage indicator in settings

---

### Export Presets
**Problem:** Users need to manually configure export settings for different platforms.

**Solution:**
- Add preset buttons: YouTube, Instagram Reels, TikTok, Twitter/X
- Each preset configures resolution, aspect ratio, duration limits, format

**Presets:**
| Platform | Resolution | Aspect Ratio | Max Duration | Format |
|----------|------------|--------------|--------------|--------|
| YouTube | 1080p/4K | 16:9 | unlimited | MP4 |
| Instagram Reels | 1080x1920 | 9:16 | 90s | MP4 |
| TikTok | 1080x1920 | 9:16 | 3min | MP4 |
| Twitter/X | 1280x720 | 16:9 | 2:20 | MP4 |

---

### Batch Frame Generation
**Problem:** Generating frames one-by-one is tedious for many clips.

**Solution:**
- "Generate All Frames" button that queues all clips without start frames
- Progress indicator showing X of Y complete
- Parallel generation (2-3 at a time) with rate limiting
- Skip clips that already have frames

**UI:**
- Button in toolbar or right panel
- Modal showing generation queue with progress
- Cancel button to stop batch

---

## Medium Priority

### Audio Waveform on Timeline Clips
**Problem:** Hard to see audio intensity/beats when placing clips.

**Solution:**
- Render mini waveform inside each clip on timeline
- Use pre-computed waveform data from transcription step
- Color-code by amplitude or frequency

**Implementation:**
- Compute waveform peaks during audio upload
- Store as array of amplitude values
- Render as SVG path or canvas in clip element

---

### Reference Image Upload
**Problem:** Style consistency across clips is hard to maintain.

**Solution:**
- Allow uploading 1-3 reference images for style guidance
- Include reference images in frame generation prompts
- Show reference images in style panel

**Implementation:**
- Add dropzone in Visual Style section
- Store reference images in store (base64 or IndexedDB)
- Pass to generate-frame API as additional context

---

### Style Transfer Between Clips
**Problem:** Want to apply the style of one generated frame to other clips.

**Solution:**
- "Use as Style Reference" button on generated frames
- Apply that frame's characteristics to new generations
- Store style reference per scene or globally

---

### Storyboard PDF Export
**Problem:** Need to share visual plan before full video generation.

**Solution:**
- Export scenes and frames as printable PDF storyboard
- Include scene titles, timestamps, frame images, prompts
- Layout: 2-3 frames per page with annotations

**Implementation:**
- Use jsPDF or similar library
- Generate on client side
- Include cover page with project info

---

## Lower Priority

### Project Templates
**Problem:** Starting from scratch every time is slow.

**Solution:**
- Pre-built templates for common music video styles
- Templates include: scene structure, visual style, example prompts
- "Start from template" option on home page

**Template ideas:**
- Performance video (single location, artist focus)
- Narrative (story arc with characters)
- Abstract/visualizer (mood-based, no characters)
- Lyric video (text-focused with backgrounds)

---

### Collaborative Editing
**Problem:** Teams can't work on same project together.

**Solution:**
- Cloud sync with real-time collaboration
- User accounts and project sharing
- Presence indicators (who's editing what)
- Comment/feedback system on clips

**Requires:**
- Backend database (Supabase, Firebase, or custom)
- WebSocket for real-time sync
- Authentication system

---

### Clip Snapping
**Problem:** Hard to align clips precisely on timeline.

**Solution:**
- Snap clips to other clip edges when dragging
- Snap to playhead position
- Snap to scene boundaries
- Hold modifier key to disable snapping

---

### Keyboard Navigation
**Problem:** Can't navigate timeline efficiently with keyboard.

**Solution:**
- J/K/L for playback speed control (rewind/pause/forward)
- [ and ] to jump between clips
- Home/End to go to start/end
- Tab to cycle through clips

---

## Technical Debt

### Fix Imagen 4.0 API
- Currently returns empty responses
- Investigate correct request format
- May need different endpoint or parameters
- For now, defaulting to Gemini image model

### Optimize Large Project Performance
- Virtualize timeline for many clips
- Lazy render off-screen elements
- Debounce frequent store updates

### Add Tests
- Unit tests for store actions
- Integration tests for API routes
- E2E tests for critical flows

---

## Ideas Parking Lot

Things to consider but not yet scoped:

- AI-powered auto-edit (automatic clip placement based on beat detection)
- Music analysis for automatic scene breaks
- Voice-over recording integration
- Stock footage/image search integration
- Custom font upload for lyric videos
- Green screen / background removal
- Motion tracking for text placement
- Export to video editing software (Premiere XML, Final Cut XML)

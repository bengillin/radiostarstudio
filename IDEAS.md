# Radiostar Future Ideas

> Creative directions and feature concepts for making Radiostar even more powerful. These are documented for future exploration, not immediate implementation.

---

## Table of Contents

1. [AI Director Mode](#1-ai-director-mode)
2. [Music-Aware Intelligence](#2-music-aware-intelligence)
3. [Character Persistence](#3-character-persistence)
4. [Sketch-to-Video](#4-sketch-to-video)
5. [Lip-Sync Mode](#5-lip-sync-mode)
6. [Multi-Format Instant Cuts](#6-multi-format-instant-cuts)
7. [Advanced Timeline](#7-advanced-timeline)
8. [Iteration & Variation](#8-iteration--variation)
9. [Real-Time Preview Mode](#9-real-time-preview-mode)
10. [Style Learning](#10-style-learning)
11. [Interactive / Branching Videos](#11-interactive--branching-videos)
12. [Collaborative & Social](#12-collaborative--social)

---

## 1. AI Director Mode

### Vision
"Upload a song, get a complete music video draft in minutes."

The ultimate expression of Radiostar's AI capabilities: a fully autonomous mode where the user provides only the audio file and the system makes all creative decisions—scene planning, visual style, frame generation, video creation, and editing.

### User Experience

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│     🎵 Drop your audio file here                           │
│                                                             │
│     ─────────────────────────────────────────               │
│                                                             │
│     Director Style:                                         │
│     ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│     │ Auto    │ │ Gondry  │ │ Jonze   │ │ Hype    │       │
│     │ Detect  │ │ Dreamy  │ │ Intimate│ │ Williams│       │
│     └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│                                                             │
│     Genre Hint (optional):                                  │
│     [ Hip-Hop ▾ ]                                          │
│                                                             │
│     [ 🎬 Create My Video ]                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Director Style Presets

| Preset | Characteristics |
|--------|-----------------|
| **Auto Detect** | Analyze audio mood/genre, choose appropriate style |
| **Michel Gondry** | Whimsical, handmade aesthetic, practical effects feel, surreal transitions |
| **Spike Jonze** | Intimate, emotional, naturalistic lighting, focus on human connection |
| **Hype Williams** | High contrast, fisheye distortion, luxury aesthetic, bold colors |
| **David Fincher** | Dark, moody, precise framing, desaturated palette |
| **Wes Anderson** | Symmetrical composition, pastel palette, quirky characters |
| **A24 Indie** | Naturalistic, golden hour, grainy texture, contemplative |
| **80s MTV** | Neon, VHS artifacts, smoke machines, dramatic lighting |
| **Lyric Video** | Text-focused, kinetic typography, minimal imagery |
| **Abstract/Visualizer** | No narrative, pure visual interpretation of sound |

### Pipeline

1. **Audio Analysis** (5-10 seconds)
   - Transcribe lyrics
   - Detect tempo, key, energy curve
   - Identify sections (intro, verse, chorus, bridge, outro)
   - Classify genre and mood

2. **Creative Brief Generation** (10-20 seconds)
   - Generate visual style description
   - Create narrative arc or thematic concept
   - Define color palette
   - Establish character descriptions (if narrative)

3. **Scene Planning** (10-20 seconds)
   - Break into 4-8 scenes based on song structure
   - Assign 5 Ws to each scene
   - Determine visual approach per section

4. **Frame Generation** (2-5 minutes)
   - Generate key frames for each clip
   - Batch process with style consistency
   - Create start/end frames for motion

5. **Video Generation** (5-15 minutes)
   - Generate video clips from frames
   - Process in parallel where possible
   - Handle failures gracefully with regeneration

6. **Assembly** (1-2 minutes)
   - Arrange clips on timeline
   - Add transitions
   - Sync to audio
   - Apply color grading

7. **Review & Iterate**
   - Present draft to user
   - Allow scene-by-scene approval/regeneration
   - Fine-tune specific moments

### "Surprise Me" Mode

A sub-feature of Director Mode where the system makes deliberately unexpected choices:
- Mix genres (country song with cyberpunk visuals)
- Unexpected narrative (love song becomes sci-fi story)
- Visual juxtaposition (heavy metal with pastel animation)

### Technical Considerations

- **Queue Management**: Long-running job that can be monitored
- **Checkpoint System**: Save progress at each stage, allow resume
- **Parallel Processing**: Generate multiple clips simultaneously
- **Failure Handling**: Automatic retry with modified prompts
- **Cost Estimation**: Show estimated API costs before starting

---

## 2. Music-Aware Intelligence

### Vision
Let the audio itself drive creative decisions. The rhythm, energy, mood, and structure of the music should directly influence the visual output.

### Beat Detection & Auto-Cut

**Goal**: Cuts happen on beats, not arbitrary intervals.

#### Implementation Approach

```typescript
interface BeatMap {
  bpm: number
  beats: number[]           // Timestamps of detected beats
  downbeats: number[]       // First beat of each measure
  drops: number[]           // High-energy moments
  transitions: number[]     // Section changes
}

interface AutoCutSettings {
  cutOn: 'beat' | 'downbeat' | 'measure' | 'phrase'
  minClipDuration: number   // Don't cut faster than this
  maxClipDuration: number   // Force cut if longer than this
  syncToDrops: boolean      // Dramatic cuts on drops
}
```

#### Visual Sync Options

| Audio Event | Visual Response |
|-------------|-----------------|
| Beat | Cut to new angle/frame |
| Downbeat | Scene change |
| Drop | Flash, zoom, dramatic reveal |
| Build-up | Increasing cut frequency, zoom in |
| Breakdown | Slower cuts, pull back, breathe |
| Silence | Hold on single image, fade to black |

### Energy Mapping

**Goal**: Visual intensity matches audio intensity.

#### Energy Curve Analysis

```
Audio Energy Over Time:
     ▁▂▃▅▇█▇▅▃▂▁▂▃▄▅▆▇████▇▅▃▁
     |   verse   |  chorus  | verse |  chorus  |
```

Map energy levels to:
- **Cut frequency**: Higher energy = faster cuts
- **Camera movement**: Higher energy = more dynamic movement
- **Color saturation**: Higher energy = more vibrant
- **Visual complexity**: Higher energy = more elements on screen

#### Implementation

```typescript
interface EnergySegment {
  start: number
  end: number
  level: number           // 0-1 normalized energy
  trend: 'rising' | 'falling' | 'stable'
}

interface VisualMapping {
  cutFrequency: number    // Cuts per second at this energy
  motionIntensity: number // Camera movement speed
  saturation: number      // Color intensity
  complexity: number      // Visual density
}
```

### Mood Analysis

**Goal**: Color and style adapt to emotional content.

#### Mood Detection Signals

- **Lyrics sentiment**: Happy/sad/angry/nostalgic/hopeful
- **Musical key**: Major (bright) vs minor (dark)
- **Tempo**: Fast (energetic) vs slow (contemplative)
- **Instrumentation**: Acoustic (warm) vs electronic (cool)

#### Mood-to-Style Mapping

| Mood | Color Palette | Lighting | Style Keywords |
|------|---------------|----------|----------------|
| Joyful | Warm yellows, oranges | Bright, sunny | Vibrant, playful, dynamic |
| Melancholic | Blues, muted tones | Soft, diffused | Intimate, quiet, reflective |
| Angry | Reds, high contrast | Harsh, dramatic | Aggressive, intense, bold |
| Nostalgic | Sepia, faded colors | Golden hour | Vintage, soft, dreamy |
| Hopeful | Pastels, light blues | Dawn lighting | Airy, ascending, open |
| Mysterious | Deep purples, shadows | Low key | Atmospheric, obscured, moody |

### Instrumental Section Handling

**Problem**: No lyrics during instrumental breaks—what visuals to show?

**Solutions**:

1. **Abstract Visualizer**: Pure visual interpretation of sound
   - Waveform-reactive shapes
   - Particle systems driven by frequency
   - Geometric patterns pulsing to beat

2. **Establishing Shots**: Use for world-building
   - Wide shots of setting
   - Time-lapse transitions
   - Environmental details

3. **Character Moments**: Silent storytelling
   - Reaction shots
   - Walking/traveling sequences
   - Emotional beats without dialogue

4. **Visual Motifs**: Recurring symbolic imagery
   - Objects that represent themes
   - Abstract representations of lyrics themes

### Section-Aware Transitions

| Transition Type | When to Use |
|-----------------|-------------|
| Hard cut | Beat-synced moments, energy peaks |
| Crossfade | Verse to chorus, mood shifts |
| Flash/white | Drops, dramatic moments |
| Zoom transition | Building energy |
| Match cut | Thematic connections |
| Fade to black | End of section, breath moments |

---

## 3. Character Persistence

### Vision
The biggest challenge in AI-generated video: keeping characters looking consistent across frames and clips. Solve this, and Radiostar produces actually usable music videos.

### The Problem

Current AI image/video generation creates a new interpretation of "a woman with red hair" every single time. For music videos, you need:
- The same person across 50+ frames
- Consistent wardrobe within scenes
- Recognizable features from any angle
- Emotional range while maintaining identity

### Character Sheet System

```
┌─────────────────────────────────────────────────────────────┐
│ Characters                                        [+ Add]   │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 👤 MAYA (Primary)                              [Edit]  │ │
│ │                                                        │ │
│ │ Reference Images:                                      │ │
│ │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                      │ │
│ │ │Front│ │Side │ │Back │ │3/4  │  [+ Upload]          │ │
│ │ └─────┘ └─────┘ └─────┘ └─────┘                      │ │
│ │                                                        │ │
│ │ Description:                                           │ │
│ │ "Woman in her late 20s, shoulder-length dark curly    │ │
│ │  hair, warm brown skin, expressive brown eyes,        │ │
│ │  small nose ring, confident demeanor"                 │ │
│ │                                                        │ │
│ │ Wardrobe by Scene:                                     │ │
│ │ • Scene 1-2: Red leather jacket, black jeans          │ │
│ │ • Scene 3-4: White flowing dress                      │ │
│ │ • Scene 5: Same as Scene 1                            │ │
│ │                                                        │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 👤 JORDAN (Secondary)                          [Edit]  │ │
│ │ ...                                                    │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Approaches

#### Approach 1: Reference Image Injection

Include character reference images in every generation prompt:
- Upload 3-5 reference images per character
- Automatically include in frame generation API calls
- Use image-to-image with character as anchor

```typescript
interface Character {
  id: string
  name: string
  role: 'primary' | 'secondary' | 'background'
  referenceImages: string[]     // Base64 or URLs
  description: string
  wardrobeByScene: Record<string, string>
  physicalDetails: {
    age: string
    hairColor: string
    hairStyle: string
    skinTone: string
    bodyType: string
    distinguishingFeatures: string[]
  }
}
```

#### Approach 2: Hero Shot System

1. Generate one "perfect" frame of each character
2. Use that frame as the reference for all subsequent generations
3. Allow user to regenerate until hero shot is approved
4. Lock hero shot as style anchor

```
┌─────────────────────────────────────────┐
│ Hero Shot: MAYA                         │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │     [Generated character image]     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [ Approve ✓ ]  [ Regenerate ↻ ]        │
│                                         │
│ ⚠️ This image will be used as          │
│    reference for all frames with Maya   │
└─────────────────────────────────────────┘
```

#### Approach 3: Face Embedding / LoRA

More advanced (requires model fine-tuning):
- Extract face embedding from reference photos
- Train lightweight LoRA on character appearance
- Apply LoRA to all generations featuring that character

This is model-dependent and may require:
- Replicate custom models
- Stability AI fine-tuning
- Custom Flux LoRA training

### Consistency Scoring

After generating frames, score them for character consistency:

```typescript
interface ConsistencyCheck {
  frameId: string
  characterId: string
  score: number           // 0-1 similarity to reference
  issues: string[]        // "Hair color mismatch", "Face structure differs"
  autoRegenerate: boolean // If score below threshold
}
```

### Wardrobe Management

Characters need consistent clothing within scenes:

```
Scene 1: "Downtown Night"
├─ Maya: Red leather jacket, black jeans, white sneakers
├─ Jordan: Blue hoodie, gray sweats
└─ Extras: Casual streetwear

Scene 2: "The Club"
├─ Maya: Same red jacket (continuity)
├─ Jordan: Same hoodie
└─ Extras: Club attire
```

Auto-inject wardrobe into prompts:
- "Maya wearing her red leather jacket and black jeans"
- Detect scene boundaries, update wardrobe accordingly

---

## 4. Sketch-to-Video

### Vision
Lower the barrier to creative input. Not everyone can write detailed prompts, but many can sketch, speak, or collect reference images.

### Rough Sketch Input

**User draws rough storyboard → AI refines to full frames**

```
┌─────────────────────────────────────────────────────────────┐
│ Sketch Input                                                │
│                                                             │
│ ┌─────────────────────┐    ┌─────────────────────┐        │
│ │                     │    │                     │        │
│ │   [User's rough     │ →  │   [AI-refined      │        │
│ │    stick figure     │    │    detailed frame] │        │
│ │    sketch]          │    │                     │        │
│ │                     │    │                     │        │
│ └─────────────────────┘    └─────────────────────┘        │
│                                                             │
│ Your sketch shows:                                          │
│ "Person standing on left, city skyline behind,              │
│  arm raised pointing at moon"                               │
│                                                             │
│ [ Refine with Style: Cinematic Noir ▾ ]                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Implementation

1. **Canvas Component**: Simple drawing tool
   - Basic brush, eraser
   - Shape tools (rectangle, circle, line)
   - Color palette (for indicating elements)
   - Layers for foreground/background

2. **Sketch Interpretation**: AI analyzes sketch
   - Identify shapes and their likely meaning
   - Detect spatial relationships
   - Interpret annotations or labels

3. **Prompt Generation**: Convert interpretation to prompt
   - Combine with visual style settings
   - Include scene context
   - Add character references if defined

4. **Refinement Loop**:
   - Generate frame from sketch
   - User can sketch modifications
   - Regenerate with corrections

### Voice Input

**Describe scenes by talking → AI transcribes and generates**

```
┌─────────────────────────────────────────────────────────────┐
│ Voice Input                                      [🎤 Record]│
│                                                             │
│ "So for this part, I'm imagining she's walking through     │
│  a rainy city street at night, neon signs reflecting       │
│  in the puddles, and she looks kind of sad but also        │
│  determined, you know? And there's this umbrella she's     │
│  not really using, just holding it..."                     │
│                                                             │
│ ──────────────────────────────────────────────────────────  │
│                                                             │
│ Extracted Scene:                                            │
│ • Setting: Rainy city street, night, neon signs            │
│ • Character: Woman (she/her), emotional state: melancholic │
│   but resolute                                              │
│ • Props: Umbrella (held, not open)                         │
│ • Atmosphere: Reflections in puddles, urban noir           │
│                                                             │
│ [ Generate Frame ]  [ Edit Details ]                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Voice-to-Scene Pipeline

1. **Transcribe**: Convert speech to text (already have this)
2. **Extract Elements**: Parse natural language for:
   - Setting/location
   - Characters and their states
   - Actions and poses
   - Mood and atmosphere
   - Props and objects
   - Camera angle suggestions
3. **Structure into 5Ws**: Map extracted elements
4. **Generate**: Create frame from structured description

### Mood Board Import

**Drag in reference images → Extract visual style**

```
┌─────────────────────────────────────────────────────────────┐
│ Mood Board                                                  │
│                                                             │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐        │
│ │ img1  │ │ img2  │ │ img3  │ │ img4  │ │  +    │        │
│ │       │ │       │ │       │ │       │ │ Add   │        │
│ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘        │
│                                                             │
│ Extracted Style:                                            │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Color Palette: [■][■][■][■][■]                         ││
│ │ Lighting: Soft, diffused, golden hour warmth           ││
│ │ Mood: Nostalgic, dreamy, intimate                      ││
│ │ Texture: Film grain, soft focus edges                  ││
│ │ Composition: Centered subjects, negative space         ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ [ Apply to Project ]  [ Apply to Scene ]                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Sources for Mood Boards

- Direct image upload
- URL paste (Pinterest, Tumblr, etc.)
- Screenshot paste
- Import from Figma/design tools
- Search and add from stock libraries

#### Style Extraction

Analyze uploaded images for:
- **Dominant colors**: Extract palette (5-7 colors)
- **Lighting**: Direction, quality, temperature
- **Texture**: Grain, sharpness, artifacts
- **Composition**: Rule of thirds, symmetry, framing
- **Subject matter**: What's typically shown
- **Era/medium**: Film, digital, illustration, photography

### Paragraph-to-Video

**Write a paragraph describing the whole video → AI generates everything**

```
┌─────────────────────────────────────────────────────────────┐
│ Describe Your Video                                         │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ The video follows a young artist through a single day   ││
│ │ in Tokyo. It starts at dawn in her small apartment,     ││
│ │ moves through crowded morning trains, into a quiet      ││
│ │ studio where she paints, then out into neon-lit         ││
│ │ streets at night. The mood shifts from contemplative    ││
│ │ to energetic to peaceful. Color palette moves from      ││
│ │ soft pastels at dawn through harsh fluorescents during  ││
│ │ the day to vibrant neons at night. Should feel like     ││
│ │ a Sofia Coppola film meets anime aesthetics.            ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ [ Generate Scene Breakdown ]                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Lip-Sync Mode

### Vision
For performance-style music videos where the artist appears to be singing. Match mouth movements to lyrics timing.

### The Challenge

Creating convincing lip-sync requires:
- Accurate phoneme timing from lyrics
- Mouth shapes that match sounds
- Natural head movement and expression
- Consistent character appearance
- Believable emotion matching lyrics

### Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ Lip-Sync Setup                                              │
│                                                             │
│ 1. Artist Reference                                         │
│    ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│    │ Neutral │ │ Singing │ │ Profile │  [+ Add More]      │
│    └─────────┘ └─────────┘ └─────────┘                    │
│                                                             │
│ 2. Performance Style                                        │
│    ○ Intimate (close-up, emotional)                        │
│    ● Energetic (movement, expressions)                     │
│    ○ Stylized (artistic interpretation)                    │
│                                                             │
│ 3. Camera Coverage                                          │
│    ☑ Close-up face                                         │
│    ☑ Medium shot                                           │
│    ☐ Wide shot                                             │
│    ☑ Profile angles                                        │
│                                                             │
│ [ Generate Performance ]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Phoneme Mapping

Map lyrics to mouth shapes:

| Phoneme Group | Sound | Mouth Shape |
|---------------|-------|-------------|
| Bilabial | B, M, P | Lips together |
| Labiodental | F, V | Teeth on lip |
| Open | A, AH | Wide open |
| Rounded | O, OO | Rounded lips |
| Closed | E, EE | Slight smile |
| Dental | TH | Tongue visible |

### Implementation Approach

1. **Phoneme Extraction**
   - Parse transcription for phoneme timing
   - Map words to phoneme sequences
   - Align with audio timestamps

2. **Keyframe Generation**
   - Generate frames at phoneme boundaries
   - Include mouth shape guidance in prompt
   - Maintain character consistency

3. **Interpolation**
   - Generate video between keyframes
   - Ensure smooth mouth transitions
   - Add natural micro-movements

4. **Emotion Layer**
   - Overlay emotional expression
   - Match intensity to lyrics sentiment
   - Natural blinks and head movement

### Mixed Mode: Performance + Narrative

Most music videos alternate between:
- Performance shots (artist lip-syncing)
- B-roll/narrative shots (story scenes)

Let users define which sections are which:

```
Timeline:
[Verse 1 - Performance] [Chorus - Narrative] [Verse 2 - Mix] [Chorus - Narrative]
```

---

## 6. Multi-Format Instant Cuts

### Vision
One project, multiple platform-ready outputs. Create once, export everywhere with intelligent reframing.

### Platform Specifications

| Platform | Aspect Ratio | Resolution | Max Duration | Notes |
|----------|--------------|------------|--------------|-------|
| YouTube | 16:9 | 1920x1080 / 3840x2160 | Unlimited | Thumbnail important |
| Instagram Reels | 9:16 | 1080x1920 | 90 seconds | First 3 sec crucial |
| TikTok | 9:16 | 1080x1920 | 3 minutes | Hook in first second |
| Instagram Feed | 1:1 / 4:5 | 1080x1080 / 1080x1350 | 60 seconds | Square or portrait |
| Twitter/X | 16:9 / 1:1 | 1280x720 | 2:20 | Autoplay muted |
| Facebook | 16:9 / 1:1 / 9:16 | 1080p | 240 minutes | Multiple formats |
| Snapchat | 9:16 | 1080x1920 | 60 seconds | Vertical only |
| LinkedIn | 16:9 / 1:1 | 1080p | 10 minutes | Professional context |

### Intelligent Reframing

When converting 16:9 to 9:16 (or vice versa), maintain focus on important elements:

```
Original 16:9:
┌─────────────────────────────────────────┐
│                                         │
│      [ Subject in center ]              │
│                                         │
└─────────────────────────────────────────┘

Auto-reframed 9:16:
         ┌─────────────┐
         │             │
         │  [Subject]  │
         │  (cropped   │
         │   sides)    │
         │             │
         └─────────────┘
```

#### Reframing Strategies

1. **Subject Detection**: AI identifies main subject(s)
2. **Dynamic Cropping**: Crop follows subject across frame
3. **Ken Burns Effect**: Subtle pan/zoom on static elements
4. **Safe Zones**: Keep important elements within safe areas

### Platform-Specific Cuts

Beyond just reframing, create platform-optimized edits:

**TikTok Version:**
- Hook in first second (most impactful visual)
- Faster cuts matching platform style
- Text overlays for silent viewing
- Trending sound sync points

**Instagram Reels:**
- 15-30 second highlight version
- Cover frame selection
- Caption-ready moments

**YouTube:**
- Full-length version
- Chapter markers
- End screen ready
- Thumbnail generation

### Auto-Generate Thumbnails

For each export, suggest thumbnails:

```
┌─────────────────────────────────────────────────────────────┐
│ Thumbnail Options                                           │
│                                                             │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│ │ Frame   │ │ Frame   │ │ Frame   │ │ Custom  │           │
│ │ @ 0:45  │ │ @ 1:23  │ │ @ 2:10  │ │ Generate│           │
│ │ (peak)  │ │ (face)  │ │ (action)│ │         │           │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                             │
│ Add text overlay:                                           │
│ [ Song Title Here                    ]                     │
│                                                             │
│ Style: ○ Clean  ● Bold  ○ Minimal                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Automatic Captions

Generate captions/subtitles:
- Burn-in for Instagram/TikTok (auto-play muted)
- SRT file for YouTube
- Styled text matching video aesthetic
- Multiple language options

---

## 7. Advanced Timeline

### Vision
Evolve from simple clip arrangement to full non-linear editing capabilities.

### Multi-Layer Video

```
┌─ Timeline ──────────────────────────────────────────────────┐
│ V3 (Overlay)    │ [text] [text]      [logo]                │
│ V2 (B-Roll)     │    [clip]    [clip]         [clip]       │
│ V1 (Primary)    │ [main clip] [main clip] [main clip]      │
├─────────────────────────────────────────────────────────────┤
│ A1 (Music)      │ ████████████████████████████████████     │
│ A2 (SFX)        │     ▪     ▪         ▪                    │
├─────────────────────────────────────────────────────────────┤
│ 0:00    0:30    1:00    1:30    2:00    2:30    3:00      │
└─────────────────────────────────────────────────────────────┘
```

#### Layer Types

| Layer | Purpose | Blend Modes |
|-------|---------|-------------|
| Primary (V1) | Main video content | Normal |
| B-Roll (V2) | Cutaway shots | Normal, dissolve |
| Overlay (V3+) | Text, graphics, logos | Screen, multiply, overlay |
| Effects | Color grading, filters | Adjustment layer |

### Transitions Track

Dedicated track for transition effects between clips:

```
Transitions:
[cut] [crossfade] [cut] [wipe] [cut] [zoom] [cut]
```

Available transitions:
- **Cut**: Instant switch (default)
- **Crossfade/Dissolve**: Gradual blend
- **Wipe**: Directional reveal (left, right, up, down, diagonal)
- **Zoom**: Push in/out transition
- **Flash/White**: Bright flash between clips
- **Glitch**: Digital distortion transition
- **Match Cut**: AI-assisted cut on similar shapes/movement

### Lyrics/Text Track

Dedicated track for text overlays:

```
┌─────────────────────────────────────────────────────────────┐
│ Text Track                                                  │
│                                                             │
│ Style: [ Kinetic Typography ▾ ]                            │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ "Every time I" │ "close my eyes" │ "I see your face"   ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Animation: ○ Fade  ● Bounce  ○ Typewriter  ○ Glitch       │
│ Position:  [ Bottom Center ▾ ]                             │
│ Font:      [ Montserrat Bold ▾ ]                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Text animation styles:
- **Fade**: Simple fade in/out
- **Bounce**: Rhythmic bounce on beat
- **Typewriter**: Character by character
- **Glitch**: Digital distortion
- **Scale**: Grow/shrink with emphasis
- **Karaoke**: Highlight word-by-word as sung

### Effects Track (Adjustment Layer)

Apply effects across multiple clips:

```
Effects Layer:
┌────────────────────────────────────────────────────────────┐
│ [Color Grade: Teal/Orange] [Vignette] [Film Grain: 20%]   │
└────────────────────────────────────────────────────────────┘
```

Available effects:
- **Color Grading**: LUT-style color transforms
- **Film Grain**: Add texture
- **Vignette**: Darken edges
- **Blur**: Gaussian, motion, or radial
- **Sharpen**: Enhance detail
- **Speed Ramp**: Variable speed adjustment
- **Stabilization**: Reduce shake

### Markers & Sections

Add markers for organization:

```
Markers:
▼ Verse 1    ▼ Chorus    ▼ Verse 2    ▼ Bridge    ▼ Outro
│            │           │            │           │
└────────────┴───────────┴────────────┴───────────┘
```

Marker types:
- **Section**: Song structure (verse, chorus, etc.)
- **Todo**: Things to fix or regenerate
- **Approved**: Sections that are final
- **Note**: Comments for collaboration

---

## 8. Iteration & Variation

### Vision
Creative exploration through rapid iteration. Make it easy to try variations, blend ideas, and refine outputs.

### "More Like This" Variations

Generate multiple options from any frame:

```
┌─────────────────────────────────────────────────────────────┐
│ Frame Variations                                            │
│                                                             │
│ Original:                                                   │
│ ┌──────────────────────────────────────────┐               │
│ │                                          │               │
│ │        [Selected frame image]            │               │
│ │                                          │               │
│ └──────────────────────────────────────────┘               │
│                                                             │
│ [ Generate 4 Variations ]                                   │
│                                                             │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│ │ Var 1   │ │ Var 2   │ │ Var 3   │ │ Var 4   │           │
│ │ (subtle │ │ (color  │ │ (compo- │ │ (mood   │           │
│ │  change)│ │  shift) │ │  sition)│ │  change)│           │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│  [ Use ]    [ Use ]     [ Use ]     [ Use ]               │
│                                                             │
│ Variation strength: ○ Subtle  ● Moderate  ○ Significant   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Variation Modes

| Mode | Description |
|------|-------------|
| Subtle | Minor changes (lighting, micro-expressions) |
| Color | Same composition, different color treatment |
| Angle | Same scene, different camera position |
| Mood | Same subject, different emotional tone |
| Radical | Same prompt, very different interpretation |

### Frame Interpolation

Blend between two frames:

```
Frame A                 Interpolations                Frame B
┌───────┐    ┌───────┐ ┌───────┐ ┌───────┐    ┌───────┐
│       │    │       │ │       │ │       │    │       │
│   A   │ →  │  25%  │ │  50%  │ │  75%  │ →  │   B   │
│       │    │       │ │       │ │       │    │       │
└───────┘    └───────┘ └───────┘ └───────┘    └───────┘
```

Use cases:
- Find the ideal moment between two concepts
- Create smooth transitions
- Explore the "space" between two ideas

### Outpainting / Extension

Extend frame edges for different aspect ratios:

```
Original (16:9):
        ┌─────────────────────────────┐
        │                             │
        │      [Original Frame]       │
        │                             │
        └─────────────────────────────┘

Outpainted (9:16):
              ┌───────────────┐
              │ [AI Extended] │
              │               │
              ├───────────────┤
              │               │
              │   [Original]  │
              │               │
              ├───────────────┤
              │               │
              │ [AI Extended] │
              └───────────────┘
```

### Region Editing (Inpainting)

Modify specific areas while keeping the rest:

```
┌─────────────────────────────────────────────────────────────┐
│ Region Edit                                                 │
│                                                             │
│ ┌─────────────────────────────────────────┐                │
│ │                                         │                │
│ │              ┌───────────┐              │                │
│ │              │  Masked   │              │                │
│ │              │  Region   │              │                │
│ │              └───────────┘              │                │
│ │                                         │                │
│ └─────────────────────────────────────────┘                │
│                                                             │
│ Replace with: [ "A red balloon floating"          ]        │
│                                                             │
│ [ Regenerate Region ]                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Use cases:
- Replace objects in frame
- Fix unwanted elements
- Add new elements to existing scene
- Correct AI generation errors

### Style Slider

Smoothly blend between two styles:

```
Style A: "Cyberpunk neon"          Style B: "Soft watercolor"
          │                                    │
          ├────────────●───────────────────────┤
          0%          30%                    100%

          [Preview at current blend]
```

### History & Branching

Track all variations and enable branching:

```
Generation History:
                    ┌─ Variation A (selected)
                    │
Original ──► v1 ───┼─ Variation B
                    │
                    └─ Variation C ──► v2 ──► v3 (current)
```

- Full history of all generations
- Branch from any point
- Compare versions side-by-side
- Restore any previous version

---

## 9. Real-Time Preview Mode

### Vision
See an approximation of your video as you build it, without waiting for full generation. Rapid feedback loop for creative decisions.

### Preview Quality Levels

| Level | Speed | Quality | Use Case |
|-------|-------|---------|----------|
| Wireframe | Instant | Blocked shapes + text | Layout planning |
| Rough | 1-2s | Low-res AI frames | Quick concept check |
| Draft | 10-30s | Medium-res generation | Review edit |
| Final | 2-10min | Full quality | Export |

### Wireframe Preview

Instant preview using placeholder shapes:

```
┌─────────────────────────────────────────────────────────────┐
│ Preview: Wireframe Mode                                     │
│                                                             │
│ ┌─────────────────────────────────────────┐                │
│ │                                         │                │
│ │      ┌─────────┐                        │                │
│ │      │ Subject │     "Scene 1: Rooftop" │                │
│ │      │  Here   │     "Night, neon"      │                │
│ │      └─────────┘                        │                │
│ │                                         │                │
│ │  ▓▓▓▓▓▓░░░░  (waveform)                │                │
│ │                                         │                │
│ └─────────────────────────────────────────┘                │
│                                                             │
│ ▶ Playing: 0:15 / 3:24                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Morph Preview

For clips without generated video, morph between start/end frames:

```
Start Frame ───[morphing animation]───► End Frame
```

Simple interpolation that gives sense of motion without full video generation.

### Progressive Enhancement

As you work, system generates in background:

1. **Immediate**: Wireframe/placeholder
2. **Background (30s)**: Generate rough thumbnails
3. **Background (ongoing)**: Generate draft-quality frames
4. **On-demand**: Full quality when requested

### Audio-Synced Playback

Preview always syncs to actual audio:

```
┌─────────────────────────────────────────────────────────────┐
│ Preview Controls                                            │
│                                                             │
│ [◀◀] [▶/❚❚] [▶▶]   0:45 / 3:24   🔊 ████████░░           │
│                                                             │
│ Preview Quality: [ Draft ▾ ]                               │
│                                                             │
│ ☑ Sync to audio                                            │
│ ☑ Show safe zones                                          │
│ ☐ Show frame numbers                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Split View

Compare draft vs. final:

```
┌──────────────────────┬──────────────────────┐
│      Draft           │       Final          │
│  (fast generation)   │   (full quality)     │
│                      │                      │
│ [Draft preview]      │ [Final render]       │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

---

## 10. Style Learning

### Vision
Learn visual styles from reference videos, images, or previous projects. "Make it look like X."

### Reference Video Analysis

Paste a YouTube/Vimeo URL, extract visual style:

```
┌─────────────────────────────────────────────────────────────┐
│ Learn from Reference                                        │
│                                                             │
│ URL: [ https://youtube.com/watch?v=...          ] [Analyze]│
│                                                             │
│ Analyzing: "Childish Gambino - This Is America"            │
│ ████████████░░░░░░░░ 60%                                   │
│                                                             │
│ Extracted Style:                                            │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Color: Muted, desaturated, high contrast                ││
│ │ Lighting: Harsh overhead, dramatic shadows              ││
│ │ Camera: Long takes, wide shots, deliberate movement     ││
│ │ Editing: Minimal cuts, continuous flow                  ││
│ │ Mood: Unsettling, surreal, commentary                   ││
│ │ Special: Single-take aesthetic, warehouse setting       ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ [ Apply to Project ]                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Analysis Components

1. **Frame Sampling**: Extract frames throughout video
2. **Color Analysis**: Dominant palette, grading style
3. **Composition**: Shot types, framing patterns
4. **Motion**: Camera movement, cut frequency
5. **Content**: Subject matter, settings, characters
6. **Mood**: Overall emotional tone

### Era Presets

Pre-built styles from different periods:

| Era | Characteristics |
|-----|-----------------|
| **80s MTV** | Neon colors, smoke, geometric shapes, VHS artifacts |
| **90s Grunge** | Desaturated, grainy, DIY aesthetic, natural lighting |
| **2000s Flash** | High saturation, quick cuts, digital effects |
| **2010s Clean** | Polished, 4K clarity, careful color grading |
| **Modern Cinematic** | 2.35:1, shallow DOF, teal/orange, anamorphic |
| **Y2K Revival** | Chrome, bubble fonts, early CGI aesthetic |
| **VHS Nostalgic** | Tracking lines, soft focus, warm tones |
| **Film Noir** | Black and white, high contrast, shadows |
| **Anime/Cel** | Flat colors, bold outlines, expressive |
| **Vaporwave** | Pink/purple, Greek statues, 90s tech |

### Project Style Memory

Learn from your own previous projects:

```
┌─────────────────────────────────────────────────────────────┐
│ Your Styles                                                 │
│                                                             │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│ │ Project │ │ Project │ │ Project │ │ Create  │           │
│ │ "Neon   │ │ "Summer │ │ "Moody  │ │ New     │           │
│ │  Nights"│ │  Vibes" │ │  Blues" │ │ Style   │           │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                             │
│ Apply "Neon Nights" style to current project?              │
│ [ Preview ] [ Apply ]                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Style Transfer

Take the style of one generated frame, apply to others:

```
Source Frame (style)    +    Target Frame (content)    =    Result
┌─────────────────┐         ┌─────────────────┐           ┌─────────────────┐
│ [Neon aesthetic]│    +    │ [Different      │     =     │ [Scene with     │
│                 │         │  scene]         │           │  neon style]    │
└─────────────────┘         └─────────────────┘           └─────────────────┘
```

---

## 11. Interactive / Branching Videos

### Vision
Go beyond linear videos. Create interactive experiences where viewers make choices.

### Branching Narratives

Define choice points in the video:

```
┌─────────────────────────────────────────────────────────────┐
│ Branch Editor                                               │
│                                                             │
│ Story Flow:                                                 │
│                                                             │
│ [Intro] ──► [Verse 1] ──► ◆ Choice Point                   │
│                            │                                │
│                   ┌────────┼────────┐                      │
│                   │        │        │                      │
│                   ▼        ▼        ▼                      │
│              [Path A] [Path B] [Path C]                    │
│              "Dance"  "Drama"  "Dream"                     │
│                   │        │        │                      │
│                   └────────┼────────┘                      │
│                            │                                │
│                            ▼                                │
│                       [Shared Outro]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Platform Support

| Platform | Interactive Support |
|----------|---------------------|
| YouTube | Cards, end screens, links to other videos |
| Custom Web | Full interactivity via HTML5 video |
| TikTok | Limited (link in bio) |
| Instagram | Stories (tap for choice), Reels (limited) |

### Use Cases

1. **Multiple Endings**: Viewer chooses how story ends
2. **Director's Cut vs. Radio Edit**: Different versions from same project
3. **Perspective Switch**: Same story from different character views
4. **Genre Mashup**: Same song with different visual genres
5. **Unlockable Content**: Easter eggs for engaged viewers

### Chapter System

For YouTube, define chapters with distinct visual treatments:

```
Chapters:
├─ 0:00 Intro (dreamy, soft)
├─ 0:30 Verse 1 (intimate, close-ups)
├─ 1:15 Chorus (energetic, wide shots)
├─ 1:45 Verse 2 (narrative, new location)
├─ 2:30 Bridge (abstract, experimental)
└─ 3:00 Outro (return to intro style)
```

---

## 12. Collaborative & Social

### Vision
Music videos are often collaborative. Enable real-time collaboration, sharing, and community features.

### Real-Time Collaboration

Multiple users editing same project:

```
┌─────────────────────────────────────────────────────────────┐
│ Project: "Summer Song" 🔴 Live                              │
│                                                             │
│ Collaborators:                                              │
│ 👤 You (editing Scene 2)                                   │
│ 👤 Alex (viewing timeline)                                 │
│ 👤 Jordan (generating frame...)                            │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Timeline                               [Alex's cursor]  ││
│ │ ───────────────────────────────────────────────────────││
│ │ [clip][clip][clip]  │  [clip][clip]    │    [clip]     ││
│ │           ▲         │                  │                ││
│ │      [You editing]  │                  │                ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Chat:                                                       │
│ Alex: "Should the chorus be more energetic?"               │
│ You: "Yeah, let me try a different frame"                  │
│ [ Type a message...                               ] [Send] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Requirements

- **Backend**: Persistent storage (database)
- **Real-time**: WebSocket connections
- **Auth**: User accounts, permissions
- **Sync**: Conflict resolution for simultaneous edits
- **Presence**: Show who's viewing/editing what

### Permission Levels

| Role | Capabilities |
|------|--------------|
| Owner | Full access, manage collaborators, delete project |
| Editor | Edit content, generate assets, export |
| Commenter | View, add comments, suggest changes |
| Viewer | View only |

### Comment System

Add feedback directly on timeline or frames:

```
┌─────────────────────────────────────────────────────────────┐
│ Frame Comment                                               │
│                                                             │
│ ┌─────────────────────────────────────────┐                │
│ │                              💬 2       │                │
│ │        [Frame with comments]            │                │
│ │                                         │                │
│ │         [marker] ←── "Love this color   │                │
│ │                       but can we make   │                │
│ │                       her smile?"       │                │
│ └─────────────────────────────────────────┘                │
│                                                             │
│ Comments:                                                   │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 👤 Client: "Love this but smile?"              [Resolve]││
│ │ └─ 👤 You: "Will regenerate, done by EOD"              ││
│ │ 👤 Director: "Approved with above change"      [Resolve]││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Public Sharing & Remixing

Share projects with the community:

```
┌─────────────────────────────────────────────────────────────┐
│ Share Settings                                              │
│                                                             │
│ Visibility:                                                 │
│ ○ Private (only collaborators)                             │
│ ● Unlisted (anyone with link)                              │
│ ○ Public (discoverable, can be remixed)                    │
│                                                             │
│ Allow remixing:                                             │
│ ☑ Others can copy and modify this project                  │
│ ☑ Require attribution                                      │
│                                                             │
│ Share link:                                                 │
│ [ https://radiostar.studio/p/abc123     ] [Copy]           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Template Marketplace

Share and discover project templates:

```
┌─────────────────────────────────────────────────────────────┐
│ Template Marketplace                                        │
│                                                             │
│ Categories: [All] [Performance] [Narrative] [Abstract] ... │
│                                                             │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │
│ │ "Neon     │ │ "Soft     │ │ "Retro    │ │ "Dark     │   │
│ │  City     │ │  Indie    │ │  VHS      │ │  Cinematic│   │
│ │  Nights"  │ │  Vibes"   │ │  Dreams"  │ │  Drama"   │   │
│ │           │ │           │ │           │ │           │   │
│ │ ⭐ 4.8    │ │ ⭐ 4.6    │ │ ⭐ 4.9    │ │ ⭐ 4.7    │   │
│ │ Free      │ │ $5        │ │ Free      │ │ $10       │   │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Hire Mode

Connect artists with video creators:

```
┌─────────────────────────────────────────────────────────────┐
│ Creator Marketplace                                         │
│                                                             │
│ "Need a music video? Find a creator."                      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 👤 Maya Studios                                         ││
│ │ ⭐ 4.9 (127 reviews)                                    ││
│ │                                                         ││
│ │ Specialties: Cinematic, Narrative, Performance          ││
│ │ Turnaround: 3-5 days                                    ││
│ │ Starting at: $200                                       ││
│ │                                                         ││
│ │ [View Portfolio]  [Request Quote]                       ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Prioritization Framework

When considering which ideas to pursue, evaluate against:

| Criteria | Weight | Description |
|----------|--------|-------------|
| User Impact | 30% | How much does this improve the core experience? |
| Differentiation | 25% | Does this make Radiostar unique? |
| Technical Feasibility | 20% | Can we build this with current tech? |
| Revenue Potential | 15% | Does this enable monetization? |
| Development Effort | 10% | How long to build? |

### Suggested Priority Tiers

**Tier 1 - Core Differentiators**
1. AI Director Mode
2. Beat Detection & Auto-Cut
3. Character Persistence

**Tier 2 - Power Features**
4. Multi-Format Export
5. Style Learning
6. Advanced Timeline

**Tier 3 - Growth Features**
7. Collaborative Editing
8. Template Marketplace
9. Real-Time Preview

**Tier 4 - Experimental**
10. Interactive/Branching
11. Lip-Sync Mode
12. Voice/Sketch Input

---

## Document History

- **Created**: 2026-01-31
- **Purpose**: Capture future feature ideas for Radiostar
- **Status**: Living document for inspiration, not active roadmap

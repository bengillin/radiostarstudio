
export interface LyricLine {
  original: string;
  parody: string;
  syllableDiff: number; // 0 means perfect match
  rhymeScheme: string; // e.g., "A", "B"
  isSectionHeader: boolean; // True if this is a marker like [Chorus]
}

export interface AssetVariant {
  id: string;
  imageUrl: string;
  prompt: string;
}

export interface VisualAsset {
  id: string;
  name: string; // e.g. "Protagonist", "The Alien"
  type: 'character' | 'location' | 'object';
  description: string; // Physical description
  variants: AssetVariant[]; // Array of generated images for this asset
  isGenerated: boolean; // True if AI made it, false if user uploaded
}

export interface StoryboardClip {
  id: string;
  lineIndex: number; // correlates to ParodySong.lines index
  lyric: string;
  imagePrompt: string;
  imageUrl?: string;
  videoUrl?: string; // Base64 data URI of the generated video
  isLoading?: boolean; // General loading (usually image)
  isVideoLoading?: boolean; // Specific loading state for video generation
  activeAssetIds?: string[]; // IDs of assets that appear in this specific clip
}

export interface StoryboardScene {
  id: string;
  startLineIndex: number;
  endLineIndex: number;
  description: string; // Narrative description of the scene
  sceneStyle?: string; // Optional override for just this scene
  clips: StoryboardClip[];
}

export interface ParodySong {
  id: string; // UUID for storage
  groupId: string; // ID linking multiple versions of the same concept
  createdAt: number;
  originalTitle: string;
  originalArtist: string;
  parodyTitle: string;
  lines: LyricLine[];
  summary: string;
  tags?: string[]; // e.g. ["Upbeat", "90s Pop", "Satire"] for Suno prompting
  globalVisualStyle?: string; // e.g. "Cyberpunk Anime, dark neon colors"
  storyboard?: StoryboardScene[];
  assets?: VisualAsset[];
}

export interface ParodyRequest {
  lyrics?: string; // Optional - can be fetched via search
  originalArtist: string;
  originalTitle: string;
  topic: string; // Used for Parody Mode, ignored for Phonetic Mode
  mood: 'funny' | 'satirical' | 'serious' | 'absurdist';
  mode: 'parody' | 'phonetic';
  groupId?: string; // If present, creates a new version in this group
}

export enum AppState {
  INPUT,
  GENERATING,
  RESULT,
  ERROR
}

declare global {
  // Augment the existing AIStudio interface to include the required methods.
  // We avoid redeclaring 'aistudio' on Window to prevent type conflicts.
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
import type { PlatformPreset } from '@/types'

export const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    fps: 30,
    bitrate: '8M',
  },
  {
    id: 'youtube-4k',
    name: 'YouTube 4K',
    width: 3840,
    height: 2160,
    aspectRatio: '16:9',
    fps: 30,
    bitrate: '35M',
  },
  {
    id: 'instagram-reels',
    name: 'Instagram Reels',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDuration: 90,
    fps: 30,
    bitrate: '5M',
  },
  {
    id: 'instagram-feed',
    name: 'Instagram Feed',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    maxDuration: 60,
    fps: 30,
    bitrate: '5M',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDuration: 180,
    fps: 30,
    bitrate: '5M',
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    maxDuration: 140,
    fps: 30,
    bitrate: '4M',
  },
  {
    id: 'custom-1080p',
    name: 'Custom 1080p',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    fps: 30,
    bitrate: '8M',
  },
  {
    id: 'custom-720p',
    name: 'Custom 720p',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    fps: 30,
    bitrate: '5M',
  },
]

export function getPresetById(id: string): PlatformPreset | undefined {
  return PLATFORM_PRESETS.find(p => p.id === id)
}

export function getPresetsForAspectRatio(aspectRatio: '16:9' | '9:16' | '1:1' | '4:5'): PlatformPreset[] {
  return PLATFORM_PRESETS.filter(p => p.aspectRatio === aspectRatio)
}

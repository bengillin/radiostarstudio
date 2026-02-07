'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Download, Loader2, AlertCircle, CheckCircle, LayoutGrid } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { PLATFORM_PRESETS, getPresetById } from '@/lib/export-presets'
import { exportVideo, exportSingleClip, exportStoryboardImage, downloadBlob, type ExportClip } from '@/lib/ffmpeg-export'
import { formatTime } from '@/lib/utils'
import type { ExportGranularity, ExportAudioOption, PlatformPreset, Clip, GeneratedVideo } from '@/types'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const { clips, scenes, videos, frames, audioFile, timeline } = useProjectStore()

  // Export settings
  const [granularity, setGranularity] = useState<ExportGranularity>('timeline')
  const [audioOption, setAudioOption] = useState<ExportAudioOption>('with-audio')
  const [presetId, setPresetId] = useState('youtube')
  const [crossfade, setCrossfade] = useState<'none' | '0.25' | '0.5' | '1.0'>('none')

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStep, setExportStep] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState(false)

  // Get selected items based on granularity
  const selectedClipIds = timeline?.selectedClipIds ?? []
  const selectedClip = selectedClipIds.length === 1
    ? clips.find(c => c.id === selectedClipIds[0])
    : null

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isExporting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isExporting, onClose])

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setExportProgress(0)
      setExportStep('')
      setExportError(null)
      setExportSuccess(false)
      // Auto-select granularity based on selection
      if (selectedClipIds.length === 1) {
        setGranularity('clip')
      } else {
        setGranularity('timeline')
      }
    }
  }, [isOpen, selectedClipIds.length])

  // Get clips with videos
  const clipsWithVideos = clips.filter(clip => {
    const video = clip.video || Object.values(videos).find(
      (v: GeneratedVideo) => v.clipId === clip.id && v.status === 'complete'
    )
    return video && video.url
  })

  // Calculate total duration
  const getTotalDuration = useCallback(() => {
    if (granularity === 'clip' && selectedClip) {
      return selectedClip.endTime - selectedClip.startTime
    }
    return clipsWithVideos.reduce((sum, clip) => sum + (clip.endTime - clip.startTime), 0)
  }, [granularity, selectedClip, clipsWithVideos])

  // Get preset
  const preset = getPresetById(presetId) || PLATFORM_PRESETS[0]

  // Check duration limit
  const duration = getTotalDuration()
  const exceedsDuration = preset.maxDuration && duration > preset.maxDuration

  // Handle export
  const handleExport = async () => {
    setIsExporting(true)
    setExportProgress(0)
    setExportStep('Starting...')
    setExportError(null)
    setExportSuccess(false)

    try {
      const includeAudio = audioOption === 'with-audio'
      const audioUrl = includeAudio && audioFile?.url ? audioFile.url : undefined

      const onProgress = (percent: number, step: string) => {
        setExportProgress(percent)
        setExportStep(step)
      }

      let blob: Blob

      if (granularity === 'clip' && selectedClip) {
        // Export single clip
        const video = selectedClip.video || Object.values(videos).find(
          (v: GeneratedVideo) => v.clipId === selectedClip.id && v.status === 'complete'
        )
        if (!video?.url) {
          throw new Error('Selected clip has no video')
        }

        blob = await exportSingleClip(
          video.url,
          audioUrl,
          selectedClip.startTime,
          selectedClip.endTime,
          preset,
          includeAudio,
          onProgress
        )
      } else {
        // Export timeline (all clips with videos)
        const exportClips: ExportClip[] = clipsWithVideos.map(clip => {
          const video = clip.video || Object.values(videos).find(
            (v: GeneratedVideo) => v.clipId === clip.id && v.status === 'complete'
          )
          return {
            id: clip.id,
            videoUrl: video!.url,
            startTime: clip.startTime,
            endTime: clip.endTime,
            duration: clip.endTime - clip.startTime,
          }
        }).sort((a, b) => a.startTime - b.startTime)

        blob = await exportVideo({
          clips: exportClips,
          audioUrl,
          preset,
          includeAudio,
          crossfadeDuration: crossfade !== 'none' ? parseFloat(crossfade) : undefined,
          onProgress,
        })
      }

      // Download the file
      const filename = `radiostar-export-${preset.id}-${Date.now()}.mp4`
      downloadBlob(blob, filename)

      setExportSuccess(true)
      setExportStep('Downloaded!')
    } catch (err) {
      console.error('Export failed:', err)
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  const canExport = granularity === 'clip'
    ? selectedClip && clipsWithVideos.some(c => c.id === selectedClip.id)
    : clipsWithVideos.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isExporting ? onClose : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-neutral-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Export Video</h2>
          {!isExporting && (
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white/60" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Granularity */}
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">
              What to Export
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setGranularity('clip')}
                disabled={!selectedClip || isExporting}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  granularity === 'clip'
                    ? 'bg-brand-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Selected Clip
              </button>
              <button
                onClick={() => setGranularity('timeline')}
                disabled={isExporting}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  granularity === 'timeline'
                    ? 'bg-brand-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                Full Timeline
              </button>
            </div>
            {granularity === 'clip' && selectedClip && (
              <p className="text-xs text-white/40 mt-2">
                Exporting: {selectedClip.title} ({formatTime(selectedClip.startTime)} - {formatTime(selectedClip.endTime)})
              </p>
            )}
            {granularity === 'timeline' && (
              <p className="text-xs text-white/40 mt-2">
                {clipsWithVideos.length} clips with videos
              </p>
            )}
          </div>

          {/* Audio option */}
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">
              Audio
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setAudioOption('with-audio')}
                disabled={!audioFile || isExporting}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  audioOption === 'with-audio'
                    ? 'bg-brand-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                With Audio
              </button>
              <button
                onClick={() => setAudioOption('video-only')}
                disabled={isExporting}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  audioOption === 'video-only'
                    ? 'bg-brand-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                Video Only
              </button>
            </div>
          </div>

          {/* Platform preset */}
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">
              Platform
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORM_PRESETS.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPresetId(p.id)}
                  disabled={isExporting}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors text-left ${
                    presetId === p.id
                      ? 'bg-brand-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  <div>{p.name}</div>
                  <div className="text-xs opacity-60">{p.width}x{p.height}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Crossfade (timeline export only) */}
          {granularity === 'timeline' && clipsWithVideos.length >= 2 && (
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">
                Crossfade
              </label>
              <div className="flex gap-2">
                {(['none', '0.25', '0.5', '1.0'] as const).map((val) => (
                  <button
                    key={val}
                    onClick={() => setCrossfade(val)}
                    disabled={isExporting}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                      crossfade === val
                        ? 'bg-brand-500 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {val === 'none' ? 'None' : `${val}s`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Duration info */}
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Duration</span>
              <span className={exceedsDuration ? 'text-red-400' : 'text-white'}>
                {formatTime(duration)}
                {preset.maxDuration && (
                  <span className="text-white/40 ml-1">/ {formatTime(preset.maxDuration)} max</span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-white/60">Resolution</span>
              <span className="text-white">{preset.width}x{preset.height}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-white/60">Format</span>
              <span className="text-white">MP4 @ {preset.fps}fps</span>
            </div>
          </div>

          {/* Warning for duration */}
          {exceedsDuration && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">
                Video exceeds {preset.name}'s maximum duration of {formatTime(preset.maxDuration!)}.
                It may be rejected by the platform.
              </p>
            </div>
          )}

          {/* Progress */}
          {isExporting && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/60">{exportStep}</span>
                <span className="text-white">{exportProgress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {exportError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{exportError}</p>
            </div>
          )}

          {/* Success */}
          {exportSuccess && (
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-green-400">Export complete! Check your downloads folder.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-4 border-t border-white/10">
          {/* Storyboard export */}
          {!isExporting && clipsWithVideos.length > 0 && (
            <button
              onClick={async () => {
                setIsExporting(true)
                setExportStep('Generating storyboard...')
                try {
                  const frameData = clips
                    .sort((a: Clip, b: Clip) => a.startTime - b.startTime)
                    .map((clip: Clip) => {
                      const startFrame = clip.startFrame || frames[`frame-${clip.id}-start`]
                      return {
                        url: startFrame?.url || '',
                        title: clip.title,
                      }
                    })
                    .filter((f: { url: string }) => f.url)

                  const blob = await exportStoryboardImage(frameData)
                  downloadBlob(blob, `radiostar-storyboard-${Date.now()}.jpg`)
                  setExportSuccess(true)
                  setExportStep('Storyboard downloaded!')
                } catch (err) {
                  setExportError(err instanceof Error ? err.message : 'Storyboard export failed')
                } finally {
                  setIsExporting(false)
                }
              }}
              className="px-3 py-2 text-sm font-medium text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2 mr-auto"
              title="Export storyboard as JPEG grid"
            >
              <LayoutGrid className="w-4 h-4" />
              Storyboard
            </button>
          )}
          {!isExporting && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={!canExport || isExporting}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { PlatformPreset, EnhancedExportSettings } from '@/types'
import { getPresetById } from './export-presets'

let ffmpeg: FFmpeg | null = null
let ffmpegLoaded = false

export type ExportProgressCallback = (percent: number, step: string) => void

async function loadFFmpeg(onProgress?: ExportProgressCallback): Promise<FFmpeg> {
  if (ffmpeg && ffmpegLoaded) {
    return ffmpeg
  }

  onProgress?.(5, 'Loading FFmpeg...')

  ffmpeg = new FFmpeg()

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message)
  })

  ffmpeg.on('progress', ({ progress }) => {
    // progress is 0-1
    const percent = Math.round(progress * 100)
    onProgress?.(Math.min(90, 20 + percent * 0.7), 'Encoding...')
  })

  // Load FFmpeg core from CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  ffmpegLoaded = true
  onProgress?.(15, 'FFmpeg loaded')

  return ffmpeg
}

async function dataUrlToUint8Array(dataUrl: string): Promise<Uint8Array> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const arrayBuffer = await blob.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

export interface ExportClip {
  id: string
  videoUrl: string  // base64 data URL
  startTime: number
  endTime: number
  duration: number
}

export interface ExportOptions {
  clips: ExportClip[]
  audioUrl?: string  // base64 data URL for audio
  preset: PlatformPreset
  includeAudio: boolean
  onProgress?: ExportProgressCallback
}

export async function exportVideo(options: ExportOptions): Promise<Blob> {
  const { clips, audioUrl, preset, includeAudio, onProgress } = options

  if (clips.length === 0) {
    throw new Error('No clips to export')
  }

  const ff = await loadFFmpeg(onProgress)

  onProgress?.(20, 'Preparing clips...')

  // Write video clips to virtual filesystem
  const videoFiles: string[] = []
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    const filename = `clip_${i}.mp4`
    onProgress?.(20 + (i / clips.length) * 20, `Loading clip ${i + 1}/${clips.length}...`)

    try {
      const videoData = await dataUrlToUint8Array(clip.videoUrl)
      await ff.writeFile(filename, videoData)
      videoFiles.push(filename)
    } catch (err) {
      console.error(`Failed to load clip ${i}:`, err)
      throw new Error(`Failed to load clip: ${clip.id}`)
    }
  }

  onProgress?.(40, 'Processing clips...')

  // Create concat file for FFmpeg
  const concatContent = videoFiles.map(f => `file '${f}'`).join('\n')
  await ff.writeFile('concat.txt', concatContent)

  // Write audio if needed
  if (includeAudio && audioUrl) {
    onProgress?.(45, 'Loading audio...')
    try {
      const audioData = await dataUrlToUint8Array(audioUrl)
      await ff.writeFile('audio.mp3', audioData)
    } catch (err) {
      console.error('Failed to load audio:', err)
      // Continue without audio rather than failing
    }
  }

  onProgress?.(50, 'Encoding video...')

  // Build FFmpeg command
  const outputFile = 'output.mp4'
  const { width, height, fps, bitrate } = preset

  try {
    if (includeAudio && audioUrl) {
      // Concatenate videos and add audio
      await ff.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-i', 'audio.mp3',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-b:v', bitrate,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        '-r', String(fps),
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-y',
        outputFile
      ])
    } else {
      // Concatenate videos only
      await ff.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-b:v', bitrate,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        '-r', String(fps),
        '-an',
        '-y',
        outputFile
      ])
    }
  } catch (err) {
    console.error('FFmpeg encoding failed:', err)
    throw new Error('Video encoding failed')
  }

  onProgress?.(95, 'Finalizing...')

  // Read output file
  const outputData = await ff.readFile(outputFile)

  // Clean up
  for (const file of videoFiles) {
    try {
      await ff.deleteFile(file)
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  try {
    await ff.deleteFile('concat.txt')
    await ff.deleteFile(outputFile)
    if (includeAudio && audioUrl) {
      await ff.deleteFile('audio.mp3')
    }
  } catch (e) {
    // Ignore cleanup errors
  }

  onProgress?.(100, 'Complete!')

  // Return as Blob
  return new Blob([outputData], { type: 'video/mp4' })
}

export async function exportSingleClip(
  clipVideoUrl: string,
  audioUrl: string | undefined,
  startTime: number,
  endTime: number,
  preset: PlatformPreset,
  includeAudio: boolean,
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  const ff = await loadFFmpeg(onProgress)

  onProgress?.(20, 'Loading clip...')

  const videoData = await dataUrlToUint8Array(clipVideoUrl)
  await ff.writeFile('input.mp4', videoData)

  if (includeAudio && audioUrl) {
    onProgress?.(30, 'Loading audio...')
    const audioData = await dataUrlToUint8Array(audioUrl)
    await ff.writeFile('audio.mp3', audioData)
  }

  onProgress?.(40, 'Encoding...')

  const { width, height, fps, bitrate } = preset
  const outputFile = 'output.mp4'
  const duration = endTime - startTime

  try {
    if (includeAudio && audioUrl) {
      // Video with audio segment
      await ff.exec([
        '-i', 'input.mp4',
        '-i', 'audio.mp3',
        '-ss', String(startTime),
        '-t', String(duration),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-b:v', bitrate,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        '-r', String(fps),
        '-c:a', 'aac',
        '-b:a', '192k',
        '-y',
        outputFile
      ])
    } else {
      // Video only
      await ff.exec([
        '-i', 'input.mp4',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-b:v', bitrate,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        '-r', String(fps),
        '-an',
        '-y',
        outputFile
      ])
    }
  } catch (err) {
    console.error('FFmpeg encoding failed:', err)
    throw new Error('Video encoding failed')
  }

  onProgress?.(95, 'Finalizing...')

  const outputData = await ff.readFile(outputFile)

  // Cleanup
  try {
    await ff.deleteFile('input.mp4')
    await ff.deleteFile(outputFile)
    if (includeAudio && audioUrl) {
      await ff.deleteFile('audio.mp3')
    }
  } catch (e) {
    // Ignore
  }

  onProgress?.(100, 'Complete!')

  return new Blob([outputData], { type: 'video/mp4' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

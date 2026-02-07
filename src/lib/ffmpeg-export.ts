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
  crossfadeDuration?: number  // seconds (0.25, 0.5, 1.0) — 0 or undefined = no crossfade
  onProgress?: ExportProgressCallback
}

export async function exportVideo(options: ExportOptions): Promise<Blob> {
  const { clips, audioUrl, preset, includeAudio, crossfadeDuration, onProgress } = options

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

  // Write audio if needed
  if (includeAudio && audioUrl) {
    onProgress?.(45, 'Loading audio...')
    try {
      const audioData = await dataUrlToUint8Array(audioUrl)
      await ff.writeFile('audio.mp3', audioData)
    } catch (err) {
      console.error('Failed to load audio:', err)
    }
  }

  onProgress?.(50, 'Encoding video...')

  const outputFile = 'output.mp4'
  const { width, height, fps, bitrate } = preset
  const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`

  const useCrossfade = crossfadeDuration && crossfadeDuration > 0 && clips.length >= 2

  try {
    if (useCrossfade) {
      // Try xfade filter chain for crossfade transitions
      try {
        await exportWithCrossfade(ff, videoFiles, clips, crossfadeDuration, scaleFilter, fps, bitrate, includeAudio && !!audioUrl, outputFile)
      } catch (xfadeErr) {
        console.warn('xfade failed, falling back to concat:', xfadeErr)
        // Fallback to simple concat
        await exportWithConcat(ff, videoFiles, scaleFilter, fps, bitrate, includeAudio && !!audioUrl, outputFile)
      }
    } else {
      await exportWithConcat(ff, videoFiles, scaleFilter, fps, bitrate, includeAudio && !!audioUrl, outputFile)
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
  return new Blob([outputData as BlobPart], { type: 'video/mp4' })
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

  return new Blob([outputData as BlobPart], { type: 'video/mp4' })
}

// Helper: concat-based export (no transitions)
async function exportWithConcat(
  ff: FFmpeg,
  videoFiles: string[],
  scaleFilter: string,
  fps: number,
  bitrate: string,
  hasAudio: boolean,
  outputFile: string
): Promise<void> {
  const concatContent = videoFiles.map(f => `file '${f}'`).join('\n')
  await ff.writeFile('concat.txt', concatContent)

  const args = [
    '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
    ...(hasAudio ? ['-i', 'audio.mp3'] : []),
    '-c:v', 'libx264', '-preset', 'fast', '-b:v', bitrate,
    '-vf', scaleFilter, '-r', String(fps),
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : ['-an']),
    '-y', outputFile,
  ]
  await ff.exec(args)
}

// Helper: xfade-based export (crossfade transitions)
async function exportWithCrossfade(
  ff: FFmpeg,
  videoFiles: string[],
  clips: ExportClip[],
  crossfadeDuration: number,
  scaleFilter: string,
  fps: number,
  bitrate: string,
  hasAudio: boolean,
  outputFile: string
): Promise<void> {
  // Build input args: -i clip_0.mp4 -i clip_1.mp4 ...
  const inputArgs: string[] = []
  for (const file of videoFiles) {
    inputArgs.push('-i', file)
  }

  // Build xfade filter chain:
  // [0:v][1:v]xfade=transition=fade:duration=D:offset=O[v01];
  // [v01][2:v]xfade=transition=fade:duration=D:offset=O2[v012]; ...
  const filterParts: string[] = []
  let cumulativeOffset = 0

  for (let i = 0; i < videoFiles.length - 1; i++) {
    const clipDuration = clips[i].duration
    const fadeDur = Math.min(crossfadeDuration, clipDuration * 0.5)
    cumulativeOffset += clipDuration - fadeDur

    const inputA = i === 0 ? `[0:v]` : `[v${i}]`
    const inputB = `[${i + 1}:v]`
    const output = i === videoFiles.length - 2 ? `[vout]` : `[v${i + 1}]`

    filterParts.push(
      `${inputA}${inputB}xfade=transition=fade:duration=${fadeDur.toFixed(2)}:offset=${cumulativeOffset.toFixed(2)}${output}`
    )
  }

  // Add scale filter to the output
  const filterComplex = filterParts.join(';') + `;[vout]${scaleFilter}[final]`

  const args = [
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', '[final]',
    ...(hasAudio ? ['-i', 'audio.mp3', '-map', `${videoFiles.length}:a`, '-c:a', 'aac', '-b:a', '192k', '-shortest'] : ['-an']),
    '-c:v', 'libx264', '-preset', 'fast', '-b:v', bitrate,
    '-r', String(fps),
    '-y', outputFile,
  ]
  await ff.exec(args)
}

// Export storyboard as a JPEG grid image (canvas-based, no FFmpeg needed)
export async function exportStoryboardImage(
  frameUrls: { url: string; title: string }[],
  columns: number = 4
): Promise<Blob> {
  if (frameUrls.length === 0) throw new Error('No frames to export')

  const thumbWidth = 480
  const thumbHeight = 270 // 16:9
  const padding = 8
  const labelHeight = 24
  const rows = Math.ceil(frameUrls.length / columns)

  const canvasWidth = columns * (thumbWidth + padding) + padding
  const canvasHeight = rows * (thumbHeight + labelHeight + padding) + padding

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Load and draw each frame
  for (let i = 0; i < frameUrls.length; i++) {
    const col = i % columns
    const row = Math.floor(i / columns)
    const x = padding + col * (thumbWidth + padding)
    const y = padding + row * (thumbHeight + labelHeight + padding)

    // Draw frame image
    try {
      const img = await loadImage(frameUrls[i].url)
      ctx.drawImage(img, x, y, thumbWidth, thumbHeight)
    } catch {
      // Draw placeholder for failed images
      ctx.fillStyle = '#222'
      ctx.fillRect(x, y, thumbWidth, thumbHeight)
      ctx.fillStyle = '#666'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No frame', x + thumbWidth / 2, y + thumbHeight / 2)
    }

    // Draw label
    ctx.fillStyle = '#000'
    ctx.fillRect(x, y + thumbHeight, thumbWidth, labelHeight)
    ctx.fillStyle = '#ccc'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`#${i + 1} ${frameUrls[i].title}`, x + 6, y + thumbHeight + 16)
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      'image/jpeg',
      0.92
    )
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
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

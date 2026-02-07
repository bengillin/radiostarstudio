/**
 * Simple onset/beat detection using spectral flux with adaptive thresholding.
 *
 * Algorithm:
 * 1. Decode audio to PCM
 * 2. Compute RMS energy per window (512 samples)
 * 3. Calculate spectral flux (positive energy difference between consecutive windows)
 * 4. Apply adaptive threshold (local mean + k * local std deviation)
 * 5. Peak-pick above threshold
 * 6. Enforce minimum interval between beats (prevents double-triggering)
 */

interface BeatDetectionOptions {
  /** Window size in samples for energy computation (default: 512) */
  windowSize?: number
  /** Minimum interval between beats in seconds (default: 0.3 ~= 200 BPM) */
  minInterval?: number
  /** Sensitivity multiplier — lower = more beats detected (default: 1.3) */
  sensitivity?: number
  /** Local average window size in frames for adaptive threshold (default: 16) */
  thresholdWindow?: number
}

export async function detectBeats(
  audioBuffer: ArrayBuffer,
  options: BeatDetectionOptions = {}
): Promise<number[]> {
  const {
    windowSize = 512,
    minInterval = 0.3,
    sensitivity = 1.3,
    thresholdWindow = 16,
  } = options

  // Decode audio
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const decoded = await audioContext.decodeAudioData(audioBuffer.slice(0))
  const sampleRate = decoded.sampleRate
  const channelData = decoded.getChannelData(0) // mono
  audioContext.close()

  // Step 1: Compute RMS energy per window
  const numWindows = Math.floor(channelData.length / windowSize)
  const energy = new Float32Array(numWindows)

  for (let i = 0; i < numWindows; i++) {
    let sum = 0
    const offset = i * windowSize
    for (let j = 0; j < windowSize; j++) {
      const sample = channelData[offset + j]
      sum += sample * sample
    }
    energy[i] = Math.sqrt(sum / windowSize)
  }

  // Step 2: Spectral flux (positive difference only)
  const flux = new Float32Array(numWindows)
  for (let i = 1; i < numWindows; i++) {
    const diff = energy[i] - energy[i - 1]
    flux[i] = diff > 0 ? diff : 0
  }

  // Step 3: Adaptive threshold = local mean + sensitivity * local std
  const threshold = new Float32Array(numWindows)
  const halfWin = Math.floor(thresholdWindow / 2)

  for (let i = 0; i < numWindows; i++) {
    const start = Math.max(0, i - halfWin)
    const end = Math.min(numWindows, i + halfWin + 1)
    const count = end - start

    let mean = 0
    for (let j = start; j < end; j++) mean += flux[j]
    mean /= count

    let variance = 0
    for (let j = start; j < end; j++) {
      const d = flux[j] - mean
      variance += d * d
    }
    variance /= count

    threshold[i] = mean + sensitivity * Math.sqrt(variance)
  }

  // Step 4: Peak-pick above threshold
  const minIntervalFrames = Math.floor((minInterval * sampleRate) / windowSize)
  const beats: number[] = []
  let lastBeatFrame = -minIntervalFrames

  for (let i = 1; i < numWindows - 1; i++) {
    // Must be above threshold and a local peak
    if (
      flux[i] > threshold[i] &&
      flux[i] > flux[i - 1] &&
      flux[i] >= flux[i + 1] &&
      i - lastBeatFrame >= minIntervalFrames
    ) {
      const time = (i * windowSize) / sampleRate
      beats.push(parseFloat(time.toFixed(3)))
      lastBeatFrame = i
    }
  }

  return beats
}

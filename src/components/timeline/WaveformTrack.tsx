'use client'

import { useEffect, useRef, useState } from 'react'

interface WaveformTrackProps {
  audioUrl: string
  duration: number
  zoom: number // px per second
  currentTime: number
  onSeek: (time: number) => void
  labelWidth: number // width of track labels
}

export function WaveformTrack({
  audioUrl,
  duration,
  zoom,
  currentTime,
  onSeek,
  labelWidth,
}: WaveformTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const trackWidth = duration * zoom

  // Generate waveform data from audio
  useEffect(() => {
    if (!audioUrl) return

    const generateWaveform = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(audioUrl)
        const arrayBuffer = await response.arrayBuffer()

        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        // Get audio data from the first channel
        const channelData = audioBuffer.getChannelData(0)
        // Use more samples for better detail when zoomed in
        const samples = Math.min(Math.max(Math.floor(duration * 20), 200), 2000)
        const blockSize = Math.floor(channelData.length / samples)
        const filteredData: number[] = []

        for (let i = 0; i < samples; i++) {
          const blockStart = blockSize * i
          let sum = 0
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[blockStart + j])
          }
          filteredData.push(sum / blockSize)
        }

        // Normalize
        const maxVal = Math.max(...filteredData)
        const normalized = filteredData.map((n) => n / maxVal)

        setWaveformData(normalized)
        audioContext.close()
      } catch (error) {
        console.error('Error generating waveform:', error)
        // Generate placeholder data
        const samples = Math.floor(duration * 10)
        setWaveformData(Array(samples).fill(0).map(() => Math.random() * 0.5 + 0.25))
      }
      setIsLoading(false)
    }

    generateWaveform()
  }, [audioUrl, duration])

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || waveformData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const height = 64 // Track height in pixels

    canvas.width = trackWidth * dpr
    canvas.height = height * dpr
    canvas.style.width = `${trackWidth}px`
    canvas.style.height = `${height}px`

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, trackWidth, height)

    const barWidth = trackWidth / waveformData.length
    const barGap = Math.min(1, barWidth * 0.1)
    const progressRatio = duration > 0 ? currentTime / duration : 0

    waveformData.forEach((value, index) => {
      const x = index * barWidth
      const barHeight = value * height * 0.85
      const y = (height - barHeight) / 2

      // Determine if this bar is before or after the playhead
      const barProgress = index / waveformData.length
      ctx.fillStyle = barProgress <= progressRatio
        ? 'rgb(239, 68, 68)' // brand-500
        : 'rgba(255, 255, 255, 0.25)'

      ctx.fillRect(x + barGap / 2, y, barWidth - barGap, barHeight)
    })
  }, [waveformData, currentTime, duration, trackWidth])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration <= 0) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    // Convert pixel position to time
    const time = x / zoom
    onSeek(Math.max(0, Math.min(duration, time)))
  }

  return (
    <div className="h-16 border-b border-white/10 relative bg-black/30">
      {/* Track label */}
      <div
        className="absolute left-0 top-0 h-full bg-black/50 flex items-center px-2 z-10 border-r border-white/10"
        style={{ width: labelWidth }}
      >
        <span className="text-[10px] text-white/40 uppercase">Audio</span>
      </div>

      {/* Waveform content */}
      <div
        ref={containerRef}
        className="h-full cursor-pointer relative overflow-hidden"
        style={{ marginLeft: labelWidth }}
        onClick={handleClick}
      >
        {isLoading ? (
          <div className="absolute inset-0 animate-pulse bg-white/5" />
        ) : (
          <canvas ref={canvasRef} className="absolute top-0 left-0" />
        )}
      </div>
    </div>
  )
}

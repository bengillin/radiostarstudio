'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface WaveformProps {
  audioUrl: string
  currentTime?: number
  duration: number
  onSeek?: (time: number) => void
  className?: string
  barColor?: string
  progressColor?: string
}

export function Waveform({
  audioUrl,
  currentTime = 0,
  duration,
  onSeek,
  className,
  barColor = 'rgba(255, 255, 255, 0.3)',
  progressColor = 'rgb(239, 68, 68)',
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
        const samples = 200 // Number of bars
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
        setWaveformData(Array(200).fill(0).map(() => Math.random() * 0.5 + 0.25))
      }
      setIsLoading(false)
    }

    generateWaveform()
  }, [audioUrl])

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || waveformData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const barWidth = rect.width / waveformData.length
    const barGap = 1
    const progressRatio = duration > 0 ? currentTime / duration : 0

    waveformData.forEach((value, index) => {
      const x = index * barWidth
      const barHeight = value * rect.height * 0.8
      const y = (rect.height - barHeight) / 2

      // Determine if this bar is before or after the playhead
      const barProgress = index / waveformData.length
      ctx.fillStyle = barProgress <= progressRatio ? progressColor : barColor

      ctx.fillRect(x + barGap / 2, y, barWidth - barGap, barHeight)
    })
  }, [waveformData, currentTime, duration, barColor, progressColor])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !containerRef.current || duration <= 0) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / rect.width
    onSeek(ratio * duration)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-16 cursor-pointer',
        isLoading && 'animate-pulse bg-white/5 rounded',
        className
      )}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  )
}

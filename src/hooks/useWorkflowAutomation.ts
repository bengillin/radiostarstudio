'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useProjectStore } from '@/store/project-store'
import type { TranscriptSegment, Scene, Clip } from '@/types'

interface WorkflowCallbacks {
  onTranscriptionStart?: () => void
  onTranscriptionComplete?: () => void
  onPlanningStart?: () => void
  onPlanningComplete?: () => void
  onError?: (message: string) => void
}

export function useWorkflowAutomation(callbacks?: WorkflowCallbacks) {
  const {
    audioFile,
    transcript,
    scenes,
    clips,
    videos,
    workflow,
    generationQueue,
    setWorkflowStage,
    setWorkflowProgress,
    setWorkflowError,
    setTranscript,
    setScenes,
    setClips,
    setGlobalStyle,
    globalStyle,
  } = useProjectStore()

  // Track if we've already triggered auto-actions to prevent double-firing
  const hasTriggeredTranscription = useRef(false)
  const hasTriggeredPlanning = useRef(false)

  // Reset triggers when audio changes
  useEffect(() => {
    hasTriggeredTranscription.current = false
    hasTriggeredPlanning.current = false
  }, [audioFile?.id])

  // Transcription function
  const startTranscription = useCallback(async () => {
    if (!audioFile?.file) return

    setWorkflowStage('transcribing')
    setWorkflowProgress('transcription', 0)
    callbacks?.onTranscriptionStart?.()

    try {
      const formData = new FormData()
      formData.append('audio', audioFile.file)

      // Simulate progress (actual API doesn't provide progress)
      const progressInterval = setInterval(() => {
        useProjectStore.getState().setWorkflowProgress(
          'transcription',
          Math.min(useProjectStore.getState().workflow.progress.transcription + 10, 90)
        )
      }, 1000)

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Transcription failed')
      }

      if (data.segments) {
        setTranscript(data.segments as TranscriptSegment[])
        setWorkflowProgress('transcription', 100)
        setWorkflowStage('transcribed')
        callbacks?.onTranscriptionComplete?.()

        // Auto-suggest style if not set
        if (!globalStyle) {
          try {
            const styleResponse = await fetch('/api/suggest-style', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transcript: data.segments }),
            })
            const styleData = await styleResponse.json()
            if (styleData.style) {
              setGlobalStyle(styleData.style)
            }
          } catch (styleError) {
            console.error('Style suggestion error:', styleError)
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transcription failed'
      setWorkflowError({
        stage: 'transcribing',
        message,
        retryable: true,
        retryCount: 0,
      })
      setWorkflowStage('audio_loaded')
      callbacks?.onError?.(message)
    }
  }, [audioFile, globalStyle, setTranscript, setWorkflowStage, setWorkflowProgress, setWorkflowError, setGlobalStyle, callbacks])

  // Scene planning function
  const startPlanning = useCallback(async () => {
    if (transcript.length === 0) return

    setWorkflowStage('planning')
    setWorkflowProgress('planning', 0)
    callbacks?.onPlanningStart?.()

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        useProjectStore.getState().setWorkflowProgress(
          'planning',
          Math.min(useProjectStore.getState().workflow.progress.planning + 15, 90)
        )
      }, 800)

      const response = await fetch('/api/plan-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          style: globalStyle,
          duration: audioFile?.duration,
        }),
      })

      clearInterval(progressInterval)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Scene planning failed')
      }

      if (data.scenes) {
        const newScenes = data.scenes as Scene[]
        setScenes(newScenes)

        // Auto-generate clips from transcript segments
        const newClips = transcript.flatMap((segment: TranscriptSegment, segIndex: number) => {
          const matchingScene = newScenes.find((scene: Scene) =>
            segment.start >= scene.startTime && segment.start < scene.endTime
          ) || newScenes.find((scene: Scene) =>
            segment.start < scene.endTime && segment.end > scene.startTime
          )

          if (!matchingScene) return []

          return [{
            id: `clip-${segment.id}`,
            sceneId: matchingScene.id,
            segmentId: segment.id,
            title: `${(segment.type || 'clip').charAt(0).toUpperCase() + (segment.type || 'clip').slice(1)} - ${(segment.text || '').slice(0, 30)}${segment.text && segment.text.length > 30 ? '...' : ''}`,
            startTime: segment.start,
            endTime: segment.end,
            order: segIndex,
          }] as Clip[]
        })

        setClips(newClips)
        setWorkflowProgress('planning', 100)
        setWorkflowStage('planned')
        callbacks?.onPlanningComplete?.()

        if (data.globalStyle && !globalStyle) {
          setGlobalStyle(data.globalStyle)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scene planning failed'
      setWorkflowError({
        stage: 'planning',
        message,
        retryable: true,
        retryCount: 0,
      })
      setWorkflowStage('transcribed')
      callbacks?.onError?.(message)
    }
  }, [transcript, globalStyle, audioFile?.duration, setScenes, setClips, setWorkflowStage, setWorkflowProgress, setWorkflowError, setGlobalStyle, callbacks])

  // Effect 1: Auto-transcribe when audio is loaded
  useEffect(() => {
    if (
      workflow.autoProgress &&
      workflow.stage === 'audio_loaded' &&
      audioFile?.file &&
      !workflow.error &&
      !hasTriggeredTranscription.current
    ) {
      hasTriggeredTranscription.current = true
      // Small delay to let UI settle
      const timer = setTimeout(() => {
        startTranscription()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [workflow.stage, workflow.autoProgress, workflow.error, audioFile?.file, startTranscription])

  // Effect 2: Auto-plan when transcription completes
  useEffect(() => {
    if (
      workflow.autoProgress &&
      workflow.stage === 'transcribed' &&
      transcript.length > 0 &&
      !workflow.error &&
      !hasTriggeredPlanning.current
    ) {
      hasTriggeredPlanning.current = true
      const timer = setTimeout(() => {
        startPlanning()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [workflow.stage, workflow.autoProgress, workflow.error, transcript.length, startPlanning])

  // Effect 3: Update generation progress based on queue
  useEffect(() => {
    if (workflow.stage === 'generating' && generationQueue.items.length > 0) {
      const completed = generationQueue.items.filter(i => i.status === 'complete').length
      const total = generationQueue.items.length
      const progress = Math.round((completed / total) * 100)
      setWorkflowProgress('generation', progress)

      // Check if all items are done
      const allDone = generationQueue.items.every(
        i => i.status === 'complete' || i.status === 'failed'
      )
      if (allDone) {
        // Check if any clips have videos
        const clipsWithVideos = clips.filter(c =>
          c.video || Object.values(videos).some(v => v.clipId === c.id && v.status === 'complete')
        )
        if (clipsWithVideos.length > 0) {
          setWorkflowStage('ready')
        } else {
          setWorkflowStage('planned')
        }
      }
    }
  }, [workflow.stage, generationQueue.items, clips, videos, setWorkflowProgress, setWorkflowStage])

  // Effect 4: Sync workflow stage with data state (for page refresh / rehydration)
  useEffect(() => {
    // Only run if workflow is in initial state but we have data
    if (workflow.stage === 'empty' && audioFile) {
      if (scenes.length > 0 && clips.length > 0) {
        // Check if we have any videos
        const hasVideos = clips.some(c =>
          c.video || Object.values(videos).some(v => v.clipId === c.id && v.status === 'complete')
        )
        setWorkflowStage(hasVideos ? 'ready' : 'planned')
      } else if (transcript.length > 0) {
        setWorkflowStage('transcribed')
      } else {
        setWorkflowStage('audio_loaded')
      }
    }
  }, [workflow.stage, audioFile, transcript.length, scenes.length, clips, videos, setWorkflowStage])

  return {
    startTranscription,
    startPlanning,
    stage: workflow.stage,
    progress: workflow.progress,
    error: workflow.error,
    autoProgress: workflow.autoProgress,
  }
}

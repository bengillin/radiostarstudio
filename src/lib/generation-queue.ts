import type { QueueItem, Scene, Frame, GeneratedVideo } from '@/types'

interface ProcessorCallbacks {
  getState: () => {
    generationQueue: { items: QueueItem[]; isProcessing: boolean; isPaused: boolean }
    clips: Array<{ id: string; sceneId: string; title: string }>
    scenes: Scene[]
    frames: Record<string, Frame>
    globalStyle: string
    modelSettings: { image: string; video: string }
  }
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => void
  setFrame: (frame: Frame) => void
  setVideo: (video: GeneratedVideo) => void
  updateClip: (id: string, updates: Partial<{ startFrame: Frame; endFrame: Frame; video: GeneratedVideo }>) => void
}

const DELAY_BETWEEN_REQUESTS = 500 // ms
const MAX_RETRIES = 2

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function generateFrame(
  clipId: string,
  frameType: 'start' | 'end',
  callbacks: ProcessorCallbacks
): Promise<Frame> {
  const state = callbacks.getState()
  const clip = state.clips.find(c => c.id === clipId)
  const scene = state.scenes.find(s => s.id === clip?.sceneId)

  if (!clip || !scene) {
    throw new Error('Clip or scene not found')
  }

  // Build prompt from scene context
  const parts = [
    scene.where && `Setting: ${scene.where}`,
    scene.when && `Time: ${scene.when}`,
    scene.who?.length && `Characters: ${scene.who.join(', ')}`,
    scene.what && `Action: ${scene.what}`,
    scene.why && `Mood: ${scene.why}`,
    state.globalStyle && `Style: ${state.globalStyle}`,
    frameType === 'end' && 'This is the ending frame of the scene.',
  ].filter(Boolean).join('. ')

  const prompt = parts || `A cinematic frame for "${clip.title}"`

  const response = await fetch('/api/generate-frame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      clipId,
      type: frameType,
      scene: {
        title: scene.title,
        who: scene.who,
        what: scene.what,
        when: scene.when,
        where: scene.where,
        why: scene.why,
      },
      globalStyle: state.globalStyle,
      model: state.modelSettings.image,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.details || error.error || 'Frame generation failed')
  }

  const data = await response.json()
  return data.frame
}

async function generateVideo(
  clipId: string,
  callbacks: ProcessorCallbacks
): Promise<GeneratedVideo> {
  const state = callbacks.getState()
  const clip = state.clips.find(c => c.id === clipId)
  const scene = state.scenes.find(s => s.id === clip?.sceneId)

  if (!clip) {
    throw new Error('Clip not found')
  }

  // Find start frame for this clip
  const startFrame = Object.values(state.frames).find(
    (f: Frame) => f.clipId === clipId && f.type === 'start'
  )

  if (!startFrame) {
    throw new Error('Start frame required for video generation')
  }

  // Build motion prompt from scene context
  const motionPrompt = [
    scene?.what && `Action: ${scene.what}`,
    scene?.why && `Mood: ${scene.why}`,
    'Smooth cinematic motion',
  ].filter(Boolean).join('. ')

  const response = await fetch('/api/generate-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clipId,
      startFrame: startFrame.url,
      motionPrompt,
      model: state.modelSettings.video,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.details || error.error || 'Video generation failed')
  }

  const data = await response.json()
  return data.video
}

export async function processQueueItem(
  item: QueueItem,
  callbacks: ProcessorCallbacks
): Promise<void> {
  try {
    callbacks.updateQueueItem(item.id, {
      status: 'processing',
      startedAt: new Date(),
      progress: 10,
    })

    if (item.type === 'frame') {
      callbacks.updateQueueItem(item.id, { progress: 30 })

      const frame = await generateFrame(item.clipId, item.frameType!, callbacks)

      callbacks.updateQueueItem(item.id, { progress: 80 })

      // Save frame to store
      callbacks.setFrame(frame)

      // Update clip with new frame
      const frameUpdate = item.frameType === 'start'
        ? { startFrame: frame }
        : { endFrame: frame }
      callbacks.updateClip(item.clipId, frameUpdate)

      callbacks.updateQueueItem(item.id, {
        status: 'complete',
        progress: 100,
        completedAt: new Date(),
      })
    } else if (item.type === 'video') {
      callbacks.updateQueueItem(item.id, { progress: 20 })

      const video = await generateVideo(item.clipId, callbacks)

      callbacks.updateQueueItem(item.id, { progress: 90 })

      // Save video to store
      callbacks.setVideo(video)

      // Update clip with new video
      callbacks.updateClip(item.clipId, { video })

      callbacks.updateQueueItem(item.id, {
        status: 'complete',
        progress: 100,
        completedAt: new Date(),
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (item.retryCount < MAX_RETRIES) {
      // Retry
      callbacks.updateQueueItem(item.id, {
        status: 'pending',
        retryCount: item.retryCount + 1,
        error: `Retry ${item.retryCount + 1}/${MAX_RETRIES}: ${message}`,
        progress: 0,
      })
    } else {
      // Mark as failed
      callbacks.updateQueueItem(item.id, {
        status: 'failed',
        error: message,
        completedAt: new Date(),
      })
    }
  }
}

export async function processQueue(callbacks: ProcessorCallbacks): Promise<void> {
  const { generationQueue } = callbacks.getState()

  if (!generationQueue.isProcessing || generationQueue.isPaused) {
    return
  }

  // Find next pending item
  const pendingItem = generationQueue.items.find(item => item.status === 'pending')

  if (!pendingItem) {
    // No more items to process
    return
  }

  await processQueueItem(pendingItem, callbacks)

  // Wait before processing next item
  await sleep(DELAY_BETWEEN_REQUESTS)

  // Continue processing if not paused
  const currentState = callbacks.getState()
  if (currentState.generationQueue.isProcessing && !currentState.generationQueue.isPaused) {
    // Check if there are more pending items
    const hasMorePending = currentState.generationQueue.items.some(item => item.status === 'pending')
    if (hasMorePending) {
      // Process next item
      await processQueue(callbacks)
    }
  }
}

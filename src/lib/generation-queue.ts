import type { QueueItem, Scene, Frame, GeneratedVideo, WorldElement, ElementReferenceImage } from '@/types'

interface ProcessorCallbacks {
  getState: () => {
    generationQueue: { items: QueueItem[]; isProcessing: boolean; isPaused: boolean }
    clips: Array<{ id: string; sceneId: string; title: string; startTime: number; endTime: number }>
    scenes: Scene[]
    frames: Record<string, Frame>
    globalStyle: string
    modelSettings: { image: string; video: string }
    elements: WorldElement[]
    elementImages: Record<string, ElementReferenceImage>
  }
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => void
  setFrame: (frame: Frame) => void
  setVideo: (video: GeneratedVideo) => void
  updateClip: (id: string, updates: Partial<{ startFrame: Frame; endFrame: Frame; video: GeneratedVideo }>) => void
  getResolvedElementsForScene: (sceneId: string) => Array<WorldElement & { overrideDescription?: string }>
}

const DELAY_BETWEEN_REQUESTS = 500 // ms
const MAX_RETRIES = 2

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function generateFrame(
  clipId: string,
  frameType: 'start' | 'end',
  callbacks: ProcessorCallbacks,
  customPrompt?: string
): Promise<Frame> {
  const state = callbacks.getState()
  const clip = state.clips.find(c => c.id === clipId)
  const scene = state.scenes.find(s => s.id === clip?.sceneId)

  if (!clip || !scene) {
    throw new Error('Clip or scene not found')
  }

  // Resolve elements for this scene
  const resolvedElements = callbacks.getResolvedElementsForScene(scene.id)

  // Use custom prompt if provided, otherwise build from resolved elements
  let prompt: string
  if (customPrompt) {
    prompt = customPrompt
  } else if (resolvedElements.length > 0) {
    const byCategory: Record<string, typeof resolvedElements> = {}
    for (const el of resolvedElements) {
      ;(byCategory[el.category] = byCategory[el.category] || []).push(el)
    }
    const parts = [
      byCategory.where && `Setting: ${byCategory.where.map(e => e.overrideDescription || e.description || e.name).join('; ')}`,
      byCategory.when && `Time: ${byCategory.when.map(e => e.overrideDescription || e.description || e.name).join('; ')}`,
      byCategory.who && `Characters: ${byCategory.who.map(e => `${e.name}${e.description ? ` (${e.overrideDescription || e.description})` : ''}`).join(', ')}`,
      byCategory.what && `Action: ${byCategory.what.map(e => e.overrideDescription || e.description || e.name).join('; ')}`,
      byCategory.why && `Mood: ${byCategory.why.map(e => e.overrideDescription || e.description || e.name).join('; ')}`,
      state.globalStyle && `Style: ${state.globalStyle}`,
      frameType === 'end' && 'This is the ending frame of the scene.',
    ].filter(Boolean).join('. ')
    prompt = parts || `A cinematic frame for "${clip.title}"`
  } else {
    // Legacy fallback
    const parts = [
      scene.where && `Setting: ${scene.where}`,
      scene.when && `Time: ${scene.when}`,
      scene.who?.length && `Characters: ${scene.who.join(', ')}`,
      scene.what && `Action: ${scene.what}`,
      scene.why && `Mood: ${scene.why}`,
      state.globalStyle && `Style: ${state.globalStyle}`,
      frameType === 'end' && 'This is the ending frame of the scene.',
    ].filter(Boolean).join('. ')
    prompt = parts || `A cinematic frame for "${clip.title}"`
  }

  // Collect reference images from elements (limit to 3 for API constraints)
  const referenceImages: Array<{ description: string; imageData: string }> = []
  for (const el of resolvedElements.slice(0, 5)) {
    for (const imgId of el.referenceImageIds.slice(0, 1)) { // 1 image per element
      const img = state.elementImages[imgId]
      if (img?.url && referenceImages.length < 3) {
        referenceImages.push({ description: `${el.name} (${el.category})`, imageData: img.url })
      }
    }
  }

  // Build element context for the API
  const elementContext = resolvedElements.map(e => ({
    category: e.category,
    name: e.name,
    description: e.overrideDescription || e.description,
  }))

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
      elements: elementContext,
      referenceImages,
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
  callbacks: ProcessorCallbacks,
  customMotionPrompt?: string
): Promise<GeneratedVideo> {
  const state = callbacks.getState()
  const clip = state.clips.find(c => c.id === clipId)
  const scene = state.scenes.find(s => s.id === clip?.sceneId)

  if (!clip) {
    throw new Error('Clip not found')
  }

  // Find start and end frames for this clip
  const startFrame = Object.values(state.frames).find(
    (f: Frame) => f.clipId === clipId && f.type === 'start'
  )
  const endFrame = Object.values(state.frames).find(
    (f: Frame) => f.clipId === clipId && f.type === 'end'
  )

  if (!startFrame) {
    throw new Error('Start frame required for video generation')
  }

  // Resolve elements for motion prompt
  const resolvedElements = scene ? callbacks.getResolvedElementsForScene(scene.id) : []

  // Use custom motion prompt if provided, otherwise build from resolved elements
  let motionPrompt: string
  if (customMotionPrompt) {
    motionPrompt = customMotionPrompt
  } else if (resolvedElements.length > 0) {
    const byCategory: Record<string, typeof resolvedElements> = {}
    for (const el of resolvedElements) {
      ;(byCategory[el.category] = byCategory[el.category] || []).push(el)
    }
    motionPrompt = [
      byCategory.what && `Action: ${byCategory.what.map(e => e.overrideDescription || e.description || e.name).join('; ')}`,
      byCategory.why && `Mood: ${byCategory.why.map(e => e.overrideDescription || e.description || e.name).join('; ')}`,
      'Smooth cinematic motion',
    ].filter(Boolean).join('. ')
  } else {
    motionPrompt = [
      scene?.what && `Action: ${scene.what}`,
      scene?.why && `Mood: ${scene.why}`,
      'Smooth cinematic motion',
    ].filter(Boolean).join('. ')
  }

  // Build element context for the API
  const elementContext = resolvedElements.map(e => ({
    category: e.category,
    name: e.name,
    description: e.overrideDescription || e.description,
  }))

  // Calculate clip duration for Veo
  const clipDuration = clip.endTime - clip.startTime

  const response = await fetch('/api/generate-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clipId,
      startFrameUrl: startFrame.url,
      endFrameUrl: endFrame?.url, // Pass end frame for interpolation if available
      motionPrompt,
      scene: scene ? {
        title: scene.title,
        who: scene.who,
        what: scene.what,
        when: scene.when,
        where: scene.where,
        why: scene.why,
      } : undefined,
      elements: elementContext,
      globalStyle: state.globalStyle,
      model: state.modelSettings.video,
      clipDuration, // Pass duration so API can choose appropriate Veo duration
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

      const frame = await generateFrame(item.clipId, item.frameType!, callbacks, item.prompt)

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

      const video = await generateVideo(item.clipId, callbacks, item.motionPrompt)

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

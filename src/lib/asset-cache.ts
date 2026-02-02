/**
 * IndexedDB-based asset cache for frames and videos
 *
 * Stores large binary assets (base64 images/videos) in IndexedDB
 * while metadata stays in Zustand/localStorage
 */

const DB_NAME = 'radiostar-assets'
const DB_VERSION = 1
const FRAMES_STORE = 'frames'
const VIDEOS_STORE = 'videos'

interface CachedFrame {
  id: string
  clipId: string
  type: 'start' | 'end'
  source: 'upload' | 'generated'
  url: string // base64 data URL
  prompt?: string
  generatedAt?: string
  model?: string
}

interface CachedVideo {
  id: string
  clipId: string
  url: string // base64 data URL
  duration: number
  status: 'pending' | 'generating' | 'complete' | 'failed'
  startFrameId: string
  endFrameId?: string
  motionPrompt: string
  model: 'veo' | 'runway' | 'pika'
  generatedAt?: string
  jobId?: string
  error?: string
}

let dbPromise: Promise<IDBDatabase> | null = null

/**
 * Initialize and get the IndexedDB database
 */
function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create frames store with clipId index
      if (!db.objectStoreNames.contains(FRAMES_STORE)) {
        const framesStore = db.createObjectStore(FRAMES_STORE, { keyPath: 'id' })
        framesStore.createIndex('clipId', 'clipId', { unique: false })
      }

      // Create videos store with clipId index
      if (!db.objectStoreNames.contains(VIDEOS_STORE)) {
        const videosStore = db.createObjectStore(VIDEOS_STORE, { keyPath: 'id' })
        videosStore.createIndex('clipId', 'clipId', { unique: false })
      }
    }
  })

  return dbPromise
}

// ============================================
// FRAME OPERATIONS
// ============================================

/**
 * Save a frame to IndexedDB
 */
export async function saveFrame(frame: CachedFrame): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FRAMES_STORE, 'readwrite')
    const store = transaction.objectStore(FRAMES_STORE)

    // Convert Date to string for storage
    const frameToStore = {
      ...frame,
      generatedAt: frame.generatedAt ? String(frame.generatedAt) : undefined,
    }

    const request = store.put(frameToStore)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get a frame by ID
 */
export async function getFrame(id: string): Promise<CachedFrame | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FRAMES_STORE, 'readonly')
    const store = transaction.objectStore(FRAMES_STORE)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all frames
 */
export async function getAllFrames(): Promise<CachedFrame[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FRAMES_STORE, 'readonly')
    const store = transaction.objectStore(FRAMES_STORE)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get frames by clip ID
 */
export async function getFramesByClipId(clipId: string): Promise<CachedFrame[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FRAMES_STORE, 'readonly')
    const store = transaction.objectStore(FRAMES_STORE)
    const index = store.index('clipId')
    const request = index.getAll(clipId)

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete a frame by ID
 */
export async function deleteFrame(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FRAMES_STORE, 'readwrite')
    const store = transaction.objectStore(FRAMES_STORE)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete all frames for a clip
 */
export async function deleteFramesByClipId(clipId: string): Promise<void> {
  const frames = await getFramesByClipId(clipId)
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FRAMES_STORE, 'readwrite')
    const store = transaction.objectStore(FRAMES_STORE)

    let remaining = frames.length
    if (remaining === 0) {
      resolve()
      return
    }

    for (const frame of frames) {
      const request = store.delete(frame.id)
      request.onsuccess = () => {
        remaining--
        if (remaining === 0) resolve()
      }
      request.onerror = () => reject(request.error)
    }
  })
}

// ============================================
// VIDEO OPERATIONS
// ============================================

/**
 * Save a video to IndexedDB
 */
export async function saveVideo(video: CachedVideo): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEOS_STORE, 'readwrite')
    const store = transaction.objectStore(VIDEOS_STORE)

    // Convert Date to string for storage
    const videoToStore = {
      ...video,
      generatedAt: video.generatedAt ? String(video.generatedAt) : undefined,
    }

    const request = store.put(videoToStore)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get a video by ID
 */
export async function getVideo(id: string): Promise<CachedVideo | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEOS_STORE, 'readonly')
    const store = transaction.objectStore(VIDEOS_STORE)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all videos
 */
export async function getAllVideos(): Promise<CachedVideo[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEOS_STORE, 'readonly')
    const store = transaction.objectStore(VIDEOS_STORE)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get videos by clip ID
 */
export async function getVideosByClipId(clipId: string): Promise<CachedVideo[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEOS_STORE, 'readonly')
    const store = transaction.objectStore(VIDEOS_STORE)
    const index = store.index('clipId')
    const request = index.getAll(clipId)

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete a video by ID
 */
export async function deleteVideo(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEOS_STORE, 'readwrite')
    const store = transaction.objectStore(VIDEOS_STORE)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete all videos for a clip
 */
export async function deleteVideosByClipId(clipId: string): Promise<void> {
  const videos = await getVideosByClipId(clipId)
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEOS_STORE, 'readwrite')
    const store = transaction.objectStore(VIDEOS_STORE)

    let remaining = videos.length
    if (remaining === 0) {
      resolve()
      return
    }

    for (const video of videos) {
      const request = store.delete(video.id)
      request.onsuccess = () => {
        remaining--
        if (remaining === 0) resolve()
      }
      request.onerror = () => reject(request.error)
    }
  })
}

// ============================================
// UTILITY OPERATIONS
// ============================================

/**
 * Clear all cached assets
 */
export async function clearAllAssets(): Promise<void> {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FRAMES_STORE, VIDEOS_STORE], 'readwrite')

    const framesStore = transaction.objectStore(FRAMES_STORE)
    const videosStore = transaction.objectStore(VIDEOS_STORE)

    let completed = 0
    const checkComplete = () => {
      completed++
      if (completed === 2) resolve()
    }

    const framesRequest = framesStore.clear()
    framesRequest.onsuccess = checkComplete
    framesRequest.onerror = () => reject(framesRequest.error)

    const videosRequest = videosStore.clear()
    videosRequest.onsuccess = checkComplete
    videosRequest.onerror = () => reject(videosRequest.error)
  })
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<{
  frameCount: number
  videoCount: number
  estimatedSize: string
}> {
  const frames = await getAllFrames()
  const videos = await getAllVideos()

  // Estimate size from base64 strings
  let totalBytes = 0

  for (const frame of frames) {
    if (frame.url) {
      // base64 is ~33% larger than binary, so divide by 1.33
      totalBytes += (frame.url.length * 0.75)
    }
  }

  for (const video of videos) {
    if (video.url) {
      totalBytes += (video.url.length * 0.75)
    }
  }

  // Format size
  let estimatedSize: string
  if (totalBytes < 1024) {
    estimatedSize = `${totalBytes} B`
  } else if (totalBytes < 1024 * 1024) {
    estimatedSize = `${(totalBytes / 1024).toFixed(1)} KB`
  } else if (totalBytes < 1024 * 1024 * 1024) {
    estimatedSize = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
  } else {
    estimatedSize = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  return {
    frameCount: frames.length,
    videoCount: videos.length,
    estimatedSize,
  }
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

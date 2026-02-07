/**
 * IndexedDB-based asset cache for frames and videos
 *
 * Stores large binary assets (base64 images/videos) in IndexedDB
 * while metadata stays in Zustand/localStorage
 */

import { getActiveProjectId, getDbName } from './project-manager'

const DB_VERSION = 3
const FRAMES_STORE = 'frames'
const VIDEOS_STORE = 'videos'
const REFERENCES_STORE = 'references'
const AUDIO_STORE = 'audio'
const ELEMENT_IMAGES_STORE = 'element-images'

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

interface CachedReference {
  id: string
  name: string
  url: string // base64 data URL
  uploadedAt: string
  tags?: string[]
  width?: number
  height?: number
}

interface CachedAudio {
  id: string
  name: string
  url: string // base64 data URL
  duration: number
  uploadedAt: string
}

interface CachedElementImage {
  id: string
  elementId: string
  url: string // base64 data URL
  source: 'upload' | 'generated'
  prompt?: string
  createdAt: string
}

let dbPromise: Promise<IDBDatabase> | null = null
let currentDbName: string | null = null

/**
 * Initialize and get the IndexedDB database (scoped to active project)
 */
function getDB(): Promise<IDBDatabase> {
  const dbName = getDbName(getActiveProjectId())

  // If project changed (shouldn't happen without reload, but safety), reset
  if (currentDbName && currentDbName !== dbName) {
    dbPromise = null
  }

  if (dbPromise) return dbPromise
  currentDbName = dbName

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION)

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion

      // v1: Create frames and videos stores
      if (oldVersion < 1) {
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

      // v2: Add references and audio stores
      if (oldVersion < 2) {
        // Create references store
        if (!db.objectStoreNames.contains(REFERENCES_STORE)) {
          db.createObjectStore(REFERENCES_STORE, { keyPath: 'id' })
        }

        // Create audio store
        if (!db.objectStoreNames.contains(AUDIO_STORE)) {
          db.createObjectStore(AUDIO_STORE, { keyPath: 'id' })
        }
      }

      // v3: Add element images store
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(ELEMENT_IMAGES_STORE)) {
          const store = db.createObjectStore(ELEMENT_IMAGES_STORE, { keyPath: 'id' })
          store.createIndex('elementId', 'elementId', { unique: false })
        }
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
// REFERENCE IMAGE OPERATIONS
// ============================================

/**
 * Save a reference image to IndexedDB
 */
export async function saveReference(ref: CachedReference): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REFERENCES_STORE, 'readwrite')
    const store = transaction.objectStore(REFERENCES_STORE)
    const request = store.put(ref)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get a reference image by ID
 */
export async function getReference(id: string): Promise<CachedReference | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REFERENCES_STORE, 'readonly')
    const store = transaction.objectStore(REFERENCES_STORE)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all reference images
 */
export async function getAllReferences(): Promise<CachedReference[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REFERENCES_STORE, 'readonly')
    const store = transaction.objectStore(REFERENCES_STORE)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete a reference image by ID
 */
export async function deleteReference(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(REFERENCES_STORE, 'readwrite')
    const store = transaction.objectStore(REFERENCES_STORE)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// AUDIO OPERATIONS
// ============================================

/**
 * Save audio to IndexedDB
 */
export async function saveAudio(audio: CachedAudio): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readwrite')
    const store = transaction.objectStore(AUDIO_STORE)
    const request = store.put(audio)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get audio by ID
 */
export async function getAudio(id: string): Promise<CachedAudio | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readonly')
    const store = transaction.objectStore(AUDIO_STORE)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all audio files
 */
export async function getAllAudio(): Promise<CachedAudio[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readonly')
    const store = transaction.objectStore(AUDIO_STORE)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete audio by ID
 */
export async function deleteAudio(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readwrite')
    const store = transaction.objectStore(AUDIO_STORE)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// ELEMENT IMAGE OPERATIONS
// ============================================

/**
 * Save an element reference image to IndexedDB
 */
export async function saveElementImage(image: CachedElementImage): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ELEMENT_IMAGES_STORE, 'readwrite')
    const store = transaction.objectStore(ELEMENT_IMAGES_STORE)
    const request = store.put(image)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get an element image by ID
 */
export async function getElementImage(id: string): Promise<CachedElementImage | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ELEMENT_IMAGES_STORE, 'readonly')
    const store = transaction.objectStore(ELEMENT_IMAGES_STORE)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all element images for a specific element
 */
export async function getElementImagesByElementId(elementId: string): Promise<CachedElementImage[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ELEMENT_IMAGES_STORE, 'readonly')
    const store = transaction.objectStore(ELEMENT_IMAGES_STORE)
    const index = store.index('elementId')
    const request = index.getAll(elementId)
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all element images
 */
export async function getAllElementImages(): Promise<CachedElementImage[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ELEMENT_IMAGES_STORE, 'readonly')
    const store = transaction.objectStore(ELEMENT_IMAGES_STORE)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete an element image by ID
 */
export async function deleteElementImage(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ELEMENT_IMAGES_STORE, 'readwrite')
    const store = transaction.objectStore(ELEMENT_IMAGES_STORE)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete all images for an element
 */
export async function deleteElementImagesByElementId(elementId: string): Promise<void> {
  const images = await getElementImagesByElementId(elementId)
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ELEMENT_IMAGES_STORE, 'readwrite')
    const store = transaction.objectStore(ELEMENT_IMAGES_STORE)

    let remaining = images.length
    if (remaining === 0) {
      resolve()
      return
    }

    for (const image of images) {
      const request = store.delete(image.id)
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
    const transaction = db.transaction(
      [FRAMES_STORE, VIDEOS_STORE, REFERENCES_STORE, AUDIO_STORE, ELEMENT_IMAGES_STORE],
      'readwrite'
    )

    const stores = [FRAMES_STORE, VIDEOS_STORE, REFERENCES_STORE, AUDIO_STORE, ELEMENT_IMAGES_STORE]
    let completed = 0

    const checkComplete = () => {
      completed++
      if (completed === stores.length) resolve()
    }

    for (const storeName of stores) {
      const store = transaction.objectStore(storeName)
      const request = store.clear()
      request.onsuccess = checkComplete
      request.onerror = () => reject(request.error)
    }
  })
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<{
  frameCount: number
  videoCount: number
  referenceCount: number
  audioCount: number
  elementImageCount: number
  estimatedSize: string
  breakdown: {
    frames: string
    videos: string
    references: string
    audio: string
    elementImages: string
  }
}> {
  const frames = await getAllFrames()
  const videos = await getAllVideos()
  const references = await getAllReferences()
  const audioFiles = await getAllAudio()
  const elementImages = await getAllElementImages()

  // Estimate size from base64 strings (base64 is ~33% larger than binary)
  let frameBytes = 0
  let videoBytes = 0
  let referenceBytes = 0
  let audioBytes = 0
  let elementImageBytes = 0

  for (const frame of frames) {
    if (frame.url) {
      frameBytes += (frame.url.length * 0.75)
    }
  }

  for (const video of videos) {
    if (video.url) {
      videoBytes += (video.url.length * 0.75)
    }
  }

  for (const ref of references) {
    if (ref.url) {
      referenceBytes += (ref.url.length * 0.75)
    }
  }

  for (const audio of audioFiles) {
    if (audio.url) {
      audioBytes += (audio.url.length * 0.75)
    }
  }

  for (const img of elementImages) {
    if (img.url) {
      elementImageBytes += (img.url.length * 0.75)
    }
  }

  const totalBytes = frameBytes + videoBytes + referenceBytes + audioBytes + elementImageBytes

  return {
    frameCount: frames.length,
    videoCount: videos.length,
    referenceCount: references.length,
    audioCount: audioFiles.length,
    elementImageCount: elementImages.length,
    estimatedSize: formatBytes(totalBytes),
    breakdown: {
      frames: formatBytes(frameBytes),
      videos: formatBytes(videoBytes),
      references: formatBytes(referenceBytes),
      audio: formatBytes(audioBytes),
      elementImages: formatBytes(elementImageBytes),
    },
  }
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

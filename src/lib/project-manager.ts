/**
 * Project manager — handles multi-project persistence.
 *
 * Each project gets:
 *   - localStorage: radiostar-project-{id} (Zustand state)
 *   - IndexedDB:    radiostar-assets-{id}  (frames, videos, audio, etc.)
 *
 * A master list of project metadata lives at radiostar-projects.
 * The active project ID lives at radiostar-active-project.
 *
 * Switching projects reloads the page so Zustand and IndexedDB
 * pick up the correct keys naturally on initialization.
 */

export interface ProjectMetadata {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

const PROJECTS_LIST_KEY = 'radiostar-projects'
const ACTIVE_PROJECT_KEY = 'radiostar-active-project'
const OLD_STORE_KEY = 'radiostar-project'
const OLD_DB_NAME = 'radiostar-assets'
const MIGRATION_FLAG = 'radiostar-migration-v1'

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

export function getStoreKey(projectId: string): string {
  return `radiostar-project-${projectId}`
}

export function getDbName(projectId: string): string {
  return `radiostar-assets-${projectId}`
}

// ---------------------------------------------------------------------------
// Project list CRUD (localStorage)
// ---------------------------------------------------------------------------

export function getProjectsList(): ProjectMetadata[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PROJECTS_LIST_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveProjectsList(projects: ProjectMetadata[]): void {
  localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(projects))
}

export function getActiveProjectId(): string {
  if (typeof window === 'undefined') return 'default'
  return localStorage.getItem(ACTIVE_PROJECT_KEY) || 'default'
}

function setActiveProjectId(id: string): void {
  localStorage.setItem(ACTIVE_PROJECT_KEY, id)
}

// ---------------------------------------------------------------------------
// Project operations
// ---------------------------------------------------------------------------

export function createProject(name: string): ProjectMetadata {
  const now = new Date().toISOString()
  const project: ProjectMetadata = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
  }
  const list = getProjectsList()
  list.push(project)
  saveProjectsList(list)
  return project
}

export function renameProject(id: string, name: string): void {
  const list = getProjectsList()
  const project = list.find(p => p.id === id)
  if (project) {
    project.name = name
    project.updatedAt = new Date().toISOString()
    saveProjectsList(list)
  }
}

export async function deleteProject(id: string): Promise<void> {
  let list = getProjectsList()
  list = list.filter(p => p.id !== id)

  // Remove the project's Zustand state from localStorage
  try { localStorage.removeItem(getStoreKey(id)) } catch { /* ignore */ }

  // Delete the project's IndexedDB
  try {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(getDbName(id))
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // IndexedDB delete can fail silently — continue
  }

  // If we deleted the active project, switch to another
  if (getActiveProjectId() === id) {
    if (list.length === 0) {
      // Create a fresh default project
      const fresh = createProject('New Project')
      list.push(fresh)
      setActiveProjectId(fresh.id)
    } else {
      setActiveProjectId(list[0].id)
    }
  }

  saveProjectsList(list)
}

export function switchProject(id: string): void {
  const current = getActiveProjectId()
  if (id === current) return
  setActiveProjectId(id)
  // Update the switched-to project's updatedAt
  const list = getProjectsList()
  const project = list.find(p => p.id === id)
  if (project) {
    project.updatedAt = new Date().toISOString()
    saveProjectsList(list)
  }
  window.location.reload()
}

export function createAndSwitchProject(name: string): void {
  const project = createProject(name)
  setActiveProjectId(project.id)
  window.location.reload()
}

// ---------------------------------------------------------------------------
// One-time migration from single-project to multi-project
// ---------------------------------------------------------------------------

export async function migrateFromSingleProject(): Promise<void> {
  if (typeof window === 'undefined') return

  // Already migrated?
  if (localStorage.getItem(MIGRATION_FLAG)) return

  const existingList = localStorage.getItem(PROJECTS_LIST_KEY)
  if (existingList) {
    // Already has project list — mark as migrated
    localStorage.setItem(MIGRATION_FLAG, 'done')
    return
  }

  const now = new Date().toISOString()
  const projectId = 'default'

  // Check if there's existing Zustand state under the old key
  const oldState = localStorage.getItem(OLD_STORE_KEY)
  if (oldState) {
    // Copy to new project-scoped key
    localStorage.setItem(getStoreKey(projectId), oldState)
  }

  // Copy IndexedDB: radiostar-assets → radiostar-assets-default
  try {
    await copyIndexedDB(OLD_DB_NAME, getDbName(projectId))
  } catch (err) {
    console.warn('[project-manager] IndexedDB migration failed, starting fresh:', err)
  }

  // Create the project list with the migrated project
  const project: ProjectMetadata = {
    id: projectId,
    name: 'My Project',
    createdAt: now,
    updatedAt: now,
  }
  saveProjectsList([project])
  setActiveProjectId(projectId)

  // Clean up old keys (only after successful copy)
  try { localStorage.removeItem(OLD_STORE_KEY) } catch { /* ignore */ }
  try {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(OLD_DB_NAME)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve() // Don't block on failure
    })
  } catch { /* ignore */ }

  localStorage.setItem(MIGRATION_FLAG, 'done')
}

// ---------------------------------------------------------------------------
// IndexedDB copy helper
// ---------------------------------------------------------------------------

async function copyIndexedDB(oldName: string, newName: string): Promise<void> {
  // Check if old DB exists by trying to open it
  const oldDb = await new Promise<IDBDatabase | null>((resolve) => {
    const req = indexedDB.open(oldName)
    req.onsuccess = () => {
      const db = req.result
      if (db.objectStoreNames.length === 0) {
        db.close()
        resolve(null)
      } else {
        resolve(db)
      }
    }
    req.onerror = () => resolve(null)
  })

  if (!oldDb) return // Nothing to copy

  const storeNames = Array.from(oldDb.objectStoreNames)
  const version = oldDb.version

  // Create new DB with same schema
  const newDb = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(newName, version)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const storeName of storeNames) {
        if (!db.objectStoreNames.contains(storeName)) {
          const oldStore = oldDb.transaction(storeName, 'readonly').objectStore(storeName)
          const newStore = db.createObjectStore(storeName, {
            keyPath: oldStore.keyPath as string,
          })
          // Copy indexes
          for (const indexName of Array.from(oldStore.indexNames)) {
            const oldIndex = oldStore.index(indexName)
            newStore.createIndex(indexName, oldIndex.keyPath, {
              unique: oldIndex.unique,
              multiEntry: oldIndex.multiEntry,
            })
          }
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  // Copy all records from each store
  for (const storeName of storeNames) {
    const records = await new Promise<unknown[]>((resolve, reject) => {
      const tx = oldDb.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    if (records.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = newDb.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        for (const record of records) {
          store.put(record)
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    }
  }

  oldDb.close()
  newDb.close()
}

// ---------------------------------------------------------------------------
// Ensure a project list exists (called early in app lifecycle)
// ---------------------------------------------------------------------------

export function ensureProjectExists(): void {
  if (typeof window === 'undefined') return
  const list = getProjectsList()
  if (list.length === 0) {
    const project = createProject('New Project')
    setActiveProjectId(project.id)
  } else if (!list.find(p => p.id === getActiveProjectId())) {
    // Active project doesn't exist in list — pick first
    setActiveProjectId(list[0].id)
  }
}

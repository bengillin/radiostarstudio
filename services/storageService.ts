import { ParodySong } from "../types";

const DB_NAME = 'RadiostarDB';
const STORE_NAME = 'songs';
const DB_VERSION = 1;

// Open Database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const saveSong = async (song: ParodySong): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // We no longer sanitize/strip images because IndexedDB handles large Blobs/Strings well
      // This ensures images persist across reloads
      const request = store.put(song);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to save song to IndexedDB", e);
  }
};

export const getHistory = async (): Promise<ParodySong[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by createdAt desc (newest first)
        const songs = (request.result as ParodySong[]) || [];
        songs.sort((a, b) => b.createdAt - a.createdAt);
        resolve(songs);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to load history from IndexedDB", e);
    return [];
  }
};

export const getRelatedSongs = async (groupId: string): Promise<ParodySong[]> => {
  try {
    const allSongs = await getHistory();
    // Filter by group ID, sort by creation date
    return allSongs
      .filter(s => s.groupId === groupId)
      .sort((a, b) => a.createdAt - b.createdAt); // Oldest first (Version 1, 2...)
  } catch (e) {
    console.error("Failed to load related versions", e);
    return [];
  }
};

export const deleteSong = async (id: string): Promise<ParodySong[]> => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Return updated history
    return getHistory();
  } catch (e) {
    console.error("Error deleting song", e);
    return [];
  }
};
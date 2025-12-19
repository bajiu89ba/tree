import { StoredPhoto, StoredMusic } from '../types';

const DB_NAME = "GrandTreeDB_v17_React";
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains('music')) {
        db.createObjectStore('music', { keyPath: "id" });
      }
    };

    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const savePhotoToDB = async (base64Data: string): Promise<string> => {
  const db = await openDB();
  const id = Date.now() + Math.random().toString();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('photos', 'readwrite');
    const store = transaction.objectStore('photos');
    const request = store.add({ id, data: base64Data });
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject("Failed to save photo");
  });
};

export const loadPhotosFromDB = async (): Promise<StoredPhoto[]> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const transaction = db.transaction('photos', 'readonly');
    const store = transaction.objectStore('photos');
    const request = store.getAll();
    request.onsuccess = (e: any) => resolve(e.target.result || []);
  });
};

export const deletePhotoFromDB = async (id: string): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction('photos', 'readwrite');
  transaction.objectStore('photos').delete(id);
};

export const clearPhotosDB = async (): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction('photos', 'readwrite');
  transaction.objectStore('photos').clear();
};

export const saveMusicToDB = async (file: File): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction('music', 'readwrite');
  transaction.objectStore('music').put({ id: 'bgm', data: file });
};

export const loadMusicFromDB = async (): Promise<Blob | null> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const transaction = db.transaction('music', 'readonly');
    const request = transaction.objectStore('music').get('bgm');
    request.onsuccess = (e: any) => resolve(e.target.result ? e.target.result.data : null);
  });
};
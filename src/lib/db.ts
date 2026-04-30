import type { TranscriptionRecord } from "@/types/transcription-history";

const DB_NAME = "linksy";
const DB_VERSION = 1;
const RECORD_STORE = "transcriptions";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        const store = db.createObjectStore(RECORD_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("打开 IndexedDB 失败"));
  });

  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, mode);
    const store = tx.objectStore(RECORD_STORE);
    const request = callback(store);

    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB 请求失败"));
    } else {
      tx.oncomplete = () => resolve(undefined as T);
    }

    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB 事务失败"));
  });
}

export async function listTranscriptionRecords() {
  const records = await withStore<TranscriptionRecord[]>("readonly", (store) => store.getAll());
  return records.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getTranscriptionRecord(id: string) {
  return withStore<TranscriptionRecord | undefined>("readonly", (store) => store.get(id));
}

export async function saveTranscriptionRecord(record: TranscriptionRecord) {
  const nextRecord = { ...record, updatedAt: new Date() };
  await withStore<IDBValidKey>("readwrite", (store) => store.put(nextRecord));
  return nextRecord;
}

export function deleteTranscriptionRecord(id: string) {
  return withStore<undefined>("readwrite", (store) => {
    store.delete(id);
  });
}

export async function clearTranscriptionRecords() {
  await withStore<undefined>("readwrite", (store) => {
    store.clear();
  });
}

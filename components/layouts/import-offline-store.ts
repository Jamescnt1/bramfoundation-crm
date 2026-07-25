"use client";

export type QueuedLayoutImport = {
  id: string;
  jobId: string;
  layoutName: string;
  roomOrArea: string;
  notes: string;
  replaceLayoutId: string;
  file: Blob;
  fileName: string;
  fileType: string;
  queuedAt: string;
};

const DATABASE = "foundation-layout-imports";
const STORE = "pending-imports";
const VERSION = 1;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueLayoutImport(value: QueuedLayoutImport) {
  const database = await openDatabase();
  await transaction(database, "readwrite", (store) => store.put(value));
  database.close();
}

export async function getQueuedLayoutImports(jobId: string) {
  const database = await openDatabase();
  const values = await new Promise<QueuedLayoutImport[]>((resolve, reject) => {
    const request = database.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as QueuedLayoutImport[]).filter((item) => item.jobId === jobId));
    request.onerror = () => reject(request.error);
  });
  database.close();
  return values.sort((first, second) => first.queuedAt.localeCompare(second.queuedAt));
}

export async function removeQueuedLayoutImport(id: string) {
  const database = await openDatabase();
  await transaction(database, "readwrite", (store) => store.delete(id));
  database.close();
}

function transaction(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
) {
  return new Promise<void>((resolve, reject) => {
    const request = operation(database.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

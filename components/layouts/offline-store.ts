import type { LayoutDocument } from "@/components/layouts/types";

const DATABASE = "foundation-layouts-beta";
const STORE = "drafts";
const VERSION = 1;

export type OfflineLayoutDraft = {
  layoutId: string;
  jobId: string;
  name: string;
  document: LayoutDocument;
  expectedUpdatedAt: string;
  savedLocallyAt: string;
  pendingSync: boolean;
};

export async function getOfflineDraft(layoutId: string) {
  return transaction<OfflineLayoutDraft | null>("readonly", (store) => request(store.get(layoutId)), null);
}

export async function putOfflineDraft(draft: OfflineLayoutDraft) {
  await transaction("readwrite", (store) => request(store.put(draft)), undefined);
}

export async function clearOfflineDraft(layoutId: string) {
  await transaction("readwrite", (store) => request(store.delete(layoutId)), undefined);
}

async function transaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>,
  fallback: T,
): Promise<T> {
  if (typeof indexedDB === "undefined") return fallback;
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE, mode);
    const result = await work(tx.objectStore(STORE));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  } finally {
    database.close();
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const requestValue = indexedDB.open(DATABASE, VERSION);
    requestValue.onupgradeneeded = () => {
      const database = requestValue.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: "layoutId" });
    };
    requestValue.onsuccess = () => resolve(requestValue.result);
    requestValue.onerror = () => reject(requestValue.error);
  });
}

function request<T>(value: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}

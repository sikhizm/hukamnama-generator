type SavedAudio = { name: string; blob: Blob };
async function audioStore(mode: IDBTransactionMode, data?: SavedAudio): Promise<SavedAudio | null> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("sikhizm-media-v1", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("audio");
    open.onerror = () => reject(new Error("Audio storage is unavailable in this browser."));
    open.onsuccess = () => {
      const db = open.result, transaction = db.transaction("audio", mode), store = transaction.objectStore("audio");
      const request = data ? store.put(data, "chant") : store.get("chant");
      transaction.oncomplete = () => { db.close(); resolve(data ?? request.result ?? null); };
      transaction.onerror = () => { db.close(); reject(new Error("Could not save the chant in this browser.")); };
    };
  });
}
export const loadChant = () => audioStore("readonly");
export const saveChant = (data: SavedAudio) => audioStore("readwrite", data);

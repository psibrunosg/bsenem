export const idb = {
  dbPromise: new Promise((resolve, reject) => {
    const request = indexedDB.open('bsenem-store', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('keyval');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }),
  async get(key) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keyval', 'readonly');
      const store = tx.objectStore('keyval');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async set(key, val) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keyval', 'readwrite');
      const store = tx.objectStore('keyval');
      const req = store.put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
};

/* =========================================================================
   WINTER ARC · STORAGE SERVICE
   A narrow key/value contract so the persistence layer can be swapped for a
   backend later without touching a single screen or store action.
   ========================================================================= */

export interface StorageService {
  readonly name: string;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** True when writes are actually durable. */
  readonly durable: boolean;
}

class MemoryStorageService implements StorageService {
  readonly name = 'memory';
  readonly durable = false;
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

class LocalStorageService implements StorageService {
  readonly name = 'localStorage';
  readonly durable = true;

  getItem(key: string): string | null {
    return window.localStorage.getItem(key);
  }
  setItem(key: string, value: string): void {
    window.localStorage.setItem(key, value);
  }
  removeItem(key: string): void {
    window.localStorage.removeItem(key);
  }
}

function probeLocalStorage(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = '__winter_arc_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

let instance: StorageService | null = null;

/**
 * Resolve the best available storage. In a private window or with site data
 * blocked, this falls back to memory so the app still runs for the session;
 * `durable` then reports false and the UI warns the user.
 */
export function getStorage(): StorageService {
  if (!instance) {
    instance = probeLocalStorage() ? new LocalStorageService() : new MemoryStorageService();
  }
  return instance;
}

/** Used by tests and by the "reset everything" flow. */
export function setStorage(service: StorageService): void {
  instance = service;
}

export function isStorageDurable(): boolean {
  return getStorage().durable;
}

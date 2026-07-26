import type { StateStorage } from 'zustand/middleware';

// Web persistence for the auth session.
//
// expo-secure-store is a native module with no web implementation, so the web
// build uses localStorage. This is the same trust model every browser-based app
// operates under: the token is readable by scripts on our own origin. It is
// mitigated by short-lived access tokens (60 min) and a revocable refresh token
// that the server can invalidate.
//
// localStorage (not sessionStorage) is deliberate: an installed PWA launched
// from the iPhone home screen gets a fresh session storage each cold start,
// which would log the user out every time they opened the app.
const memoryFallback = new Map<string, string>();

// Safari in Private Browsing throws on localStorage writes rather than
// returning null, and server-side rendering has no window at all. Falling back
// to memory keeps the app usable for the length of the session.
function safeLocalStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probe = '__banker_lapp_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export const authStorage: StateStorage = {
  getItem: (name) => {
    const store = safeLocalStorage();
    return store ? store.getItem(name) : memoryFallback.get(name) ?? null;
  },
  setItem: (name, value) => {
    const store = safeLocalStorage();
    if (store) store.setItem(name, value);
    else memoryFallback.set(name, value);
  },
  removeItem: (name) => {
    const store = safeLocalStorage();
    if (store) store.removeItem(name);
    else memoryFallback.delete(name);
  },
};

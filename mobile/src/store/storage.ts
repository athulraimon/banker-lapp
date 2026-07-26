import type { StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

// Native persistence for the auth session. The web build resolves
// storage.web.ts instead (Metro picks the platform extension automatically),
// so nothing in the app has to branch on Platform.OS.
export const authStorage: StateStorage = {
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  getItem: (name) => SecureStore.getItemAsync(name),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
// Resolves to storage.ts (expo-secure-store) on native and storage.web.ts
// (localStorage) on web. See those files for the trade-offs.
import { authStorage } from './storage';

export interface User {
  id: string;
  google_id: string;
  display_name: string;
  email: string;
  photo_url: string;
  is_admin: boolean;
  created_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  // True when the visitor chose "Look around first" instead of signing in. It is
  // persisted, so the choice survives a relaunch and they are not asked again on
  // every open — signing in, or signing out, clears it.
  isGuest: boolean;
  // Set the instant a sign-in attempt starts, cleared when it resolves. On web,
  // signing in navigates the whole page to Google and comes back to "/", and the
  // ID token in that fragment is only redeemed by the login screen. A remembered
  // guest would otherwise be left on the tabs and the sign-in would vanish
  // without a word, so the router uses this flag to route them to the login
  // screen once, whatever their guest state says. Persisted because the page is
  // destroyed and rebuilt in between.
  signInPending: boolean;
  accessTokenExp: number | null; // Unix timestamp in seconds
  // True once the persisted session has been read back from storage. The router
  // must wait for this: rendering before rehydration finishes would bounce a
  // logged-in user to the login screen, which on web is a visible URL flash.
  hasHydrated: boolean;
  setAuthWithExpiry: (user: User, accessToken: string, refreshToken: string) => void;
  continueAsGuest: () => void;
  setSignInPending: (pending: boolean) => void;
  // Replaces the cached user without touching the session. Renaming yourself does
  // not change the token — it carries only the id and admin flag — so reissuing
  // one would be pointless churn.
  setUser: (user: User) => void;
  logout: () => void;
}

// Helper to decode JWT payload (base64url)
const decodeJwtPayload = (token: string): { exp?: number } | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // Replace base64url chars and decode
    const decoded = atob(
      payload.replace(/-/g, '+').replace(/_/g, '/')
    );
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isGuest: false,
      signInPending: false,
      accessTokenExp: null,
      hasHydrated: false,
      setAuthWithExpiry: (user, accessToken, refreshToken) => {
        const payload = decodeJwtPayload(accessToken);
        const exp = payload?.exp ?? null;
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isGuest: false,
          signInPending: false,
          accessTokenExp: exp,
        });
      },
      continueAsGuest: () => set({ isGuest: true, signInPending: false }),
      setSignInPending: (signInPending) => set({ signInPending }),
      setUser: (user) => set({ user }),
      logout: () => set({ 
        user: null, 
        accessToken: null, 
        refreshToken: null, 
        isAuthenticated: false,
        // Signing out returns to the choice screen rather than dropping into
        // guest mode, which would look like the sign-out silently failed.
        isGuest: false,
        signInPending: false,
        accessTokenExp: null 
      }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => authStorage),
      // hasHydrated is derived at runtime, never persisted.
      partialize: ({ hasHydrated, ...rest }) => rest,
    }
  )
);

// Hydration flag, set from outside the store definition.
//
// This deliberately does NOT use persist's `onRehydrateStorage` callback. Web
// storage is synchronous, so that callback fires *during* create(), while the
// `useAuthStore` binding is still in its temporal dead zone — touching it there
// throws and the module never finishes evaluating, which renders a blank page.
// Native storage is async, so the same code appears to work on Android and
// fails only on web.
//
// Both branches below are needed: sync storage has already finished hydrating
// by the time we get here, while async storage finishes later.
const markHydrated = () => useAuthStore.setState({ hasHydrated: true });

if (useAuthStore.persist.hasHydrated()) {
  markHydrated();
}
// Fires on completion and on failure alike, so a storage error can't leave the
// app stuck on a permanent splash screen.
useAuthStore.persist.onFinishHydration(markHydrated);

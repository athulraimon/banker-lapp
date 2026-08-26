import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { authStorage } from './storage';
import { Prediction } from '../api/predictions';

interface PendingPredictionState {
  // Picks a guest made before signing in. Held until the sign-in completes, then
  // submitted on their behalf — the alternative is making someone who just did
  // the work do it again, at the exact moment we are asking them to sign up.
  //
  // Persisted because the web sign-in is a full redirect to Google: the page is
  // torn down and rebuilt, so anything kept only in memory is gone by the time
  // they come back.
  pending: Prediction | null;
  setPending: (prediction: Prediction) => void;
  clearPending: () => void;
}

export const usePendingPredictionStore = create<PendingPredictionState>()(
  persist(
    (set) => ({
      pending: null,
      setPending: (pending) => set({ pending }),
      clearPending: () => set({ pending: null }),
    }),
    {
      name: 'pending-prediction',
      storage: createJSONStorage(() => authStorage),
    }
  )
);

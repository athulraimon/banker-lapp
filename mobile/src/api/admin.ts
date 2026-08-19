import { apiClient } from './client';
import { Prediction } from './predictions';

export interface AdminPredictionView {
  user_id: string;
  display_name: string;
  email: string;
  prediction: Prediction | null;
}

// One registered player as the admin panel lists them. The two totals are what a
// deletion would destroy, shown so it is not a blind action.
export interface AdminAccount {
  user_id: string;
  display_name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  predictions: number;
  total_points: number;
}

export interface ResultInput {
  pole_driver_id: string;
  p1_driver_id: string;
  p2_driver_id: string;
  p3_driver_id: string;
}

export const adminApi = {
  // Pull the real Grand Prix calendar from Jolpica.
  syncSchedule: async (season?: number): Promise<{ races: number }> => {
    const q = season ? `?season=${season}` : '';
    const response = await apiClient.post(`/admin/schedule/sync${q}`);
    return response.data;
  },

  // Record official results for a race; the backend rescores automatically.
  setResults: async (raceId: string, results: ResultInput): Promise<void> => {
    await apiClient.put(`/admin/races/${raceId}/results`, results);
  },

  recalculateScores: async (raceId: string): Promise<void> => {
    await apiClient.post(`/admin/races/${raceId}/recalculate`);
  },

  // Remove a race's official result + scores (reverts it to awaiting results).
  clearResults: async (raceId: string): Promise<void> => {
    await apiClient.delete(`/admin/races/${raceId}/results`);
  },

  // Every registered user with their prediction (or null) for a race.
  listPredictions: async (raceId: string): Promise<AdminPredictionView[]> => {
    const response = await apiClient.get<AdminPredictionView[]>(`/admin/races/${raceId}/predictions`);
    return Array.isArray(response.data) ? response.data : [];
  },

  // Set or correct any user's prediction (bypasses the FP1 lock).
  upsertUserPrediction: async (raceId: string, userId: string, results: ResultInput): Promise<void> => {
    await apiClient.put(`/admin/races/${raceId}/users/${userId}/prediction`, results);
  },

  listAccounts: async (): Promise<AdminAccount[]> => {
    const response = await apiClient.get<AdminAccount[]>('/admin/users');
    return Array.isArray(response.data) ? response.data : [];
  },

  // Removes a player and their whole history. The server refuses to delete the
  // acting admin's own account — that belongs on the Profile tab, which also
  // clears the local session.
  deleteAccount: async (userId: string): Promise<void> => {
    await apiClient.delete(`/admin/users/${encodeURIComponent(userId)}`);
  },
};

import { apiClient } from './client';

export interface Race {
  id: string;
  api_race_id: string;
  grand_prix: string;
  circuit_name: string;
  country: string;
  fp1_time: string;
  qualifying_time: string;
  race_time: string;
  season: number;
  status: string; // "upcoming", "open", "locked", "completed"

  // Optional: a sprint weekend has no FP2/FP3, a normal one has no sprint.
  // Absent sessions are omitted by the API rather than sent as a zero time.
  fp2_time?: string | null;
  fp3_time?: string | null;
  sprint_qualifying_time?: string | null;
  sprint_time?: string | null;
}

export interface RaceResult {
  id: string;
  race_id: string;
  pole_driver_id: string;
  p1_driver_id: string;
  p2_driver_id: string;
  p3_driver_id: string;
  fetched_at: string;
}

export interface RaceResultWithPredictions {
  race_result: RaceResult | null;
  predictions: Array<{
    id: string;
    user_id: string;
    race_id: string;
    pole_driver_id: string;
    p1_driver_id: string;
    p2_driver_id: string;
    p3_driver_id: string;
    locked: boolean;
  }>;
  race_scores: Array<{
    id: string;
    user_id: string;
    user_name: string;
    race_id: string;
    points: number;
    correct_winner: boolean;
    calculated_at: string;
  }>;
}

type RacesResponse = Race[] | { races?: Race[]; data?: Race[] } | null | undefined;

const normalizeRaces = (payload: RacesResponse): Race[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.races)) {
    return payload.races;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

export const racesApi = {
  getRaces: async (season: number = 2026): Promise<Race[]> => {
    const response = await apiClient.get<RacesResponse>(`/races?season=${season}`);
    return normalizeRaces(response.data);
  },
  
  getRace: async (id: string): Promise<Race> => {
    const response = await apiClient.get<Race>(`/races/${id}`);
    return response.data;
  },

  getRaceResults: async (id: string): Promise<RaceResultWithPredictions> => {
    const response = await apiClient.get<RaceResultWithPredictions>(`/races/${id}/results`);
    return response.data;
  }
};

import { apiClient } from './client';

export interface Standing {
  rank: number;
  user_id: string;
  user_name: string;
  total_points: number;
  correct_winners: number;
  pole_count: number;
}

// A row of the official F1 World Drivers' Championship.
export interface DriverStanding {
  position: number;
  points: number;
  wins: number;
  driver_id: string;
  broadcast_name: string;
  team_name: string;
  team_color: string;
}

// One predicted position measured against what actually happened.
export interface SlotComparison {
  predicted: string;
  actual: string;
  hit: boolean;
  points: number;
}

export interface PredictionBreakdown {
  pole: SlotComparison;
  p1: SlotComparison;
  p2: SlotComparison;
  p3: SlotComparison;
  points: number;
  hits: number;
  correct_winner: boolean;
}

// A finished race the player entered. Only races that have actually finished
// appear — picks for a race that hasn't run stay secret until the window locks.
//
// `resulted` is false when the race is over but an admin hasn't entered the
// official podium yet. Those rows show the picks with the result withheld, rather
// than looking like four missed calls.
export interface PlayerRaceEntry {
  race_id: string;
  round: number;
  grand_prix: string;
  country: string;
  race_time: string;
  season: number;
  resulted: boolean;
  breakdown: PredictionBreakdown;
}

export interface PlayerProfile {
  user_id: string;
  user_name: string;
  rank: number;
  total_points: number;
  races_scored: number;
  pole_hits: number;
  p1_hits: number;
  p2_hits: number;
  p3_hits: number;
  entries: PlayerRaceEntry[];
}

type StandingsResponse = Standing[] | { standings?: Standing[]; data?: Standing[] } | null | undefined;

const normalizeStandings = (payload: StandingsResponse): Standing[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.standings)) {
    return payload.standings;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

export const standingsApi = {
  getGlobalStandings: async (): Promise<Standing[]> => {
    const response = await apiClient.get<StandingsResponse>('/standings');
    return normalizeStandings(response.data);
  },

  getDriverStandings: async (): Promise<DriverStanding[]> => {
    const response = await apiClient.get<DriverStanding[]>('/drivers/standings');
    return Array.isArray(response.data) ? response.data : [];
  },

  getPlayerProfile: async (userId: string): Promise<PlayerProfile> => {
    const response = await apiClient.get<PlayerProfile>(
      `/standings/players/${encodeURIComponent(userId)}`
    );
    return response.data;
  },
};

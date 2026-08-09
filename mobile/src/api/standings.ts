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
};

import { apiClient } from './client';

export interface Standing {
  rank: number;
  user_id: string;
  user_name: string;
  total_points: number;
  correct_winners: number;
  pole_count: number;
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
  }
};

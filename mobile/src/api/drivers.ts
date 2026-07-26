import { apiClient } from './client';

export interface Driver {
  driver_id: string; // acronym, e.g. "VER" — shared by predictions and results
  broadcast_name: string;
  team_name: string;
  team_color: string;
}

export const driversApi = {
  getDrivers: async (): Promise<Driver[]> => {
    const response = await apiClient.get<Driver[]>('/drivers');
    return Array.isArray(response.data) ? response.data : [];
  },
};

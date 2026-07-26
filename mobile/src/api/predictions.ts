import { apiClient } from './client';

export interface Prediction {
  id?: string;
  user_id?: string;
  race_id: string;
  pole_driver_id: string;
  p1_driver_id: string;
  p2_driver_id: string;
  p3_driver_id: string;
  locked?: boolean;
}

export const predictionsApi = {
  getPrediction: async (raceId: string): Promise<Prediction | null> => {
    const response = await apiClient.get<Prediction | null>(`/predictions/${raceId}`);
    return response.data;
  },
  
  submitPrediction: async (prediction: Prediction): Promise<void> => {
    if (prediction.id) {
      await apiClient.put(`/predictions/${prediction.id}`, prediction);
    } else {
      await apiClient.post('/predictions', prediction);
    }
  }
};

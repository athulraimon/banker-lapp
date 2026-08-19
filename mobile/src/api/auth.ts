import { apiClient } from './client';
import { User } from '../store/useAuthStore';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export const authApi = {
  googleLogin: async (idToken: string): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/google', {
      id_token: idToken,
    });
    return response.data;
  },

  devLogin: async (): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/dev');
    return response.data;
  },
  
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  // Both of these are scoped to the caller's token — there is no user id to pass,
  // so one player can never rename or delete another.
  updateDisplayName: async (displayName: string): Promise<User> => {
    const response = await apiClient.patch<User>('/auth/me', { display_name: displayName });
    return response.data;
  },

  deleteAccount: async (): Promise<void> => {
    await apiClient.delete('/auth/me');
  },
};

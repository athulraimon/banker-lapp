import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// For local development on Android emulator, 10.0.2.2 points to localhost.
// For physical devices, use your computer's LAN IP, e.g. http://192.168.1.6:8080.
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8080';

const commonHeaders = {
  'Content-Type': 'application/json',
  // Bypasses ngrok's free-tier browser interstitial for API calls; harmless
  // on other hosts (Cloudflare, direct, cloud deploys).
  'ngrok-skip-browser-warning': 'true',
};

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { ...commonHeaders },
});

// A single in-flight refresh shared by all callers. Without this, a screen that
// fires several requests at once would trigger several concurrent refreshes,
// which used to invalidate each other and log the user out.
let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    const resp = await axios.post(
      `${API_URL}/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { ...commonHeaders } }
    );
    const { access_token, refresh_token, user } = resp.data;
    useAuthStore.getState().setAuthWithExpiry(user, access_token, refresh_token);
    return access_token as string;
  } catch (err) {
    // Only log out when the server explicitly rejects the refresh token. A
    // network error / timeout (common on tunnels) must NOT end the session.
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 401 || status === 403) {
      useAuthStore.getState().logout();
    }
    return null;
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Request interceptor: proactively refresh the access token when it is expired
// or about to expire, sharing one refresh across concurrent requests.
apiClient.interceptors.request.use(
  async (config) => {
    const { accessToken, refreshToken, accessTokenExp } = useAuthStore.getState();
    if (!accessToken) return config;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const isExpired = !accessTokenExp || nowSeconds >= accessTokenExp - 30;

    if (isExpired && refreshToken) {
      const newToken = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${newToken ?? accessToken}`;
    } else {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on a 401, refresh once and retry the original request.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || originalRequest?.baseURL || API_URL;
    console.error('API request failed', {
      method: originalRequest?.method,
      url: requestUrl,
      status: error.response?.status,
      message: error.message,
    });

    if (!originalRequest?.headers?.Authorization) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

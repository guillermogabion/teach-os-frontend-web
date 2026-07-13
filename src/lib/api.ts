import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const ACCESS_TOKEN_KEY = "teachos_access_token";
const REFRESH_TOKEN_KEY = "teachos_refresh_token";

export const tokenStore = {
  getAccess: () => sessionStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => sessionStorage.getItem(REFRESH_TOKEN_KEY),
  set: (access: string, refresh: string) => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, access);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear: () => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export const api = axios.create({
  baseURL: "baseURL: import.meta.env.VITE_API_URL",
});

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error("No refresh token available");

  const { data } = await axios.post("/api/auth/refresh", { refreshToken });
  tokenStore.set(data.accessToken, data.refreshToken);
  return data.accessToken;
}

// On 401, try exactly one silent refresh-and-retry before giving up.
// refreshInFlight dedupes concurrent 401s into a single refresh call.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry && tokenStore.getRefresh()) {
      original._retry = true;
      try {
        refreshInFlight ??= refreshAccessToken().finally(() => {
          refreshInFlight = null;
        });
        const newAccessToken = await refreshInFlight;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      } catch {
        tokenStore.clear();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

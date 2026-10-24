import axios from "axios";
import { API_URL } from "../config/api";
import { store } from "../store/store";
import { logout } from "../store/slices/authSlice";

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Request Interceptor: Attach Auth Token, Content-Type, and normalize URLs
apiClient.interceptors.request.use(
  (config) => {
    // URL Normalization: handle callers passing full endpoints that already contain baseURL
    if (config.url) {
      if (config.baseURL && config.url.startsWith(config.baseURL)) {
        config.url = config.url.slice(config.baseURL.length);
        if (!config.url.startsWith("/")) {
          config.url = `/${config.url}`;
        }
      } else if (config.url.startsWith("/api/")) {
        // If baseURL already ends with /api (as in development), prevent double /api
        if (config.baseURL?.endsWith("/api")) {
          config.url = config.url.replace(/^\/api/, "");
        }
      }
    }

    // Attach Bearer Token from Redux store or localStorage fallback
    try {
      const state = store?.getState?.();
      const token =
        state?.auth?.user?.token ||
        JSON.parse(localStorage.getItem("user") || "null")?.token;

      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage/store parse error
    }

    // Set JSON content-type if not FormData and not already specified
    if (!(config.data instanceof FormData) && !config.headers["Content-Type"]) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Global 401s, setup notifications, and error enrichment
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    // Handle session expiration (401 Unauthorized)
    if (status === 401) {
      const code = data?.code;
      if (code === "INVALID_TOKEN" || code === "NO_TOKEN" || !code) {
        store.dispatch(logout());
      }
    }

    // Notify app if setup is required
    if (data?.code === "SETUP_REQUIRED") {
      window.dispatchEvent(new CustomEvent("merchpilot:setup_required"));
    }

    // Enrich error message for convenient downstream consumption
    if (data?.message) {
      error.userMessage = data.message;
    }

    return Promise.reject(error);
  }
);

export default apiClient;

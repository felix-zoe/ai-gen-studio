import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
});

// Add JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally and extract FastAPI error details
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      // Only redirect if not already on a guest page — avoids redirect loops
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/register") {
        window.location.href = "/login";
      }
    }
    // FastAPI HTTPException returns {"detail": "..."} — surface it as the error message
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail) {
      error.message = detail;
    }
    return Promise.reject(error);
  },
);

export default api;

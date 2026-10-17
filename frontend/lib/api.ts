import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("genx_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("[api] 401 from", error.config?.url);
    }
    return Promise.reject(error);
  }
);
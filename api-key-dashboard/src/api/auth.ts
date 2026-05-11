import axios from "axios";
import { apiClient } from "./client";

export type AdminUser = {
  username: string;
  role: "admin";
};

export type AdminAuthState = {
  authenticated: boolean;
  user: AdminUser;
};

export type LoginInput = {
  username: string;
  password: string;
};

export const authApi = {
  me: async () => {
    const response = await apiClient.get<AdminAuthState>("/auth/me");
    return response.data;
  },
  login: async (input: LoginInput) => {
    const response = await apiClient.post<AdminAuthState>("/auth/login", input);
    return response.data;
  },
  logout: async () => {
    const response = await apiClient.post<{ authenticated: false }>("/auth/logout");
    return response.data;
  },
};

export function isUnauthorizedError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}
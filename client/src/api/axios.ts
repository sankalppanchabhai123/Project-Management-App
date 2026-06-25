import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { authApi } from '../contexts/AuthContext';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
    withCredentials: true,
});

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
    accessToken = token;
}
let socketId: string | null = null;

export function setSocketId(token: string | null) {
    socketId = token;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (accessToken) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    if (socketId) {
        config.headers = config.headers ?? {};
        config.headers['x-socket-id'] = socketId;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

        if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;
        refreshInFlight ??= authApi
            .post('/auth/refresh')
            .then((response) => {
                const nextToken = response.data?.accessToken ?? null;
                setAccessToken(nextToken);
                return nextToken;
            })
            .finally(() => {
                refreshInFlight = null;
            });

        const nextToken = await refreshInFlight;

        if (!nextToken) {
            return Promise.reject(error);
        }

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;

        return api(originalRequest);
    }
);

export default api;

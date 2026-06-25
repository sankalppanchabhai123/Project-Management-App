import axios from 'axios';
import { createContext, useEffect, useMemo, useState } from 'react';
import { setAccessToken } from '../api/axios';

type AuthUser = {
    id: string;
    name: string;
    avatarUrl?: string;
};

type AuthContextValue = {
    user: AuthUser | null;
    accessToken: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    setSession: (payload: { user: AuthUser; accessToken: string }) => void;
    clearSession: () => void;
    refreshSession: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const authApi = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
    withCredentials: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [accessToken, setAccessTokenState] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const clearSession = () => {
        setUser(null);
        setAccessTokenState(null);
        setAccessToken(null);
    };

    const setSession = (payload: { user: AuthUser; accessToken: string }) => {
        setUser(payload.user);
        setAccessTokenState(payload.accessToken);
        setAccessToken(payload.accessToken);
    };

    const refreshSession = async () => {
        try {
            const response = await authApi.post('/auth/refresh');
            const nextToken = response.data?.accessToken ?? null;
            const nextUser = response.data?.user ?? null;

            if (nextToken && nextUser) {
                setSession({ user: nextUser, accessToken: nextToken });
            } else {
                clearSession();
            }
        } catch {
            clearSession();
        }
    };

    useEffect(() => {
        void refreshSession().finally(() => setIsLoading(false));
    }, []);

    const value = useMemo(
        () => ({
            user,
            accessToken,
            isLoading,
            isAuthenticated: Boolean(user && accessToken),
            setSession,
            clearSession,
            refreshSession,
        }),
        [user, accessToken, isLoading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { createContext, useEffect, useMemo, useState } from 'react';

type Theme = 'dark' | 'light';

type ThemeContextValue = {
    theme: Theme;
    isDark: boolean;
    toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        const savedTheme = window.localStorage.getItem('taskflow-theme');
        return savedTheme === 'light' ? 'light' : 'dark';
    });

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        window.localStorage.setItem('taskflow-theme', theme);
    }, [theme]);

    const value = useMemo(
        () => ({
            theme,
            isDark: theme === 'dark',
            toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
        }),
        [theme]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

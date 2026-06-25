import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { ThemeProvider } from '../contexts/ThemeContext';

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <ToastProvider>
                    <AuthProvider>{children}</AuthProvider>
                </ToastProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}
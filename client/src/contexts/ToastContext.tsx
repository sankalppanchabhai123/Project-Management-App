import { createContext, useContext, useMemo, useState } from 'react';

type ToastContextValue = {
    error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [, setMessages] = useState<Array<{ id: string; message: string }>>([]);

    const error = (message: string) => {
        const id = crypto.randomUUID();
        setMessages((current) => [...current, { id, message }]);
        window.setTimeout(() => {
            setMessages((current) => current.filter((toast) => toast.id !== id));
        }, 3000);
        window.alert(message);
    };

    const value = useMemo(() => ({ error }), []);

    return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }

    return context;
}
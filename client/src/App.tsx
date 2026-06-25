import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { useAuth } from './hooks/useAuth';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ProjectBoardPage } from './pages/ProjectBoardPage';

function RootRedirect() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return null;
    }

    return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route
                element={
                    <ProtectedRoute>
                        <AppShell />
                    </ProtectedRoute>
                }
            >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/projects/:id" element={<ProjectBoardPage />} />
            </Route>
        </Routes>
    );
}
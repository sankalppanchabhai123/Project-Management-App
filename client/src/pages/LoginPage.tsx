import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
    const navigate = useNavigate();
    const { setSession } = useAuth();

    const handleDemoLogin = () => {
        setSession({
            user: { id: 'user-1', name: 'Taskflow User' },
            accessToken: 'demo-access-token',
        });
        navigate('/dashboard', { replace: true });
    };

    return (
        <div className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/20">
                <h1 className="text-3xl font-semibold">Welcome back</h1>
                <p className="mt-2 text-sm text-slate-300">Sign in to continue to your workspace.</p>
                <button
                    className="mt-8 w-full rounded-xl bg-cyan-400 px-4 py-3 font-medium text-slate-950 hover:bg-cyan-300"
                    onClick={handleDemoLogin}
                    type="button"
                >
                    Demo login
                </button>
            </div>
        </div>
    );
}

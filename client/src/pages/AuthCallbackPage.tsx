import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AuthCallbackPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setSession } = useAuth();

    useEffect(() => {
        const token = searchParams.get('token');

        if (token) {
            setSession({
                user: { id: 'oauth-user', name: 'OAuth User' },
                accessToken: token,
            });
            navigate('/dashboard', { replace: true });
        } else {
            navigate('/login', { replace: true });
        }
    }, [navigate, searchParams, setSession]);

    return null;
}

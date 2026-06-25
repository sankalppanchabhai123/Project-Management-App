import { ChevronLeft, ChevronRight, FolderKanban, LayoutDashboard, LogOut, MoonStar, SunMedium } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

type SidebarProps = {
    projects: Array<{ id: string; name: string }>;
};

export function Sidebar({ projects }: SidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { user, clearSession } = useAuth();
    const { isDark, toggleTheme } = useTheme();

    return (
        <aside
            className="flex min-h-screen flex-col border-r border-white/10 bg-slate-900/95 text-slate-100 transition-[width] duration-200 dark:bg-slate-900/95"
            style={{ width: isCollapsed ? '64px' : '240px' }}
        >
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
                {!isCollapsed && <span className="font-semibold tracking-wide text-cyan-300">Taskflow</span>}
                <button
                    className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                    onClick={() => setIsCollapsed((value) => !value)}
                    type="button"
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <div className="flex-1 space-y-6 px-3 py-4">
                <Link className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white/10" to="/dashboard">
                    <LayoutDashboard size={18} />
                    {!isCollapsed && <span>Dashboard</span>}
                </Link>

                <div>
                    {!isCollapsed && <p className="px-3 pb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Projects</p>}
                    <div className="space-y-1">
                        {projects.map((project) => (
                            <Link
                                key={project.id}
                                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white/10"
                                to={`/projects/${project.id}`}
                            >
                                <FolderKanban size={18} />
                                {!isCollapsed && <span className="truncate">{project.name}</span>}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-3 border-t border-white/10 p-3">
                <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-200">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300">
                        {user?.name?.slice(0, 1) ?? 'U'}
                    </div>
                    {!isCollapsed && <span className="truncate">{user?.name ?? 'Guest'}</span>}
                </div>

                <button
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white/10"
                    onClick={clearSession}
                    type="button"
                >
                    <LogOut size={18} />
                    {!isCollapsed && <span>Logout</span>}
                </button>

                <button
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white/10"
                    onClick={toggleTheme}
                    type="button"
                >
                    {isDark ? <SunMedium size={18} /> : <MoonStar size={18} />}
                    {!isCollapsed && <span>{isDark ? 'Light mode' : 'Dark mode'}</span>}
                </button>
            </div>
        </aside>
    );
}

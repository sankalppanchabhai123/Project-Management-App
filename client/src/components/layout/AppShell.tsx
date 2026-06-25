import { Outlet, useParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useProjects } from '../../hooks/useProjects';

export function AppShell() {
    const { id } = useParams();
    const { projects } = useProjects();
    const currentProject = projects.find((project) => project.id === id) ?? projects[0];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 dark:bg-slate-950">
            <div className="flex min-h-screen">
                <Sidebar projects={projects} />
                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="flex h-16 items-center border-b border-white/10 bg-slate-900/80 px-6 backdrop-blur dark:bg-slate-900/80">
                        <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Current project</p>
                            <h1 className="text-lg font-semibold text-white">{currentProject?.name ?? 'Dashboard'}</h1>
                        </div>
                    </header>
                    <main className="flex-1 p-6">
                        <Outlet context={{ currentProject }} />
                    </main>
                </div>
            </div>
        </div>
    );
}

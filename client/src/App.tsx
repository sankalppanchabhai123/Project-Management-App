import { Link, Route, Routes } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { BarChart3, KanbanSquare, LayoutDashboard, Users } from 'lucide-react';
import type { ReactNode } from 'react';

const lastUpdated = new Date();

export default function App() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6 lg:px-10">
                <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Taskflow</p>
                        <h1 className="mt-2 text-3xl font-semibold">Project management built for fast-moving teams.</h1>
                        <p className="mt-2 max-w-2xl text-sm text-slate-300">
                            Boards, automation, analytics, and real-time collaboration in a Trello-style workspace.
                        </p>
                    </div>
                    <nav className="flex flex-wrap gap-3 text-sm text-slate-200">
                        <Link className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10" to="/">
                            Dashboard
                        </Link>
                        <Link className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10" to="/boards">
                            Boards
                        </Link>
                        <Link className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10" to="/team">
                            Team
                        </Link>
                    </nav>
                </header>

                <main className="grid flex-1 gap-6 py-6 lg:grid-cols-[2fr_1fr]">
                    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/15 via-slate-900 to-slate-900 p-6 shadow-2xl shadow-cyan-950/30">
                        <Routes>
                            <Route
                                path="/"
                                element={
                                    <div className="space-y-6">
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <Metric icon={<LayoutDashboard className="h-5 w-5" />} label="Active boards" value="12" />
                                            <Metric icon={<KanbanSquare className="h-5 w-5" />} label="Open tasks" value="84" />
                                            <Metric icon={<Users className="h-5 w-5" />} label="Collaborators" value="26" />
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                                            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Live status</p>
                                            <h2 className="mt-2 text-2xl font-semibold">Realtime updates are connected.</h2>
                                            <p className="mt-2 text-sm text-slate-300">
                                                Last refreshed {formatDistanceToNow(lastUpdated, { addSuffix: true })}.
                                            </p>
                                        </div>
                                    </div>
                                }
                            />
                            <Route
                                path="/boards"
                                element={
                                    <div className="rounded-2xl border border-dashed border-white/15 p-8 text-slate-300">
                                        Board workspace placeholder.
                                    </div>
                                }
                            />
                            <Route
                                path="/team"
                                element={
                                    <div className="rounded-2xl border border-dashed border-white/15 p-8 text-slate-300">
                                        Team management placeholder.
                                    </div>
                                }
                            />
                        </Routes>
                    </section>

                    <aside className="space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                            <div className="flex items-center gap-3 text-cyan-300">
                                <BarChart3 className="h-5 w-5" />
                                <span className="text-sm uppercase tracking-[0.2em]">Insights</span>
                            </div>
                            <p className="mt-4 text-sm text-slate-300">
                                Chart.js is ready for burndown, workload, and delivery analytics.
                            </p>
                        </div>
                    </aside>
                </main>
            </div>
        </div>
    );
}

function Metric({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="flex items-center gap-3 text-cyan-300">
                {icon}
                <span className="text-sm text-slate-300">{label}</span>
            </div>
            <div className="mt-4 text-3xl font-semibold">{value}</div>
        </article>
    );
}
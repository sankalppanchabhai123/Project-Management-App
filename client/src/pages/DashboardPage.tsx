import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
    Chart as ChartJS,
    ArcElement,
    CategoryScale,
    ChartData,
    ChartOptions,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    BarElement,
} from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { CheckCircle2, Clock3, LayoutDashboard, AlertTriangle, FolderKanban, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Title, Tooltip, Legend);

type DashboardResponse = {
    totalTasks: number;
    completedThisWeek: number;
    overdueTasks: number;
    statusDistribution: { pending: number; ongoing: number; completed: number };
    completionTrend: Array<{ date: string; completed: number }>;
    priorityBreakdown: { low: number; medium: number; high: number; urgent: number };
    recentActivity: Array<{
        id: string;
        type: 'created' | 'moved' | 'completed';
        title: string;
        projectId: string;
        projectTitle: string;
        user: { id: string; name: string; avatar: string | null } | null;
        createdAt: string;
    }>;
    myTasks: Array<{
        id: string;
        title: string;
        dueDate: string | null;
        projectId: string;
        project: { id: string; title: string; color: string };
        dueGroup: 'Today' | 'This Week' | 'Later';
    }>;
    projects: Array<{ id: string; title: string; color: string }>;
};

const css = getComputedStyle(document.documentElement);

export function DashboardPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [data, setData] = useState<DashboardResponse | null>(null);

    useEffect(() => {
        void api.get<DashboardResponse>('/api/dashboard').then((response) => setData(response.data));
    }, []);

    const chartColors = {
        pending: 'rgb(100, 116, 139)',
        ongoing: 'rgb(59, 130, 246)',
        completed: 'rgb(34, 197, 94)',
        surface: 'rgba(15, 23, 42, 0.08)',
        text: 'rgb(148, 163, 184)',
    };

    if (!data) {
        return (
            <div className="grid min-h-[50vh] place-items-center text-slate-400">
                Loading dashboard...
            </div>
        );
    }

    const statusChartData: ChartData<'doughnut'> = {
        labels: ['Pending', 'Ongoing', 'Completed'],
        datasets: [
            {
                data: [data.statusDistribution.pending, data.statusDistribution.ongoing, data.statusDistribution.completed],
                backgroundColor: [chartColors.pending, chartColors.ongoing, chartColors.completed],
                borderWidth: 0,
                hoverOffset: 8,
            },
        ],
    };

    const completionLineData: ChartData<'line'> = {
        labels: data.completionTrend.map((entry) => format(new Date(entry.date), 'EEE')),
        datasets: [
            {
                label: 'Completed',
                data: data.completionTrend.map((entry) => entry.completed),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.22)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
            },
        ],
    };

    const priorityBarData: ChartData<'bar'> = {
        labels: ['Low', 'Medium', 'High', 'Urgent'],
        datasets: [
            {
                label: 'Tasks',
                data: [data.priorityBreakdown.low, data.priorityBreakdown.medium, data.priorityBreakdown.high, data.priorityBreakdown.urgent],
                backgroundColor: ['rgb(34, 197, 94)', 'rgb(234, 179, 8)', 'rgb(249, 115, 22)', 'rgb(239, 68, 68)'],
                borderRadius: 999,
                borderSkipped: false,
            },
        ],
    };

    const chartOptions: ChartOptions<'doughnut' | 'line' | 'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart' },
        plugins: {
            legend: {
                labels: { color: css.getPropertyValue('--dashboard-chart-text') || chartColors.text },
            },
        },
        scales: {
            x: { ticks: { color: chartColors.text }, grid: { color: 'rgba(148, 163, 184, 0.15)' } },
            y: { ticks: { color: chartColors.text }, grid: { color: 'rgba(148, 163, 184, 0.15)' } },
        },
    };

    const myTasksGrouped = data.myTasks.reduce<Record<string, typeof data.myTasks>>((accumulator, task) => {
        accumulator[task.dueGroup] = accumulator[task.dueGroup] ?? [];
        accumulator[task.dueGroup].push(task);
        return accumulator;
    }, {});

    return (
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
                <section className="grid gap-4 md:grid-cols-3">
                    <StatCard icon={<LayoutDashboard />} label="Total tasks" value={data.totalTasks} />
                    <StatCard
                        icon={<CheckCircle2 />}
                        label="Completed this week"
                        value={`${data.completedThisWeek} (${Math.round((data.completedThisWeek / Math.max(data.totalTasks, 1)) * 100)}%)`}
                    />
                    <StatCard
                        icon={<AlertTriangle />}
                        label="Overdue tasks"
                        value={data.overdueTasks}
                        highlight={data.overdueTasks > 0}
                    />
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                    <Panel title="Status Distribution" subtitle="Pending, ongoing, and completed task split">
                        <div className="h-72">
                            <Doughnut
                                data={statusChartData}
                                options={{
                                    ...chartOptions,
                                    plugins: {
                                        ...chartOptions.plugins,
                                        tooltip: { enabled: true },
                                        legend: { position: 'bottom', labels: { color: chartColors.text } },
                                    },
                                    cutout: '68%',
                                }}
                                plugins={[centerLabelPlugin(data.totalTasks)]}
                            />
                        </div>
                    </Panel>

                    <Panel title="Task Completion Over Time" subtitle="Last 7 days">
                        <div className="h-72">
                            <Line
                                data={completionLineData}
                                options={{
                                    ...chartOptions,
                                    plugins: {
                                        ...chartOptions.plugins,
                                        legend: { display: false },
                                    },
                                }}
                            />
                        </div>
                    </Panel>

                    <Panel title="Priority Breakdown" subtitle="Tasks by urgency">
                        <div className="h-72">
                            <Bar
                                data={priorityBarData}
                                options={{
                                    ...chartOptions,
                                    indexAxis: 'y',
                                    plugins: {
                                        ...chartOptions.plugins,
                                        legend: { display: false },
                                    },
                                }}
                            />
                        </div>
                    </Panel>

                    <Panel title="Recent Activity" subtitle="Last 10 task events">
                        <div className="space-y-3">
                            {data.recentActivity.map((event) => (
                                <div key={event.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold text-blue-500">
                                        {event.user?.name?.slice(0, 1) ?? 'U'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                            {event.user?.name ?? 'Someone'} {event.type} “{event.title}”
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {event.projectTitle} · {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </section>
            </div>

            <div className="space-y-6">
                <Panel title="My Tasks" subtitle="Assigned to you">
                    <div className="space-y-4">
                        {(['Today', 'This Week', 'Later'] as const).map((group) => (
                            <div key={group} className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{group}</p>
                                <div className="space-y-2">
                                    {(myTasksGrouped[group] ?? []).map((task) => (
                                        <button
                                            key={task.id}
                                            className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800"
                                            onClick={() => navigate(`/projects/${task.projectId}`)}
                                            type="button"
                                        >
                                            <p className="text-sm font-medium text-slate-900 dark:text-white">{task.title}</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {task.project.title} {task.dueDate ? `· Due ${format(new Date(task.dueDate), 'MMM d')}` : ''}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title="Projects" subtitle="Accessible workspaces">
                    <div className="space-y-2">
                        {data.projects.map((project) => (
                            <button
                                key={project.id}
                                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left dark:border-slate-700 dark:bg-slate-800"
                                onClick={() => navigate(`/projects/${project.id}`)}
                                type="button"
                            >
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
                                <span className="flex-1 text-sm font-medium text-slate-900 dark:text-white">{project.title}</span>
                                <FolderKanban className="h-4 w-4 text-slate-400" />
                            </button>
                        ))}
                    </div>
                </Panel>
            </div>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    highlight,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    highlight?: boolean;
}) {
    return (
        <article className={`rounded-3xl border p-5 shadow-sm ${highlight ? 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                <span className={`rounded-2xl p-2 ${highlight ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'}`}>
                    {icon}
                </span>
            </div>
            <p className={`mt-4 text-3xl font-semibold ${highlight ? 'text-red-600 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>{value}</p>
        </article>
    );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
            {children}
        </section>
    );
}

function centerLabelPlugin(totalTasks: number) {
    return {
        id: 'centerLabel',
        afterDraw(chart: any) {
            const { ctx, chartArea } = chart;
            if (!chartArea) return;
            const centerX = (chartArea.left + chartArea.right) / 2;
            const centerY = (chartArea.top + chartArea.bottom) / 2;

            ctx.save();
            ctx.font = '600 28px Inter, sans-serif';
            ctx.fillStyle = 'rgb(15, 23, 42)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(totalTasks), centerX, centerY - 6);
            ctx.font = '500 12px Inter, sans-serif';
            ctx.fillStyle = 'rgb(100, 116, 139)';
            ctx.fillText('Total tasks', centerX, centerY + 18);
            ctx.restore();
        },
    };
}

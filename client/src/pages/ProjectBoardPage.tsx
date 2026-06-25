import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock3, MoreHorizontal, Pause, Play, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useKanbanBoard, type BoardTask, type TaskStatus } from '../hooks/useKanbanBoard';
import { useProjects } from '../hooks/useProjects';
import { useSocket } from '../hooks/useSocket';
import { useTaskTimer, formatDuration } from '../hooks/useTaskTimer';

type ColumnConfig = {
    status: TaskStatus;
    title: string;
    dot: string;
};

const columns: ColumnConfig[] = [
    { status: 'todo', title: 'To Do', dot: 'bg-slate-400' },
    { status: 'in-progress', title: 'In Progress', dot: 'bg-blue-400' },
    { status: 'done', title: 'Done', dot: 'bg-emerald-400' },
];

function formatTimer(seconds: number) {
    return formatDuration(seconds);
}

function priorityBorder(priority: BoardTask['priority']) {
    if (priority === 'low') return 'border-l-emerald-500';
    if (priority === 'medium') return 'border-l-yellow-400';
    if (priority === 'high') return 'border-l-orange-500';
    return 'border-l-red-500';
}

function priorityBadge(priority: BoardTask['priority']) {
    return priority.toUpperCase();
}

export function ProjectBoardPage() {
    const { id } = useParams();
    const { tasks, setTasks, moveTask, updateTask, insertTask, removeTask, applyOptimisticUpdate } = useKanbanBoard(id);
    const { accessToken, user } = useAuth();
    const { projects } = useProjects();
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const currentProject = projects.find((project) => project.id === id) ?? projects[0];

    const { socket, connected, onlineUsers } = useSocket({
        projectId: id,
        accessToken,
        onTaskMoved: (payload) => moveTask(payload.taskId, payload.status, payload.position),
        onTaskCreated: (task) => insertTask(task, true),
        onTaskUpdated: (task) => updateTask(task.id, (current) => ({ ...current, ...task })),
        onTaskDeleted: (taskId) => removeTask(taskId),
        onTimerTick: (payload) =>
            updateTask(payload.taskId, (current) => ({
                ...current,
                timerSeconds: payload.timerSeconds,
                timerRunning: true,
                startedAt: payload.startedAt,
            })),
        onPresenceChange: () => undefined,
    });

    const activeTask = activeTaskId ? tasks.find((task) => task.id === activeTaskId) ?? null : null;

    const groupedTasks = useMemo(() => {
        return columns.reduce<Record<TaskStatus, BoardTask[]>>(
            (accumulator, column) => {
                accumulator[column.status] = tasks.filter((task) => task.status === column.status);
                return accumulator;
            },
            { todo: [], 'in-progress': [], done: [] }
        );
    }, [tasks]);

    const handleDragEnd = async (result: DropResult) => {
        const { destination, draggableId } = result;

        if (!destination) {
            return;
        }

        const task = tasks.find((entry) => entry.id === draggableId);

        if (!task) {
            return;
        }

        const nextStatus = destination.droppableId as TaskStatus;
        const nextIndex = destination.index;
        const nextTasks = tasks.filter((entry) => entry.id !== draggableId);
        const nextTask = { ...task, status: nextStatus, updatedAt: new Date().toISOString() };

        const targetIndices = nextTasks
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => entry.status === nextStatus);
        const insertionPoint =
            nextIndex >= targetIndices.length ? nextTasks.length : targetIndices[nextIndex].index;

        nextTasks.splice(insertionPoint, 0, nextTask);
        setTasks(nextTasks);

        try {
            await fetch(`/api/tasks/${draggableId}/move`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus, position: nextIndex }),
            });
            socket.emit('task:moved', { projectId: id, taskId: draggableId, status: nextStatus, position: nextIndex });
        } catch {
            setTasks(previousTasks);
        }
    };

    const handleAddTask = (status: TaskStatus) => {
        const newTask: BoardTask = {
            id: `task-${crypto.randomUUID()}`,
            boardId: id ?? 'proj-1',
            title: 'New task',
            description: '',
            status,
            priority: 'medium',
            tags: ['New'],
            assigneeName: user?.name ?? 'Unassigned',
            assigneeAvatarUrl: '',
            dueDate: new Date().toISOString().slice(0, 10),
            timerSeconds: 0,
            timerRunning: false,
            startedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        setTasks((current) => [newTask, ...current]);
        setActiveTaskId(newTask.id);
        socket.emit('task:created', { projectId: id, task: newTask });
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            {connected ? 'Live' : 'Offline'}
                        </span>
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{currentProject?.title ?? 'Project board'}</h2>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                        {onlineUsers.slice(0, 4).map((person) => (
                            <div
                                key={person.socketId}
                                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[11px] font-semibold text-slate-700 dark:border-slate-900 dark:bg-slate-700 dark:text-white"
                                title={person.name}
                            >
                                {person.avatarUrl ? (
                                    <img alt={person.name} className="h-full w-full rounded-full object-cover" src={person.avatarUrl} />
                                ) : (
                                    person.name.slice(0, 1)
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                        <p>{onlineUsers.length} online</p>
                        <p>{user?.name ?? 'You'}</p>
                    </div>
                </div>
            </header>

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="grid gap-4 xl:grid-cols-3">
                    {columns.map((column) => {
                        const columnTasks = groupedTasks[column.status];

                        return (
                            <section
                                key={column.status}
                                className="flex min-h-[calc(100vh-10rem)] flex-col rounded-3xl border border-slate-200 bg-slate-100/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
                            >
                                <header className="flex items-center justify-between gap-3 pb-4">
                                    <div className="flex items-center gap-3">
                                        <span className={`h-3 w-3 rounded-full ${column.dot}`} />
                                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
                                            {column.title}
                                        </h2>
                                    </div>
                                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        {columnTasks.length}
                                    </span>
                                </header>

                                <Droppable droppableId={column.status}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={`flex-1 rounded-2xl border border-transparent p-1 transition-colors ${
                                                snapshot.isDraggingOver
                                                    ? 'border-blue-400 bg-blue-500/10 ring-2 ring-blue-400/40'
                                                    : ''
                                            }`}
                                        >
                                            <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                                                {columnTasks.map((task, index) => (
                                                    <Draggable key={task.id} draggableId={task.id} index={index}>
                                                        {(dragProvided, dragSnapshot) => (
                                                            <TaskCard
                                                                task={task}
                                                                dragProvided={dragProvided}
                                                                isDragging={dragSnapshot.isDragging}
                                                                onOpen={() => setActiveTaskId(task.id)}
                                                                socket={socket}
                                                                applyOptimisticUpdate={applyOptimisticUpdate}
                                                            />
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        </div>
                                    )}
                                </Droppable>

                                <button
                                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-800/80"
                                    onClick={() => handleAddTask(column.status)}
                                    type="button"
                                >
                                    <Plus size={16} />
                                    Add task
                                </button>
                            </section>
                        );
                    })}
                </div>
            </DragDropContext>

            <TaskDetailModal
                task={activeTask}
                onClose={() => setActiveTaskId(null)}
                onDelete={(taskId) => {
                    setTasks((current) => current.filter((task) => task.id !== taskId));
                    socket.emit('task:deleted', { projectId: id, taskId });
                    setActiveTaskId(null);
                }}
                onUpdate={(taskId, updater) => updateTask(taskId, updater)}
                socket={socket}
                applyOptimisticUpdate={applyOptimisticUpdate}
            />
        </div>
    );
}

function TaskCard({
    task,
    dragProvided,
    isDragging,
    onOpen,
    socket,
    applyOptimisticUpdate,
}: {
    task: BoardTask;
    dragProvided: any;
    isDragging: boolean;
    onOpen: () => void;
    socket: ReturnType<typeof useSocket>['socket'];
    applyOptimisticUpdate: ReturnType<typeof useKanbanBoard>['applyOptimisticUpdate'];
}) {
    const timer = useTaskTimer({ task, socket, applyOptimisticUpdate });

    return (
        <motion.article
            ref={dragProvided.innerRef}
            {...dragProvided.draggableProps}
            {...dragProvided.dragHandleProps}
            layout
            initial={false}
            animate={{ scale: isDragging ? 1.03 : 1, y: isDragging ? -4 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className={`cursor-grab rounded-xl border-l-4 ${priorityBorder(task.priority)} bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:bg-slate-800 ${
                isDragging ? 'shadow-2xl ring-2 ring-blue-400/60' : ''
            }`}
            onClick={onOpen}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {priorityBadge(task.priority)}
                    </p>
                    <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-900 dark:text-slate-50">
                        {task.title}
                    </h3>
                </div>
                <button
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-white"
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpen();
                    }}
                    type="button"
                >
                    <MoreHorizontal size={16} />
                </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {task.tags.map((tag) => (
                    <span
                        key={tag}
                        className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                    >
                        {tag}
                    </span>
                ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-300">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                        {task.assigneeName?.slice(0, 1) ?? 'U'}
                    </div>
                    <div>
                        <p className="font-medium text-slate-700 dark:text-slate-100">{task.assigneeName ?? 'Unassigned'}</p>
                        <p className="flex items-center gap-1">
                            <Clock3 size={12} />
                            {task.dueDate ? format(new Date(task.dueDate), 'MMM d') : 'No due date'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-700/80">
                    <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-100">
                        {timer.formatted}
                    </span>
                    <button
                        className="rounded-full bg-blue-500 p-1 text-white transition hover:bg-blue-600"
                        onClick={(event) => {
                            event.stopPropagation();
                            if (timer.isRunning) {
                                void timer.stop();
                            } else {
                                void timer.start();
                            }
                        }}
                        type="button"
                    >
                        {timer.isRunning ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                </div>
            </div>
        </motion.article>
    );
}

function TaskDetailModal({
    task,
    onClose,
    onDelete,
    onUpdate,
    socket,
    applyOptimisticUpdate,
}: {
    task: BoardTask | null;
    onClose: () => void;
    onDelete: (taskId: string) => void;
    onUpdate: (taskId: string, updater: (task: BoardTask) => BoardTask) => void;
    socket: ReturnType<typeof useSocket>['socket'];
    applyOptimisticUpdate: ReturnType<typeof useKanbanBoard>['applyOptimisticUpdate'];
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);

    if (!task) {
        return null;
    }

    const timer = useTaskTimer({ task, socket, applyOptimisticUpdate });

    const addTag = (value: string) => {
        const nextTag = value.trim();
        if (!nextTag) {
            return;
        }

        onUpdate(task.id, (current) => ({
            ...current,
            tags: current.tags.includes(nextTag) ? current.tags : [...current.tags, nextTag],
        }));
    };

    return (
        <AnimatePresence>
            <motion.div className="fixed inset-0 z-40 flex justify-end bg-slate-950/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button aria-label="Close task modal" className="flex-1" onClick={onClose} type="button" />
                <motion.aside
                    initial={{ x: 420 }}
                    animate={{ x: 0 }}
                    exit={{ x: 420 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                    className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                >
                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-blue-500">Task details</p>
                            {isEditingTitle ? (
                                <input
                                    autoFocus
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-2xl font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                    defaultValue={task.title}
                                    onBlur={(event) => {
                                        const nextTitle = event.currentTarget.value.trim();
                                        if (nextTitle) {
                                            onUpdate(task.id, (current) => ({ ...current, title: nextTitle }));
                                        }
                                        setIsEditingTitle(false);
                                    }}
                                />
                            ) : (
                                <button
                                    className="mt-2 text-left text-2xl font-semibold text-slate-900 dark:text-white"
                                    onClick={() => setIsEditingTitle(true)}
                                    type="button"
                                >
                                    {task.title}
                                </button>
                            )}
                        </div>
                        <button
                            aria-label="Close"
                            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                            onClick={onClose}
                            type="button"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                        <section className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                Description
                            </label>
                            <textarea
                                className="min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                defaultValue={task.description}
                                onBlur={(event) =>
                                    onUpdate(task.id, (current) => ({ ...current, description: event.currentTarget.value }))
                                }
                                placeholder="Add a description..."
                            />
                        </section>

                        <div className="grid gap-4 md:grid-cols-3">
                            <select
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                defaultValue={task.priority}
                                onChange={(event) =>
                                    onUpdate(task.id, (current) => ({ ...current, priority: event.currentTarget.value as BoardTask['priority'] }))
                                }
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>

                            <input
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                defaultValue={task.assigneeName}
                                placeholder="Assignee"
                                onBlur={(event) =>
                                    onUpdate(task.id, (current) => ({ ...current, assigneeName: event.currentTarget.value }))
                                }
                            />

                            <input
                                type="date"
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                defaultValue={task.dueDate}
                                onChange={(event) =>
                                    onUpdate(task.id, (current) => ({ ...current, dueDate: event.currentTarget.value }))
                                }
                            />
                        </div>

                        <section className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                    Tags
                                </label>
                                <TagAdder onAdd={addTag} />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {task.tags.map((tag) => (
                                    <button
                                        key={tag}
                                        className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                                        onClick={() =>
                                            onUpdate(task.id, (current) => ({
                                                ...current,
                                                tags: current.tags.filter((entry) => entry !== tag),
                                            }))
                                        }
                                        type="button"
                                    >
                                        {tag}
                                        <X size={12} />
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Timer</p>
                                    <p className="mt-1 font-mono text-3xl font-semibold text-slate-900 dark:text-white">
                                                {timer.formatted}
                                    </p>
                                </div>
                                        <button
                                            className="rounded-full bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
                                            onClick={() => (timer.isRunning ? void timer.stop() : void timer.start())}
                                            type="button"
                                        >
                                            {timer.isRunning ? 'Stop' : 'Start'}
                                </button>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Total time logged: {Math.floor(task.timerSeconds / 60)}m {task.timerSeconds % 60}s
                            </p>
                        </section>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-700">
                        <button
                            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                            onClick={() => setConfirmDelete(true)}
                            type="button"
                        >
                            Delete
                        </button>
                        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900" onClick={onClose} type="button">
                            Close
                        </button>
                    </div>

                    {confirmDelete && (
                        <div className="absolute inset-0 grid place-items-center bg-slate-950/60 p-6">
                            <div className="w-full rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Delete this task?</p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
                                <div className="mt-4 flex justify-end gap-3">
                                    <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm" onClick={() => setConfirmDelete(false)} type="button">
                                        Cancel
                                    </button>
                                    <button className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white" onClick={() => onDelete(task.id)} type="button">
                                        Delete task
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.aside>
            </motion.div>
        </AnimatePresence>
    );
}

function TagAdder({ onAdd }: { onAdd: (value: string) => void }) {
    return (
        <button
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400"
            onClick={() => {
                const nextTag = window.prompt('Add tag');
                if (nextTag) {
                    onAdd(nextTag);
                }
            }}
            type="button"
        >
            <Plus size={12} />
            Add tag
        </button>
    );
}

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api, wsUrl } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import { ConfirmDialog, Lightbox, useModalBehavior } from '../components/Dialogs';
import { TaskMap } from '../components/TaskMap';
import CreateTaskModal from '../components/CreateTaskModal';
import ProBadge from '../ui/ProBadge';
import { CATEGORIES, CITIES, getCategoryLabel } from '../lib/constants';
import { safeUserId } from '../lib/utils';
import { inputCls, labelCls, btnPrimary, btnGhost, btnSignal, modalOverlay, modalPanel, chipCls } from '../lib/styles';
import deloArt from '../assets/delo_art.jpg';

const Feed = () => {
    const { token, role } = useAuthStore();
    const toast = useToast();
    const [selectedTask, setSelectedTask] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Filters
    const [categoryFilter, setCategoryFilter] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [cityInput, setCityInput] = useState('');   // то, что печатает пользователь
    const [cityFilter, setCityFilter] = useState(''); // применяемое к запросу (с задержкой)
    const [cityOptions, setCityOptions] = useState(CITIES); // статичный список + города из задач
    const [remoteOnly, setRemoteOnly] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
    const [sortBy, setSortBy] = useState('new');
    const [statusFilter, setStatusFilter] = useState('');

    // Новые фильтры
    const [budgetMin, setBudgetMin] = useState('');
    const [budgetMax, setBudgetMax] = useState('');
    const [deadlineDays, setDeadlineDays] = useState('');
    const [newOnly, setNewOnly] = useState(false);
    const [hasResponses, setHasResponses] = useState(null); // null | true | false
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [connError, setConnError] = useState(false);
    const [total, setTotal] = useState(0);
    const [unread, setUnread] = useState({ total: 0, by_task: {} });
    const [lightbox, setLightbox] = useState(null); // { images: [], index: n }
    const [confirmingComplete, setConfirmingComplete] = useState(false);

    // Esc-закрытие модалок ленты
    const responseRef = useModalBehavior(() => { if (selectedTask) { setSelectedTask(null); setResponseText(''); setProposedPrice(''); setEstimatedDays(''); } });
    const responsesRef = useModalBehavior(() => setViewingResponsesTask(null));
    const chatRef = useModalBehavior(() => {
        setChatTask(null);
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    });
    const reviewRef = useModalBehavior(() => setReviewingTask(null));

    // For specialists applying
    const [responseText, setResponseText] = useState('');
    const [proposedPrice, setProposedPrice] = useState('');
    const [estimatedDays, setEstimatedDays] = useState('');

    // For customers viewing responses
    const [viewingResponsesTask, setViewingResponsesTask] = useState(null);
    const [taskResponses, setTaskResponses] = useState([]);

    // For Task Workspace (Chat)
    const [chatTask, setChatTask] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const wsRef = useRef(null);

    // For Reviews
    const [reviewingTask, setReviewingTask] = useState(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewHover, setReviewHover] = useState(0);
    const [reviewComment, setReviewComment] = useState('');

    const PAGE_SIZE = 12;

    const buildTaskParams = (offset) => {
        const params = new URLSearchParams();
        if (categoryFilter) params.append('category', categoryFilter);
        if (searchQuery) params.append('search', searchQuery);
        if (cityFilter) params.append('city', cityFilter);
        if (remoteOnly) params.append('is_remote', 'true');
        if (statusFilter) params.append('status', statusFilter);

        // Новые фильтры
        if (budgetMin) params.append('budget_min', budgetMin);
        if (budgetMax) params.append('budget_max', budgetMax);
        if (deadlineDays) params.append('deadline_days', deadlineDays);
        if (newOnly) params.append('new_only', 'true');
        if (hasResponses !== null) params.append('has_responses', hasResponses ? 'true' : 'false');

        params.append('sort', sortBy);
        params.append('limit', String(PAGE_SIZE));
        params.append('offset', String(offset));
        return params;
    };

    const fetchTasks = () => {
        setLoading(true);
        api.get(`/tasks/?${buildTaskParams(0).toString()}`)
            .then(res => {
                setTasks(res.data);
                setTotal(parseInt(res.headers['x-total-count'] || res.data.length, 10));
                setConnError(false);
            })
            .catch(err => {
                console.error("Error fetching tasks:", err);
                if (!err.response) setConnError(true);
            })
            .finally(() => setLoading(false));
    };

    const loadMoreTasks = () => {
        setLoadingMore(true);
        api.get(`/tasks/?${buildTaskParams(tasks.length).toString()}`)
            .then(res => {
                setTasks(prev => [...prev, ...res.data]);
                // Если заголовка нет — не занижаем total (иначе кнопка «ещё» пропадёт раньше времени)
                const header = res.headers['x-total-count'];
                if (header != null) {
                    setTotal(parseInt(header, 10));
                } else {
                    setTotal(prev => Math.max(prev, tasks.length + res.data.length));
                }
            })
            .catch(err => console.error("Error loading more tasks:", err))
            .finally(() => setLoadingMore(false));
    };

    const fetchUnread = () => {
        if (!token) return;
        api.get('/chats/unread')
            .then(res => setUnread(res.data))
            .catch(() => {});
    };

    // Debounce the search box so typing doesn't hit the API on every keystroke
    useEffect(() => {
        const t = setTimeout(() => setSearchQuery(searchInput), 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    // То же для города: применяем фильтр с задержкой, чтобы не дёргать API на каждую букву
    useEffect(() => {
        const t = setTimeout(() => setCityFilter(cityInput.trim()), 400);
        return () => clearTimeout(t);
    }, [cityInput]);

    useEffect(() => {
        fetchTasks();
    }, [categoryFilter, searchQuery, cityFilter, remoteOnly, statusFilter, sortBy, budgetMin, budgetMax, deadlineDays, newOnly, hasResponses]);

    // Подтягиваем счётчики непрочитанного при входе в ленту и после закрытия чата
    useEffect(() => {
        fetchUnread();
    }, [token]);

    // Города для фильтра: статичный список + реально используемые (в т.ч. введённые вручную)
    useEffect(() => {
        api.get('/tasks/cities')
            .then(res => {
                const merged = Array.from(new Set([...CITIES, ...(res.data.cities || [])])).sort((a, b) => a.localeCompare(b, 'ru'));
                setCityOptions(merged);
            })
            .catch(() => {});
    }, []);

    // Живой бейдж: периодически обновляем счётчики, пока чат закрыт и вкладка активна
    useEffect(() => {
        if (!token) return;
        const id = setInterval(() => {
            if (!chatTask && document.visibilityState === 'visible') fetchUnread();
        }, 30000);
        return () => clearInterval(id);
    }, [token, chatTask]);

    const fetchMessages = async (taskId) => {
        try {
            const res = await api.get(`/tasks/${taskId}/messages`);
            setMessages(res.data);
        } catch (err) {
            console.error("Failed to load messages:", err);
        }
    };

    // Load initial messages and establish WebSocket connection when chat is opened
    useEffect(() => {
        if (!chatTask) return;

        // Initial load of history
        fetchMessages(chatTask.id);

        // Construct WebSocket URL (token goes in the first message, not the URL)
        const ws = new WebSocket(wsUrl(`/ws/tasks/${chatTask.id}`));
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'auth', token }));
        };

        ws.onmessage = (event) => {
            const incomingMessage = JSON.parse(event.data);
            // Deduplicate if we somehow received it through API and WS simultaneously
            setMessages(prev => {
                if (prev.find(m => m.id === incomingMessage.id)) return prev;
                return [...prev, incomingMessage];
            });
            // Чат открыт — сразу помечаем прочитанным на сервере
            api.post(`/tasks/${chatTask.id}/chat/read`, {}).catch(() => {});
        };

        ws.onclose = () => console.log("WebSocket disconnected");

        // Открытие чата: локально гасим бейдж и обновляем счётчики с сервера
        setUnread(prev => {
            const by = { ...prev.by_task };
            const removed = by[chatTask.id] || 0;
            delete by[chatTask.id];
            return { total: Math.max(0, prev.total - removed), by_task: by };
        });

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            fetchUnread();
        };
    }, [chatTask, token]);

    const handleSendResponse = async () => {
        if (!responseText.trim()) return;
        try {
            const res = await api.post(`/tasks/${selectedTask.id}/responses`,
                {
                    text: responseText,
                    proposed_price: proposedPrice ? parseInt(proposedPrice) : null,
                    estimated_days: estimatedDays ? parseInt(estimatedDays) : null
                }
            );
            toast.success('Ваш отклик успешно отправлен заказчику!' + (res.data && res.data.credits_left !== null && res.data.credits_left !== undefined ? ` Осталось откликов: ${res.data.credits_left}` : ''));
            setSelectedTask(null);
            setResponseText('');
            setProposedPrice('');
            setEstimatedDays('');
        } catch (err) {
            toast.error('Ошибка отправки отклика. Вы авторизованы?');
        }
    };

    const loadResponses = async (task_id) => {
        try {
            const res = await api.get(`/tasks/${task_id}/responses`);
            setTaskResponses(res.data);
            setViewingResponsesTask(task_id);
        } catch (err) {
            toast.error('Не удалось загрузить отклики.');
        }
    };

    const handleAssign = async (taskId, specialistId) => {
        try {
            await api.put(`/tasks/${taskId}/assign?specialist_id=${specialistId}`, {});
            toast.success('Исполнитель назначен! Средства зарезервированы.');
            setViewingResponsesTask(null);
            fetchTasks(); // refresh task list to see status change
        } catch (err) {
            if (err.response?.status === 400 && err.response?.data?.detail === 'Недостаточно средств для безопасной сделки') {
                toast.error('Недостаточно средств для безопасной сделки. Пополните баланс в профиле.');
            } else {
                toast.error('Ошибка назначения исполнителя.');
            }
        }
    };

    const handleCompleteTask = async (taskId) => {
        try {
            await api.put(`/tasks/${taskId}/complete`, {});
            toast.success('Заказ завершен! Пожалуйста, оставьте отзыв.');
            setReviewingTask(chatTask);
            setChatTask(null);
            fetchTasks(); // refresh task list
        } catch (err) {
            toast.error('Ошибка завершения заказа.');
        }
    };

    const handleSubmitReview = async () => {
        try {
            await api.post(`/tasks/${reviewingTask.id}/review`, {
                rating: reviewRating,
                comment: reviewComment
            });
            toast.success('Спасибо за ваш отзыв!');
            setReviewingTask(null);
            setReviewRating(5);
            setReviewHover(0);
            setReviewComment('');
            fetchTasks();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Ошибка отправки отзыва.');
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        try {
            await api.post(`/tasks/${chatTask.id}/messages`,
                { text: newMessage }
            );
            setNewMessage('');
            // We no longer need to fetchMessages() manually, the WebSocket will push the new message to us (and everyone else).
        } catch (err) {
            toast.error('Ошибка отправки сообщения.');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'open': return <span className="rounded-full border border-border bg-surface-2 text-ink text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5">Открыт</span>;
            case 'in_progress': return <span className="rounded-full bg-accent/20 text-accent-bright border border-accent/40 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5">В работе</span>;
            case 'completed': return <span className="rounded-full bg-success/15 text-success border border-success/30 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5">Завершён</span>;
            default: return null;
        }
    };

    return (
        <div>
            {/* HERO */}
            <section className="dot-grid border-b border-border">
                <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-16 text-center">
                    <span className="inline-block bg-surface border border-border rounded-full font-display text-[10px] uppercase tracking-[0.2em] px-3.5 py-1.5 text-muted">Маркетплейс услуг</span>
                    <h1 className="font-display font-extrabold uppercase leading-[0.95] tracking-tight text-[56px] sm:text-[96px] md:text-[136px] mt-6 text-center text-ink">
                        ДЕЛО
                    </h1>
                    <p className="mt-5 text-muted font-semibold max-w-md mx-auto">
                        Найди своего специалиста: 12 категорий · отклики за минуты · безопасная сделка с резервированием средств.
                    </p>

                    <form className="mt-8 flex max-w-lg mx-auto rounded-2xl overflow-hidden border border-border bg-surface-2 focus-within:border-accent/60 transition" onSubmit={e => { e.preventDefault(); document.getElementById('feed')?.scrollIntoView({ behavior: 'smooth' }); }}>
                        <input
                            type="text"
                            placeholder="Что нужно сделать?"
                            className="flex-1 min-w-0 bg-transparent p-3 md:p-4 font-medium outline-none placeholder-muted/60"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                        <button type="submit" className="bg-accent hover:bg-accent-bright text-white px-5 md:px-8 font-display text-[11px] uppercase tracking-wider transition">
                            Найти
                        </button>
                    </form>

                    {/* Категории — прокручиваемые на мобиле, все видимые на десктопе */}
                    <div className="mt-5 flex flex-wrap gap-2 justify-center max-w-4xl mx-auto">
                        <button
                            onClick={() => setCategoryFilter('')}
                            className={`${chipCls(categoryFilter === '')} flex items-center gap-1.5 whitespace-nowrap`}
                        >
                            <span className="text-base">✨</span>
                            <span className="font-bold text-xs uppercase tracking-wide">ВСЕ</span>
                        </button>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.value}
                                onClick={() => setCategoryFilter(cat.value)}
                                className={`${chipCls(categoryFilter === cat.value)} flex items-center gap-1.5 whitespace-nowrap`}
                            >
                                <span className="text-base">{cat.label.split(' ')[0]}</span>
                                <span className="font-bold text-xs uppercase tracking-wide hidden sm:inline">{cat.label.split(' ').slice(1).join(' ')}</span>
                            </button>
                        ))}
                    </div>

                    <div className="mt-8 md:mt-10">
                        <img src={deloArt} alt="Фирменный арт ДЕЛО" className="w-full max-w-[260px] md:max-w-[320px] mx-auto aspect-square object-cover rounded-2xl border border-border shadow-card" />
                    </div>
                </div>
            </section>

            {/* FILTERS — адаптивная сетка */}
            <section className="border-b border-border bg-surface/60 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-4 md:px-8 py-5">
                    {/* Основные фильтры — 2 колонки на мобиле, 3-4 на десктопе */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                        <select
                            className="h-[50px] w-full rounded-xl border border-border bg-surface-2 text-ink px-3 text-sm font-semibold outline-none focus:border-accent transition cursor-pointer"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="">Все категории</option>
                            {CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>

                        <div className="relative">
                            <input
                                type="text"
                                list="feed-city-options"
                                placeholder="Город"
                                className="h-[50px] w-full rounded-xl border border-border bg-surface-2 text-ink px-3 pr-8 text-sm font-semibold outline-none focus:border-accent transition"
                                value={cityInput}
                                onChange={(e) => setCityInput(e.target.value)}
                            />
                            <datalist id="feed-city-options">
                                {cityOptions.map(c => (
                                    <option key={c} value={c} />
                                ))}
                            </datalist>
                            {cityInput && (
                                <button
                                    type="button"
                                    onClick={() => { setCityInput(''); setCityFilter(''); }}
                                    title="Сбросить город"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink font-bold text-lg leading-none"
                                >×</button>
                            )}
                        </div>

                        <select
                            className="h-[50px] w-full rounded-xl border border-border bg-surface-2 text-ink px-3 text-sm font-semibold outline-none focus:border-accent transition cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">Все статусы</option>
                            <option value="open">Открытые</option>
                            <option value="in_progress">В работе</option>
                            <option value="completed">Завершённые</option>
                        </select>

                        <select
                            className="h-[50px] w-full rounded-xl border border-border bg-surface-2 text-ink px-3 text-sm font-semibold outline-none focus:border-accent transition cursor-pointer"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="new">Сначала новые</option>
                            <option value="old">Сначала старые</option>
                            <option value="budget_desc">Бюджет ↓</option>
                            <option value="budget_asc">Бюджет ↑</option>
                        </select>
                    </div>

                    {/* Чекбокс и переключатели вида */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <label className="h-[42px] flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 cursor-pointer select-none transition hover:border-border-bright">
                            <input
                                type="checkbox"
                                checked={remoteOnly}
                                onChange={(e) => setRemoteOnly(e.target.checked)}
                                className="w-4 h-4 accent-accent"
                            />
                            <span className="font-semibold text-xs whitespace-nowrap">🌐 Удалённо</span>
                        </label>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`h-[42px] px-4 rounded-xl border font-semibold text-xs uppercase tracking-wide transition flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-accent text-white border-accent' : 'bg-surface-2 text-muted border-border hover:text-ink hover:border-border-bright'}`}
                            >
                                <span className="text-base">📋</span>
                                <span className="hidden sm:inline">Список</span>
                            </button>
                            <button
                                onClick={() => setViewMode('map')}
                                className={`h-[42px] px-4 rounded-xl border font-semibold text-xs uppercase tracking-wide transition flex items-center gap-1.5 ${viewMode === 'map' ? 'bg-accent text-white border-accent' : 'bg-surface-2 text-muted border-border hover:text-ink hover:border-border-bright'}`}
                            >
                                <span className="text-base">🗺️</span>
                                <span className="hidden sm:inline">Карта</span>
                            </button>
                        </div>
                    </div>

                    {/* Кнопка "Больше фильтров" */}
                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className="h-[42px] px-4 rounded-xl border border-border bg-surface-2 text-ink text-sm font-semibold transition hover:border-accent hover:text-accent"
                    >
                        {showAdvancedFilters ? '▲ Скрыть фильтры' : '▼ Больше фильтров'}
                    </button>

                    {/* Расширенные фильтры */}
                    {showAdvancedFilters && (
                        <div className="mt-4 p-4 rounded-xl border border-border bg-surface-2/50 grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-muted mb-2">Бюджет от</label>
                                <input
                                    type="number"
                                    placeholder="мин. ₽"
                                    value={budgetMin}
                                    onChange={(e) => setBudgetMin(e.target.value)}
                                    className="w-full h-[44px] rounded-xl border border-border bg-surface text-ink px-3 font-semibold outline-none focus:border-accent transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-muted mb-2">Бюджет до</label>
                                <input
                                    type="number"
                                    placeholder="макс. ₽"
                                    value={budgetMax}
                                    onChange={(e) => setBudgetMax(e.target.value)}
                                    className="w-full h-[44px] rounded-xl border border-border bg-surface text-ink px-3 font-semibold outline-none focus:border-accent transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-muted mb-2">Дедлайн (дней)</label>
                                <input
                                    type="number"
                                    placeholder="задачи на N дней"
                                    value={deadlineDays}
                                    onChange={(e) => setDeadlineDays(e.target.value)}
                                    className="w-full h-[44px] rounded-xl border border-border bg-surface text-ink px-3 font-semibold outline-none focus:border-accent transition"
                                />
                            </div>
                            <div className="flex flex-col gap-3">
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={newOnly}
                                        onChange={(e) => setNewOnly(e.target.checked)}
                                        className="w-5 h-5 accent-accent"
                                    />
                                    <span className="font-bold text-sm">🔥 Только новые (24 часа)</span>
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setHasResponses(null)}
                                        className={`flex-1 h-[38px] rounded-xl border font-semibold text-xs transition ${hasResponses === null ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border hover:border-accent'}`}
                                    >
                                        Все
                                    </button>
                                    <button
                                        onClick={() => setHasResponses(true)}
                                        className={`flex-1 h-[38px] rounded-xl border font-semibold text-xs transition ${hasResponses === true ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border hover:border-accent'}`}
                                    >
                                        С откликами
                                    </button>
                                    <button
                                        onClick={() => setHasResponses(false)}
                                        className={`flex-1 h-[38px] rounded-xl border font-semibold text-xs transition ${hasResponses === false ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border hover:border-accent'}`}
                                    >
                                        Без откликов
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* TASKS */}
            <section id="feed" className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-10 scroll-mt-16">
                <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                    <h2 className="font-display font-bold uppercase text-xl md:text-2xl flex items-center gap-3">
                        Лента заказов
                        <span className="rounded-full bg-surface-2 border border-border text-muted text-xs font-bold px-2.5 py-0.5">{total}</span>
                    </h2>
                    {role === 'customer' && (
                        <button onClick={() => setShowCreateModal(true)} className={btnPrimary}>+ Создать заказ</button>
                    )}
                </div>

                {viewMode === 'map' ? (
                    <div className="rounded-2xl border border-border overflow-hidden h-[600px]">
                        <TaskMap
                            tasks={tasks}
                            city={cityFilter}
                            onTaskClick={(taskId) => {
                                const task = tasks.find(t => t.id === taskId);
                                if (task && role === 'specialist' && task.status === 'open') {
                                    setSelectedTask(task);
                                }
                            }}
                        />
                    </div>
                ) : (
 <div className="grid md:grid-cols-2 gap-5">
 {loading ? (
 Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="bg-surface border border-border rounded-2xl p-5 flex flex-col animate-pulse">
 <div className="flex gap-3 mb-3"><div className="bg-surface-2 h-6 w-24 rounded-full" /><div className="bg-surface-2 h-6 w-16 rounded-full" /></div>
 <div className="bg-surface-2 h-6 w-3/4 rounded mb-2" /><div className="bg-surface-2 h-4 w-1/3 rounded mb-4" />
 <div className="flex-1 bg-surface-2 h-4 rounded mb-1" /><div className="bg-surface-2 h-4 w-2/3 rounded mb-4" />
 <div className="border-t border-border pt-4 flex justify-between"><div className="bg-surface-2 h-6 w-20 rounded" /><div className="bg-surface-2 h-9 w-32 rounded-xl" /></div>
 </div>
 ))
 ) : connError ? (
 <div className="md:col-span-2 rounded-2xl border border-danger/40 bg-danger/5 py-14 text-center">
 <div className="font-display font-bold uppercase text-2xl text-danger">Нет соединения</div>
 <p className="text-muted mt-2 font-semibold">Сервер не отвечает. Проверьте, запущен ли бэкенд.</p>
 <button onClick={fetchTasks} className={`${btnGhost} mt-5`}>Повторить</button>
 </div>
 ) : tasks.length === 0 ? (
                            <div className="md:col-span-2 rounded-2xl border border-dashed border-border-bright/60 dot-grid py-16 text-center">
                                <div className="font-display font-bold uppercase text-2xl">Пока пусто</div>
                                <p className="text-muted mt-2 font-semibold">Заказов по этим фильтрам не найдено — попробуйте изменить условия.</p>
                            </div>
                        ) : (
                            tasks.map(t => (
                                <article key={t.id} className="bg-surface border border-border rounded-2xl p-5 flex flex-col transition duration-150 hover:border-accent/50 hover:shadow-card">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="rounded-full bg-surface-2 border border-border text-ink text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 truncate">{getCategoryLabel(t.category)}</span>
                                        {getStatusBadge(t.status)}
                                    </div>
                                    <h3 className="font-extrabold text-lg leading-snug mt-3 break-words">
                                        <Link to={`/task/${t.id}`} className="hover:text-accent-bright transition">{t.title}</Link>
                                    </h3>
                                    <div className="flex gap-4 mt-2 text-[11px] font-bold uppercase tracking-wide text-muted flex-wrap">
                                        {t.is_remote ? (
                                            <span>🌐 Удалённо</span>
                                        ) : t.city && (
                                            <span className="truncate">📍 {t.city}{t.address && `, ${t.address}`}</span>
                                        )}
                                        {t.deadline && (
                                            <span>📅 До {new Date(t.deadline).toLocaleDateString('ru-RU')}</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted mt-3 mb-4 whitespace-pre-wrap break-words line-clamp-3 flex-grow">{t.description}</p>

                                    {/* Task images */}
 {t.images && (() => { try { return JSON.parse(t.images); } catch { return []; } })().length > 0 && (() => {
                                const imgs = (() => { try { return JSON.parse(t.images); } catch { return []; } })();
                                return (
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {imgs.map((img, idx) => (
                                        <img
                                            key={idx}
                                            src={img}
                                            alt={`${t.title} ${idx + 1}`}
                                            className="w-full h-20 object-cover rounded-lg border border-border cursor-pointer transition hover:border-accent/60"
                                            onClick={() => setLightbox({ images: imgs, index: idx })}
                                        />
                                    ))}
                                </div>
                                );
                            })()}

                                    <div className="flex justify-between items-center border-t border-border pt-4 gap-3 flex-wrap">
                                        <span className="font-display font-bold text-lg text-accent-bright">{t.budget} ₽</span>

                                        {role === 'specialist' && t.status === 'open' && (
                                            <button onClick={() => setSelectedTask(t)} className={btnPrimary}>Откликнуться</button>
                                        )}
                                        {role === 'specialist' && t.status === 'in_progress' && t.executor_id === safeUserId(token) && (
                                            <button onClick={() => setChatTask(t)} className={`${btnSignal} relative`}>
                                                Рабочая область
                                                {unread.by_task[t.id] > 0 && (
                                                    <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center">{unread.by_task[t.id]}</span>
                                                )}
                                            </button>
                                        )}
                                        {role === 'customer' && t.customer_id === safeUserId(token) && (
                                            <div className="flex gap-2 flex-wrap">
                                                {t.status === 'open' && (
                                                    <button onClick={() => loadResponses(t.id)} className={btnGhost}>Смотреть отклики</button>
                                                )}
                                                {t.status === 'in_progress' && (
                                                    <button onClick={() => setChatTask(t)} className={`${btnSignal} relative`}>
                                                        Перейти в чат
                                                        {unread.by_task[t.id] > 0 && (
                                                            <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center">{unread.by_task[t.id]}</span>
                                                        )}
                                                    </button>
                                                )}
                                                {t.status === 'completed' && (
                                                    <button onClick={() => setReviewingTask(t)} className={btnGhost}>★ Отзыв о специалисте</button>
                                                )}
                                            </div>
                                        )}
                                        {role === 'specialist' && t.status === 'completed' && t.executor_id === safeUserId(token) && (
                                            <button onClick={() => setReviewingTask(t)} className={btnGhost}>★ Отзыв о заказчике</button>
                                        )}
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                )}

                {!loading && !connError && viewMode === 'list' && tasks.length < total && (
                    <div className="mt-6 text-center">
                        <button onClick={loadMoreTasks} disabled={loadingMore} className={btnGhost}>
                            {loadingMore ? 'Загрузка…' : `Показать ещё · ${total - tasks.length}`}
                        </button>
                    </div>
                )}

                {/* Modal for Specialist to Write Response */}
                {selectedTask && (
                    <div className={modalOverlay}>
                        <div ref={responseRef} tabIndex={-1} className={`${modalPanel} w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto p-6 outline-none focus:ring-2 focus:ring-accent/50`}>
                            <h2 className="font-display font-bold uppercase text-lg leading-snug">Отклик: «{selectedTask.title}»</h2>
                            <textarea value={responseText} onChange={e => setResponseText(e.target.value)} className={`${inputCls} mt-5 mb-4`} rows="5" placeholder="Напишите сопроводительное письмо заказчику... Расскажите о вашем опыте."></textarea>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className={labelCls}>Ваша цена (₽)</label>
                                    <input type="number" value={proposedPrice} onChange={e => setProposedPrice(e.target.value)} placeholder={selectedTask.budget} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Срок (дней)</label>
                                    <input type="number" value={estimatedDays} onChange={e => setEstimatedDays(e.target.value)} placeholder="7" className={inputCls} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => { setSelectedTask(null); setResponseText(''); setProposedPrice(''); setEstimatedDays(''); }} className={btnGhost}>Отмена</button>
                                <button onClick={handleSendResponse} className={btnPrimary}>Отправить отклик</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal for Customer to View Responses */}
                {viewingResponsesTask && (
                    <div className={modalOverlay}>
                        <div ref={responsesRef} tabIndex={-1} className={`${modalPanel} w-full max-w-2xl max-h-[80vh] flex flex-col p-6 outline-none focus:ring-2 focus:ring-accent/50`}>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="font-display font-bold uppercase text-xl">Отклики исполнителей</h2>
                                <button onClick={() => setViewingResponsesTask(null)} className="w-9 h-9 rounded-lg bg-surface-2 border border-border font-extrabold flex items-center justify-center transition hover:border-border-bright">&times;</button>
                            </div>

                            <div className="overflow-y-auto pr-2 flex-grow">
                                {taskResponses.length === 0 ? (
                                    <div className="text-center py-12 rounded-xl border border-dashed border-border-bright/60">
                                        <div className="font-display font-bold uppercase text-lg">Тишина</div>
                                        <p className="text-muted mt-2 font-semibold">На этот заказ пока нет откликов.</p>
                                    </div>
                                ) : (
                                    taskResponses.map(r => (
                                        <div key={r.id} className="rounded-xl border border-border bg-surface-2/60 p-4 mb-4">
                                            <div className="flex justify-between items-start mb-2 gap-3 flex-wrap">
                                                <div>
                                                    <h3 className="font-bold text-lg flex items-center gap-2 flex-wrap">
                                                        <Link to={`/user/${r.specialist_id}`} className="hover:text-accent-bright underline decoration-transparent hover:decoration-accent transition">
                                                            {r.specialist_online && <span className="inline-block w-2.5 h-2.5 rounded-full bg-success mr-2 align-middle" title="Сейчас онлайн"></span>}
                                                            {r.specialist_name || `Специалист №${r.specialist_id}`}
                                                        </Link>
                                                        {r.specialist_pro && <ProBadge />}
                                                        {r.specialist_verified && (
                                                            <span className="text-accent-bright" title="Проверенный">✓</span>
                                                        )}
                                                        {r.specialist_rating !== null && r.specialist_rating !== undefined && (
                                                            <span className="rounded-full bg-surface border border-border text-[11px] font-bold px-2 py-0.5">
                                                                ⭐ {r.specialist_rating}
                                                            </span>
                                                        )}
                                                    </h3>
                                                    <div className="flex gap-3 text-xs font-semibold text-muted mt-1 flex-wrap">
                                                        <span>{r.specialist_email}</span>
                                                        {r.specialist_city && <span>📍 {r.specialist_city}</span>}
                                                        {r.specialist_completed_tasks > 0 && <span>✅ {r.specialist_completed_tasks} заказов</span>}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleAssign(viewingResponsesTask, r.specialist_id)} className={btnSignal}>Назначить</button>
                                            </div>
                                            {(r.proposed_price || r.estimated_days) && (
                                                <div className="flex gap-4 mt-2 text-sm font-bold">
                                                    {r.proposed_price && <span className="font-display text-accent-bright">{r.proposed_price} ₽</span>}
                                                    {r.estimated_days && <span className="text-muted uppercase text-xs tracking-wider pt-1">⏱ {r.estimated_days} дн.</span>}
                                                </div>
                                            )}
                                            <p className="text-sm whitespace-pre-wrap mt-3 border-t border-border/60 pt-3 text-ink/85">{r.text}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal for Chat / Workspace */}
                {chatTask && (
                    <div className={modalOverlay}>
                        <div ref={chatRef} tabIndex={-1} className={`${modalPanel} w-full max-w-2xl h-[80vh] flex flex-col p-6 outline-none focus:ring-2 focus:ring-accent/50`}>
                            <div className="flex justify-between items-center mb-4 border-b border-border pb-4 gap-3 flex-wrap">
                                <div>
                                    <h2 className="font-display font-bold uppercase text-xl flex items-center gap-3 flex-wrap">
                                        Рабочая область
                                        <span className="rounded-full bg-accent/20 text-accent-bright border border-accent/40 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5">В работе</span>
                                    </h2>
                                    <p className="text-muted font-semibold text-sm mt-1">Заказ: {chatTask.title}</p>
                                </div>
                                <div className="flex gap-2">
                                    {role === 'customer' && (
                                        <button onClick={() => setConfirmingComplete(true)} className={btnSignal}>Завершить заказ</button>
                                    )}
                                    <button onClick={() => {
                                        setChatTask(null);
                                        if (wsRef.current) {
                                            wsRef.current.close();
                                            wsRef.current = null;
                                        }
                                    }} className="w-10 h-10 shrink-0 rounded-lg bg-surface-2 border border-border font-extrabold flex items-center justify-center transition hover:border-border-bright">&times;</button>
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-grow overflow-y-auto mb-4 flex flex-col gap-3 p-3 rounded-xl border border-border/60 bg-base/60">
                                {messages.length === 0 ? (
                                    <div className="text-center text-muted/60 my-auto font-display uppercase text-sm">Нет сообщений. Начните общение первым.</div>
                                ) : (
                                    messages.map(msg => {
                                        const isMe = msg.sender_id === safeUserId(token);
                                        return (
                                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${isMe ? 'bg-accent text-white rounded-br-md' : 'bg-surface-2 border border-border rounded-bl-md'}`}>
                                                    {!isMe && <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">{msg.sender_name}</div>}
                                                    <div className="whitespace-pre-wrap text-sm font-medium">{msg.text}</div>
                                                    <div className={`text-[10px] text-right mt-1 font-semibold ${isMe ? 'text-white/60' : 'text-muted/70'}`}>
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Chat Input */}
                            <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-border pt-4">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    className={`${inputCls} flex-grow min-w-0`}
                                    placeholder="Введите сообщение..."
                                />
                                <button type="submit" disabled={!newMessage.trim()} className="bg-accent hover:bg-accent-bright disabled:opacity-40 text-white font-bold px-6 rounded-xl transition">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal for Review */}
                {reviewingTask && (
                    <div className={modalOverlay}>
                        <div ref={reviewRef} tabIndex={-1} className={`${modalPanel} w-full max-w-md p-6 outline-none focus:ring-2 focus:ring-accent/50`}>
                            <h2 className="font-display font-bold uppercase text-xl">{role === 'customer' ? 'Оцените исполнителя' : 'Оцените заказчика'}</h2>
                            <p className="mt-3 text-muted font-semibold">Заказ &laquo;{reviewingTask.title}&raquo; завершен. {role === 'customer' ? 'Как вам работа специалиста?' : 'Как вам работа с этим заказчиком?'}</p>

                            <div className="my-6 flex gap-2 justify-center" onMouseLeave={() => setReviewHover(0)}>
                                {[1, 2, 3, 4, 5].map(star => {
                                    const active = (reviewHover || reviewRating) >= star;
                                    return (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setReviewRating(star)}
                                            onMouseEnter={() => setReviewHover(star)}
                                            className={`w-12 h-12 rounded-xl border text-2xl flex items-center justify-center transition ${active ? 'bg-star/15 border-star/50 text-star scale-110' : 'bg-surface-2 border-border text-muted/30 hover:text-star/70'}`}
                                        >
                                            ★
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="-mt-3 mb-4 text-center text-sm font-bold uppercase tracking-wider text-muted">{reviewRating} / 5</p>

                            <textarea
                                value={reviewComment}
                                onChange={e => setReviewComment(e.target.value)}
                                className={`${inputCls} mb-4`}
                                rows="4"
                                placeholder="Напишите пару слов о том, как всё прошло..."
                            ></textarea>

                            <div className="flex justify-end gap-3">
                                <button onClick={() => setReviewingTask(null)} className={btnGhost}>Пропустить</button>
                                <button onClick={handleSubmitReview} className={btnPrimary}>Оставить отзыв</button>
                            </div>
                        </div>
                    </div>
                )}

                {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} onTaskCreated={fetchTasks} />}

                {lightbox && (
                    <Lightbox
                        images={lightbox.images}
                        index={lightbox.index}
                        onClose={() => setLightbox(null)}
                        onNavigate={(i) => setLightbox({ ...lightbox, index: i })}
                    />
                )}

                {confirmingComplete && (
                    <ConfirmDialog
                        title="Завершить заказ?"
                        message={`Заказ «${chatTask?.title}» будет отмечен как завершённый. Средства поступят специалисту.`}
                        confirmText="Завершить"
                        onConfirm={() => handleCompleteTask(chatTask.id)}
                        onClose={() => setConfirmingComplete(false)}
                    />
                )}
            </section>
        </div>
    );
};

export default Feed;

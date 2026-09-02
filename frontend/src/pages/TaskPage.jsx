import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import { Lightbox } from '../components/Dialogs';
import { TaskMap } from '../components/TaskMap';
import { getCategoryLabel } from '../lib/constants';
import { safeUserId } from '../lib/utils';
import { inputCls, labelCls, btnPrimary, btnGhost } from '../lib/styles';

const getStatusBadge = (status) => {
    switch (status) {
        case 'open': return <span className="rounded-full border border-border bg-surface-2 text-ink text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5">Открыт</span>;
        case 'in_progress': return <span className="rounded-full bg-accent/20 text-accent-bright border border-accent/40 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5">В работе</span>;
        case 'completed': return <span className="rounded-full bg-success/15 text-success border border-success/30 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5">Завершён</span>;
        default: return null;
    }
};

const TaskPage = () => {
    const { id } = useParams();
    const { token, role } = useAuthStore();
    const toast = useToast();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [connError, setConnError] = useState(false);
    const [lightbox, setLightbox] = useState(null);
    const [responseText, setResponseText] = useState('');
    const [proposedPrice, setProposedPrice] = useState('');
    const [estimatedDays, setEstimatedDays] = useState('');
    const [sending, setSending] = useState(false);
    const [confirmingDeleteImage, setConfirmingDeleteImage] = useState(null);

    const fetchTask = () => {
        setLoading(true);
        setNotFound(false);
        setConnError(false);
        api.get(`/tasks/${id}`)
            .then(res => setTask(res.data))
            .catch(err => {
                if (err.response?.status === 404) setNotFound(true);
                else setConnError(true);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchTask();
    }, [id]);

    const handleSendResponse = async () => {
        if (!responseText.trim() || sending) return;
        setSending(true);
        try {
            const res = await api.post(`/tasks/${task.id}/responses`,
                {
                    text: responseText,
                    proposed_price: proposedPrice ? parseInt(proposedPrice) : null,
                    estimated_days: estimatedDays ? parseInt(estimatedDays) : null
                }
            );
            toast.success('Ваш отклик успешно отправлен заказчику!' + (res.data && res.data.credits_left !== null && res.data.credits_left !== undefined ? ` Осталось откликов: ${res.data.credits_left}` : ''));
            setResponseText('');
            setProposedPrice('');
            setEstimatedDays('');
        } catch (err) {
            toast.error('Ошибка отправки отклика. Вы авторизованы?');
        } finally {
            setSending(false);
        }
    };

    const parseImages = (imgs) => { try { return imgs ? JSON.parse(imgs) : []; } catch { return []; } };
    const images = task ? parseImages(task.images) : [];
    const isOwner = token && role === 'customer' && task && task.customer_id === safeUserId(token);

    const handleDeleteImage = async (url) => {
        try {
            await api.delete(`/tasks/${task.id}/images`,
                { data: { urls_to_delete: [url] } }
            );
            toast.success('Фото удалено');
            fetchTask();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Не удалось удалить фото');
        } finally {
            setConfirmingDeleteImage(null);
        }
    };

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-10">
                <div className="bg-surface border border-border rounded-2xl p-6 animate-pulse">
                    <div className="h-7 w-2/3 bg-surface-2 rounded-lg mb-4" />
                    <div className="h-4 w-1/2 bg-surface-2 rounded mb-6" />
                    <div className="h-4 w-full bg-surface-2 rounded mb-2" />
                    <div className="h-4 w-5/6 bg-surface-2 rounded mb-2" />
                    <div className="h-4 w-3/4 bg-surface-2 rounded" />
                </div>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="max-w-xl mx-auto my-20 text-center px-4">
                <div className="font-display font-bold uppercase text-3xl">Не найдено</div>
                <p className="text-muted mt-3 font-semibold">Такого заказа нет - возможно, его удалили.</p>
                <Link to="/" className={`${btnGhost} mt-6`}>← Все заказы</Link>
            </div>
        );
    }

    if (connError) {
        return (
            <div className="max-w-xl mx-auto my-20 text-center px-4">
                <div className="font-display font-bold uppercase text-3xl">Нет соединения</div>
                <p className="text-muted mt-3 font-semibold">Сервер не отвечает. Попробуйте ещё раз.</p>
                <button onClick={fetchTask} className={`${btnGhost} mt-6`}>Повторить</button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-10">
            <Link to="/" className="inline-block text-xs font-bold uppercase tracking-wider text-muted hover:text-accent-bright transition mb-6">← Все заказы</Link>

            <article className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
                <div className="p-6 border-b border-border">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="rounded-full bg-surface-2 border border-border text-ink text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">{getCategoryLabel(task.category)}</span>
                        {getStatusBadge(task.status)}
                    </div>
                    <h1 className="font-extrabold text-2xl md:text-3xl leading-tight mt-4">{task.title}</h1>
                    <div className="flex gap-4 mt-3 text-[11px] font-bold uppercase tracking-wide text-muted flex-wrap">
                        {task.is_remote ? <span>🌐 Удалённо</span> : task.city && <span>📍 {task.city}{task.address && `, ${task.address}`}</span>}
                        {task.deadline && <span>📅 До {new Date(task.deadline).toLocaleDateString('ru-RU')}</span>}
                        <span>💬 {task.responses_count} откл.</span>
                    </div>
                </div>

                <div className="p-6">
                    <div className="font-display font-bold text-3xl mb-4 text-accent-bright">{task.budget} ₽</div>
                    <p className="text-ink/85 whitespace-pre-wrap break-words font-medium">{task.description}</p>

                    {images.length > 0 && (
                        <div className="grid grid-cols-3 gap-3 mt-6">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative">
                                    <img
                                        src={img}
                                        alt={`Фото ${idx + 1}`}
                                        className="w-full h-28 object-cover rounded-lg border border-border cursor-pointer transition hover:border-accent/60"
                                        onClick={() => setLightbox({ images, index: idx })}
                                    />
                                    {isOwner && (
                                        <button
                                            onClick={() => setConfirmingDeleteImage(img)}
                                            title="Удалить фото"
                                            className="absolute -top-2 -right-2 bg-danger text-white w-7 h-7 rounded-full font-extrabold text-sm flex items-center justify-center transition hover:scale-110"
                                        >×</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {(task.latitude && task.longitude) && (
                        <div className="mt-6 rounded-xl border border-border overflow-hidden h-[280px]">
                            <TaskMap tasks={[task]} onTaskClick={() => {}} />
                        </div>
                    )}

                    <div className="mt-6 pt-6 border-t border-border/60 flex items-center gap-3 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Заказчик:</span>
                        <Link to={`/user/${task.customer_id}`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-bold text-sm hover:border-accent/50 transition">
                            {task.customer_name || `Пользователь №${task.customer_id}`}
                        </Link>
                    </div>
                </div>

                {/* Response form */}
                {task.status === 'open' && (
                    <div className="p-6 border-t border-border dot-grid">
                        <h3 className="font-display font-bold uppercase text-lg">Откликнуться</h3>
                        {!token ? (
                            <p className="mt-3 text-muted font-semibold text-sm">Войдите как специалист, чтобы отправить отклик.</p>
                        ) : role !== 'specialist' ? (
                            <p className="mt-3 text-muted font-semibold text-sm">Отклики доступны только для аккаунтов специалистов.</p>
                        ) : (
                            <div className="mt-4 flex flex-col gap-4">
                                <textarea value={responseText} onChange={e => setResponseText(e.target.value)} className={inputCls} rows="4" placeholder="Расскажите о вашем опыте и как вы решите эту задачу..."></textarea>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Ваша цена (₽)</label>
                                        <input type="number" value={proposedPrice} onChange={e => setProposedPrice(e.target.value)} placeholder={task.budget} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Срок (дней)</label>
                                        <input type="number" value={estimatedDays} onChange={e => setEstimatedDays(e.target.value)} placeholder="7" className={inputCls} />
                                    </div>
                                </div>
                                <button onClick={handleSendResponse} disabled={sending} className={`${btnPrimary} disabled:opacity-50`}>
                                    {sending ? 'Отправка...' : 'Отправить отклик'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </article>

            {lightbox && (
                <Lightbox
                    images={lightbox.images}
                    index={lightbox.index}
                    onClose={() => setLightbox(null)}
                    onNavigate={(i) => setLightbox({ ...lightbox, index: i })}
                />
            )}
        </div>
    );
};

export default TaskPage;

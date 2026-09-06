import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Lightbox } from '../components/Dialogs';
import ProBadge from '../ui/ProBadge';
import { btnGhost } from '../lib/styles';

const PublicProfilePage = () => {
    const { id } = useParams();
    const [user, setUser] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [connError, setConnError] = useState(false);
    const [lightbox, setLightbox] = useState(null);

    useEffect(() => {
        setLoading(true);
        setNotFound(false);
        setConnError(false);
        api.get(`/users/${id}/public`)
            .then(res => {
                setUser(res.data);
                return api.get(`/users/${id}/reviews`);
            })
            .then(res => setReviews(res.data))
            .catch(err => {
                if (err.response?.status === 404) setNotFound(true);
                else setConnError(true);
            })
            .finally(() => setLoading(false));
    }, [id]);

    const parseList = (raw) => { try { return raw ? JSON.parse(raw) : []; } catch { return []; } };
    const portfolio = user ? parseList(user.portfolio) : [];
    const skills = user ? (user.skills ? user.skills.split(',').map(s => s.trim()).filter(Boolean) : []) : [];

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-10">
                <div className="bg-surface border border-border rounded-2xl p-6 animate-pulse">
                    <div className="flex gap-4 items-center">
                        <div className="w-20 h-20 bg-surface-2 rounded-xl" />
                        <div className="flex-1"><div className="h-6 w-1/2 bg-surface-2 rounded mb-3" /><div className="h-4 w-1/3 bg-surface-2 rounded" /></div>
                    </div>
                </div>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="max-w-xl mx-auto my-20 text-center px-4">
                <div className="font-display font-bold uppercase text-3xl">Не найдено</div>
                <p className="text-muted mt-3 font-semibold">Такого пользователя нет.</p>
                <Link to="/" className={`${btnGhost} mt-6`}>← На главную</Link>
            </div>
        );
    }

    if (connError) {
        return (
            <div className="max-w-xl mx-auto my-20 text-center px-4">
                <div className="font-display font-bold uppercase text-3xl">Нет соединения</div>
                <p className="text-muted mt-3 font-semibold">Сервер не отвечает.</p>
                <Link to="/" className={`${btnGhost} mt-6`}>← На главную</Link>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-10">
            <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
                <div className="border-b border-border p-6 flex items-center gap-5 flex-wrap">
                    {user.avatar ? (
                        <img src={user.avatar} alt="Аватар" className="w-24 h-24 object-cover rounded-xl border border-border" />
                    ) : (
                        <div className="w-24 h-24 bg-accent text-white font-display font-bold text-4xl flex items-center justify-center rounded-xl">
                            {(user.name || 'П').trim().charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="flex-grow">
                        <h1 className="font-display font-bold uppercase text-xl md:text-2xl flex items-center gap-2 flex-wrap">
                            {user.name || `Пользователь №${user.id}`}
                            {user.is_pro && <ProBadge />}
                            {user.verified && <span className="text-accent-bright" title="Проверенный">✓</span>}
                        </h1>
                        <div className="flex gap-2 mt-3 flex-wrap">
                            {(user.online || user.last_seen) && (
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${user.online ? 'border-success/40 bg-success/10 text-success' : 'border-border bg-surface-2 text-muted'}`}>
                                    <span className={`inline-block w-2 h-2 mr-1.5 rounded-full ${user.online ? 'bg-success' : 'bg-muted/50'}`}></span>
                                    {user.online ? 'Онлайн' : 'Был(а) недавно'}
                                </span>
                            )}
                            <span className="rounded-full bg-surface-2 border border-border text-ink text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">
                                {user.role === 'specialist' ? '🛠 Специалист' : '🤝 Заказчик'}
                            </span>
                            {user.city && <span className="rounded-full border border-border bg-surface-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">📍 {user.city}</span>}
                            {user.rating !== null && <span className="rounded-full border border-border bg-surface-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">⭐ {user.rating} / 5</span>}
                            {user.role === 'specialist' && <span className="rounded-full border border-border bg-surface-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">📋 {user.completed_tasks} заказов</span>}
                            {user.role === 'specialist' && user.experience_years != null && <span className="rounded-full border border-border bg-surface-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">🎓 {user.experience_years} лет опыта</span>}
                            {user.role === 'specialist' && user.hourly_rate != null && <span className="rounded-full border border-border bg-surface-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">💰 {user.hourly_rate} ₽/час</span>}
                        </div>
                    </div>
                </div>

                {/* Специализация + компания */}
                {(user.specialization || user.education || user.company_name || user.website) && (
                    <div className="p-6 border-b border-border/60 grid gap-3">
                        {user.specialization && (
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Специализация</div>
                                <p className="text-ink/85 font-medium">{user.specialization}</p>
                            </div>
                        )}
                        {user.education && (
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Образование</div>
                                <p className="text-ink/85 font-medium">{user.education}</p>
                            </div>
                        )}
                        {user.company_name && (
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Компания</div>
                                <p className="text-ink/85 font-medium">{user.company_name}</p>
                                {user.company_description && <p className="text-ink/70 text-sm mt-1 font-medium whitespace-pre-wrap break-words">{user.company_description}</p>}
                            </div>
                        )}
                        {user.website && (
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Сайт</div>
                                <a href={user.website} target="_blank" rel="noopener noreferrer" className="text-accent-bright font-bold hover:underline break-all">{user.website}</a>
                            </div>
                        )}
                    </div>
                )}

                {/* Контакты */}
                {(user.telegram_handle || user.whatsapp) && (
                    <div className="p-6 border-b border-border/60">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">Контакты</div>
                        <div className="flex flex-wrap gap-3">
                            {user.telegram_handle && (
                                <a href={`https://t.me/${user.telegram_handle.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-border bg-surface-2 px-3 py-2 font-bold text-sm hover:border-accent/60 transition">
                                    ✈️ {user.telegram_handle}
                                </a>
                            )}
                            {user.whatsapp && (
                                <a href={`https://wa.me/${user.whatsapp.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-border bg-surface-2 px-3 py-2 font-bold text-sm hover:border-accent/60 transition">
                                    💬 WhatsApp
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {user.bio && (
                    <div className="p-6 border-b border-border/60">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">О себе</div>
                        <p className="text-ink/85 whitespace-pre-wrap break-words font-medium">{user.bio}</p>
                    </div>
                )}

                {skills.length > 0 && (
                    <div className="p-6 border-b border-border/60">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">Навыки</div>
                        <div className="flex flex-wrap gap-2">
                            {skills.map((s, i) => (
                                <span key={i} className="rounded-full bg-accent/15 text-accent-bright border border-accent/30 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1">{s}</span>
                            ))}
                        </div>
                    </div>
                )}

                {portfolio.length > 0 && (
                    <div className="p-6 border-b border-border/60">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">Портфолио</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {portfolio.map((img, idx) => (
                                <img key={idx} src={img} alt={`Работа ${idx + 1}`} className="w-full h-28 object-cover rounded-lg border border-border cursor-pointer transition hover:border-accent/60" onClick={() => setLightbox({ images: portfolio, index: idx })} />
                            ))}
                        </div>
                    </div>
                )}

                <div className="p-6">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-4">Отзывы ({reviews.length})</div>
                    {reviews.length === 0 ? (
                        <p className="text-muted font-semibold text-sm">Отзывов пока нет.</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {reviews.map(r => (
                                <div key={r.id} className="rounded-xl border border-border bg-surface-2/60 p-4">
                                    <div className="flex justify-between items-center gap-3 flex-wrap">
                                        <span className="font-bold">{r.reviewer_name}{r.reviewer_role && <span className="text-[10px] font-bold uppercase tracking-wider text-muted ml-2">{r.reviewer_role}</span>}</span>
                                        <span className="rounded-full bg-star/15 text-star border border-star/30 text-xs font-bold px-2 py-0.5">{"★".repeat(r.rating)}</span>
                                    </div>
                                    {r.task_title && (
                                        <Link to={`/task/${r.task_id}`} className="text-xs font-bold text-accent-bright hover:underline mt-1 inline-block">Заказ: {r.task_title}</Link>
                                    )}
                                    {r.comment && <p className="text-sm text-ink/85 mt-2 font-medium">{r.comment}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

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

export default PublicProfilePage;

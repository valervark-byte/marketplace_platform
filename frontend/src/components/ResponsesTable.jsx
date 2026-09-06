import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from './Toast';
import { Lightbox } from './Dialogs';

export const ResponsesTable = ({ taskId, token, onAssign }) => {
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [avgPrice, setAvgPrice] = useState(null);
    const [viewMode, setViewMode] = useState('cards'); // cards | table
    const toast = useToast();

    // Фильтры
    const [sortBy, setSortBy] = useState(''); // "", "price_asc", "price_desc", "rating"
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [onlyPro, setOnlyPro] = useState(false);
    const [lightbox, setLightbox] = useState(null);

    const fetchResponses = () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (sortBy) params.append('sort_by', sortBy);
        if (minPrice) params.append('min_price', minPrice);
        if (maxPrice) params.append('max_price', maxPrice);
        if (onlyPro) params.append('only_pro', 'true');

        api.get(`/tasks/${taskId}/responses?${params.toString()}`)
            .then(res => {
                setResponses(res.data.responses || res.data || []);
                setAvgPrice(res.data.avg_price || null);
            })
            .catch(() => toast.error('Ошибка загрузки откликов'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (token) fetchResponses();
    }, [taskId, token, sortBy, minPrice, maxPrice, onlyPro]);

    if (loading) {
        return <div className="text-center text-muted py-8">Загрузка откликов...</div>;
    }

    if (!responses.length) {
        return (
            <div className="bg-surface-2/50 border border-border rounded-xl p-8 text-center">
                <div className="text-2xl mb-2">📭</div>
                <div className="font-display font-bold text-lg">Пока нет откликов</div>
                <p className="text-muted text-sm mt-2">Специалисты ещё не откликнулись на этот заказ</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Фильтры */}
            <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[180px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5 block">Сортировка</label>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            className="w-full rounded-lg border border-border bg-base px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                            <option value="">По умолчанию</option>
                            <option value="price_asc">Цена: по возрастанию</option>
                            <option value="price_desc">Цена: по убыванию</option>
                            <option value="rating">Рейтинг</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5 block">Цена от</label>
                        <input
                            type="number"
                            value={minPrice}
                            onChange={e => setMinPrice(e.target.value)}
                            placeholder="0"
                            className="w-full rounded-lg border border-border bg-base px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5 block">Цена до</label>
                        <input
                            type="number"
                            value={maxPrice}
                            onChange={e => setMaxPrice(e.target.value)}
                            placeholder="∞"
                            className="w-full rounded-lg border border-border bg-base px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={onlyPro}
                            onChange={e => setOnlyPro(e.target.checked)}
                            className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                        />
                        <span className="text-sm font-medium">Только PRO</span>
                    </label>
                </div>

                {avgPrice && (
                    <div className="mt-3 pt-3 border-t border-border text-sm">
                        <span className="font-medium text-muted">Средняя цена откликов:</span>
                        <span className="ml-2 font-display font-bold text-accent text-base">{avgPrice.toLocaleString()} ₽</span>
                    </div>
                )}
            </div>

            {/* Переключатель вида */}
            <div className="flex gap-2">
                <button
                    onClick={() => setViewMode('cards')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                        viewMode === 'cards' ? 'bg-accent text-white' : 'bg-surface border border-border text-muted hover:text-ink'
                    }`}
                >
                    Карточки
                </button>
                <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                        viewMode === 'table' ? 'bg-accent text-white' : 'bg-surface border border-border text-muted hover:text-ink'
                    }`}
                >
                    Таблица
                </button>
            </div>

            {/* Отклики */}
            {viewMode === 'table' ? (
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-surface-2 border-b border-border">
                                <tr>
                                    <th className="text-left px-4 py-3 font-bold uppercase text-[10px] tracking-widest text-muted">Специалист</th>
                                    <th className="text-left px-4 py-3 font-bold uppercase text-[10px] tracking-widest text-muted">Рейтинг</th>
                                    <th className="text-left px-4 py-3 font-bold uppercase text-[10px] tracking-widest text-muted">Выполнено</th>
                                    <th className="text-left px-4 py-3 font-bold uppercase text-[10px] tracking-widest text-muted">Цена</th>
                                    <th className="text-left px-4 py-3 font-bold uppercase text-[10px] tracking-widest text-muted">Срок</th>
                                    <th className="text-left px-4 py-3 font-bold uppercase text-[10px] tracking-widest text-muted">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {responses.map(r => (
                                    <tr key={r.id} className="hover:bg-surface-2/50 transition">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {r.specialist_avatar && (
                                                    <img src={r.specialist_avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                )}
                                                <div>
                                                    <Link to={`/user/${r.specialist_id}`} className="font-medium hover:text-accent transition">
                                                        {r.specialist_name}
                                                    </Link>
                                                    {r.specialist_pro && <span className="ml-1.5 text-accent text-xs">★ PRO</span>}
                                                    {r.specialist_verified && <span className="ml-1 text-success text-xs">✓</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {r.specialist_rating ? (
                                                <span className="font-medium">⭐ {r.specialist_rating}</span>
                                            ) : (
                                                <span className="text-muted text-xs">Нет отзывов</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-medium">{r.specialist_completed_tasks}</td>
                                        <td className="px-4 py-3">
                                            {r.proposed_price ? (
                                                <span className="font-display font-bold text-accent">{r.proposed_price.toLocaleString()} ₽</span>
                                            ) : (
                                                <span className="text-muted text-xs">Не указано</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {r.estimated_days ? `${r.estimated_days} дн.` : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => onAssign(r.specialist_id)}
                                                className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-wider hover:bg-accent-bright transition"
                                            >
                                                Выбрать
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {responses.map(r => (
                        <div key={r.id} className="bg-surface border border-border rounded-xl p-4 hover:shadow-card transition">
                            <div className="flex gap-4">
                                {r.specialist_avatar && (
                                    <img src={r.specialist_avatar} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div>
                                            <Link to={`/user/${r.specialist_id}`} className="font-display font-bold text-lg hover:text-accent transition">
                                                {r.specialist_name}
                                            </Link>
                                            <div className="flex items-center gap-2 mt-1">
                                                {r.specialist_pro && <span className="rounded-full bg-accent/10 text-accent border border-accent/30 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5">★ PRO</span>}
                                                {r.specialist_verified && <span className="text-success text-xs">✓ Проверен</span>}
                                                {r.specialist_online && <span className="text-[10px] text-muted">🟢 Онлайн</span>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onAssign(r.specialist_id)}
                                            className="px-4 py-2 rounded-xl bg-accent text-white font-display text-xs uppercase tracking-wider hover:bg-accent-bright transition shadow-card"
                                        >
                                            Выбрать
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 my-3">
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Рейтинг</div>
                                            <div className="font-medium mt-1">
                                                {r.specialist_rating ? `⭐ ${r.specialist_rating}` : 'Нет отзывов'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Выполнено</div>
                                            <div className="font-medium mt-1">{r.specialist_completed_tasks}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Город</div>
                                            <div className="font-medium mt-1">{r.specialist_city || '—'}</div>
                                        </div>
                                    </div>

                                    <div className="bg-surface-2/50 rounded-lg p-3 mb-3">
                                        <p className="text-sm leading-relaxed">{r.text}</p>
                                    </div>

                                    <div className="flex gap-4 items-center">
                                        {r.proposed_price && (
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Цена: </span>
                                                <span className="font-display font-bold text-accent text-lg">{r.proposed_price.toLocaleString()} ₽</span>
                                            </div>
                                        )}
                                        {r.estimated_days && (
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Срок: </span>
                                                <span className="font-medium">{r.estimated_days} дн.</span>
                                            </div>
                                        )}
                                    </div>

                                    {r.portfolio_items && r.portfolio_items.length > 0 && (
                                        <div className="mt-4">
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Портфолио</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {r.portfolio_items.map((item, idx) => (
                                                    <div key={idx} className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer" onClick={() => setLightbox(item.image_url)}>
                                                        <img src={item.image_url} alt={item.title || ''} className="w-full h-full object-cover group-hover:scale-110 transition" />
                                                        {item.title && (
                                                            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-2">
                                                                <span className="text-white text-xs font-medium">{item.title}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {lightbox && <Lightbox images={[lightbox]} initialIndex={0} onClose={() => setLightbox(null)} />}
        </div>
    );
};

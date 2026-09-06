import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/Dialogs';
import EmptyState from '../ui/EmptyState';
import ProductFormModal from '../components/ProductFormModal';
import { PRODUCT_STATUS_LABELS, ORDER_STATUS_LABELS } from '../lib/constants';
import { btnPrimary, btnGhost, modalOverlay, modalPanel } from '../lib/styles';

const parseImages = (raw) => { try { return raw ? JSON.parse(raw) : []; } catch { return []; } };

const TABS = [
    { key: 'listings', label: 'Мои объявления' },
    { key: 'purchases', label: 'Мои покупки' },
    { key: 'sales', label: 'Продажи' },
];

const MyProductsPage = () => {
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') || 'listings';
    const [tab, setTab] = useState(TABS.some(t => t.key === initialTab) ? initialTab : 'listings');

    const [listings, setListings] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [reviewFor, setReviewFor] = useState(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewSaving, setReviewSaving] = useState(false);
    const [reviewedProducts, setReviewedProducts] = useState([]);

    const changeTab = (key) => {
        setTab(key);
        setSearchParams({ tab: key });
    };

    const fetchAll = () => {
        setLoading(true);
        Promise.all([
            api.get('/products/mine').then(r => setListings(r.data)).catch(() => setListings([])),
            api.get('/product-orders/purchases').then(r => setPurchases(r.data)).catch(() => setPurchases([])),
            api.get('/product-orders/sales').then(r => setSales(r.data)).catch(() => setSales([])),
        ]).finally(() => setLoading(false));
    };

    useEffect(fetchAll, []);

    const deleteProduct = async () => {
        try {
            await api.delete(`/products/${confirmDelete.id}`);
            toast.success('Товар удалён');
            setConfirmDelete(null);
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Ошибка удаления');
        }
    };

    const updateOrderStatus = async (orderId, status) => {
        try {
            await api.put(`/product-orders/${orderId}/status?new_status=${status}`);
            toast.success('Статус обновлён');
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Ошибка');
        }
    };

    const openReview = (order) => {
        setReviewFor(order);
        setReviewRating(5);
        setReviewComment('');
    };

    const submitReview = async () => {
        if (!reviewFor) return;
        setReviewSaving(true);
        try {
            await api.post(`/products/${reviewFor.product_id}/reviews`, {
                rating: reviewRating,
                comment: reviewComment.trim() || null,
            });
            toast.success('Отзыв добавлен');
            setReviewedProducts(prev => [...prev, reviewFor.product_id]);
            setReviewFor(null);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Ошибка отправки отзыва');
        } finally {
            setReviewSaving(false);
        }
    };

    const statusBadge = (status) => {
        const map = {
            active: 'bg-success/15 text-success border-success/30',
            draft: 'bg-surface-2 text-muted border-border',
            sold: 'bg-danger/15 text-danger border-danger/30',
            archived: 'bg-surface-2 text-muted border-border',
        };
        return <span className={`rounded-full border text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 ${map[status] || map.draft}`}>{PRODUCT_STATUS_LABELS[status] || status}</span>;
    };

    const orderStatusBadge = (status) => {
        const map = {
            pending: 'bg-star/15 text-star border-star/30',
            confirmed: 'bg-accent/15 text-accent-bright border-accent/30',
            shipped: 'bg-accent/15 text-accent-bright border-accent/30',
            delivered: 'bg-success/15 text-success border-success/30',
            cancelled: 'bg-danger/15 text-danger border-danger/30',
        };
        return <span className={`rounded-full border text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 ${map[status] || map.pending}`}>{ORDER_STATUS_LABELS[status] || status}</span>;
    };

    return (
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                <h1 className="font-display font-extrabold uppercase text-2xl md:text-3xl">Управление товарами</h1>
                <Link to="/products" className={btnGhost}>← В каталог</Link>
            </div>

            {/* Вкладки */}
            <div className="flex gap-1 mb-6 border-b border-border">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => changeTab(t.key)} className={`px-4 py-3 font-display text-xs uppercase tracking-wider transition border-b-2 -mb-px ${tab === t.key ? 'border-accent text-accent-bright' : 'border-transparent text-muted hover:text-ink'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-surface-2 rounded-xl animate-pulse" />)}</div>
            ) : (
                <>
                    {/* Объявления */}
                    {tab === 'listings' && (
                        listings.length === 0 ? (
                            <EmptyState icon="📦" title="Нет объявлений" description="Разместите первый товар в каталоге." />
                        ) : (
                            <div className="flex flex-col gap-3">
                                {listings.map(p => {
                                    const cover = parseImages(p.images)[0];
                                    return (
                                        <div key={p.id} className="flex gap-4 items-center rounded-xl border border-border bg-surface p-3">
                                            <Link to={`/products/${p.id}`} className="shrink-0">
                                                {cover ? <img src={cover} alt="" className="w-20 h-20 rounded-lg object-cover" /> : <div className="w-20 h-20 rounded-lg bg-surface-2 flex items-center justify-center text-2xl text-muted/40">📦</div>}
                                            </Link>
                                            <div className="flex-grow min-w-0">
                                                <Link to={`/products/${p.id}`} className="font-bold hover:text-accent-bright transition line-clamp-1">{p.title}</Link>
                                                <div className="font-display font-bold text-lg">{p.price.toLocaleString('ru')} ₽</div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    {statusBadge(p.status)}
                                                    <span className="text-[11px] font-bold text-muted">👁 {p.views} · склад: {p.stock}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 shrink-0">
                                                <button onClick={() => setEditing(p)} className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-bold text-xs uppercase tracking-wider hover:border-accent/60 transition">Изменить</button>
                                                <button onClick={() => setConfirmDelete(p)} className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-bold text-xs uppercase tracking-wider text-danger hover:border-danger/60 transition">Удалить</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}

                    {/* Покупки */}
                    {tab === 'purchases' && (
                        purchases.length === 0 ? (
                            <EmptyState icon="🛒" title="Нет покупок" description="Здесь появятся заказанные вами товары." />
                        ) : (
                            <div className="flex flex-col gap-3">
                                {purchases.map(o => (
                                    <div key={o.id} className="flex gap-4 items-center rounded-xl border border-border bg-surface p-3">
                                        <Link to={`/products/${o.product_id}`} className="shrink-0">
                                            {o.product_image ? <img src={o.product_image} alt="" className="w-16 h-16 rounded-lg object-cover" /> : <div className="w-16 h-16 rounded-lg bg-surface-2 flex items-center justify-center text-xl text-muted/40">📦</div>}
                                        </Link>
                                        <div className="flex-grow min-w-0">
                                            <div className="font-bold line-clamp-1">{o.product_title}</div>
                                            <div className="text-sm font-semibold text-muted">{o.quantity} шт · {o.total_price.toLocaleString('ru')} ₽</div>
                                            <div className="mt-1">{orderStatusBadge(o.status)}</div>
                                        </div>
                                        <div className="flex flex-col gap-2 shrink-0">
                                            {['pending', 'confirmed', 'shipped'].includes(o.status) && (
                                                <button onClick={() => updateOrderStatus(o.id, 'cancelled')} className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-bold text-xs uppercase tracking-wider text-danger hover:border-danger/60 transition">Отменить</button>
                                            )}
                                            {o.status === 'shipped' && (
                                                <button onClick={() => updateOrderStatus(o.id, 'delivered')} className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-bold text-xs uppercase tracking-wider text-success hover:border-success/60 transition">Получен</button>
                                            )}
                                            {o.status === 'delivered' && !reviewedProducts.includes(o.product_id) && (
                                                <button onClick={() => openReview(o)} className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-bold text-xs uppercase tracking-wider text-star hover:border-star/60 transition">Отзыв</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {/* Продажи */}
                    {tab === 'sales' && (
                        sales.length === 0 ? (
                            <EmptyState icon="💼" title="Нет продаж" description="Здесь появятся заказы на ваши товары." />
                        ) : (
                            <div className="flex flex-col gap-3">
                                {sales.map(o => (
                                    <div key={o.id} className="rounded-xl border border-border bg-surface p-4">
                                        <div className="flex gap-4 items-start">
                                            <Link to={`/products/${o.product_id}`} className="shrink-0">
                                                {o.product_image ? <img src={o.product_image} alt="" className="w-16 h-16 rounded-lg object-cover" /> : <div className="w-16 h-16 rounded-lg bg-surface-2 flex items-center justify-center text-xl text-muted/40">📦</div>}
                                            </Link>
                                            <div className="flex-grow min-w-0">
                                                <div className="font-bold line-clamp-1">{o.product_title}</div>
                                                <div className="text-sm font-semibold text-muted">{o.quantity} шт · {o.total_price.toLocaleString('ru')} ₽</div>
                                                <div className="mt-1">{orderStatusBadge(o.status)}</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-border/60 text-sm grid gap-1">
                                            <div><span className="text-muted font-semibold">Покупатель:</span> <Link to={`/user/${o.counterparty_id}`} className="font-bold text-accent-bright hover:underline">{o.counterparty_name}</Link></div>
                                            {o.delivery_address && <div><span className="text-muted font-semibold">Адрес:</span> <span className="font-medium">{o.delivery_address}</span></div>}
                                            {o.contact_phone && <div><span className="text-muted font-semibold">Телефон:</span> <span className="font-medium">{o.contact_phone}</span></div>}
                                            {o.comment && <div><span className="text-muted font-semibold">Комментарий:</span> <span className="font-medium">{o.comment}</span></div>}
                                        </div>
                                        {['pending', 'confirmed'].includes(o.status) && (
                                            <div className="flex gap-2 mt-3 flex-wrap">
                                                {o.status === 'pending' && <button onClick={() => updateOrderStatus(o.id, 'confirmed')} className={`${btnPrimary} !py-2`}>Подтвердить</button>}
                                                {o.status === 'confirmed' && <button onClick={() => updateOrderStatus(o.id, 'shipped')} className={`${btnPrimary} !py-2`}>Отправить</button>}
                                                <button onClick={() => updateOrderStatus(o.id, 'cancelled')} className={`${btnGhost} !py-2`}>Отменить</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </>
            )}

            {editing && (
                <ProductFormModal
                    product={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); toast.success('Изменения сохранены'); fetchAll(); }}
                />
            )}

            {confirmDelete && (
                <ConfirmDialog
                    title="Удалить товар?"
                    message={`«${confirmDelete.title}» будет удалён без возможности восстановления.`}
                    confirmText="Удалить"
                    onConfirm={deleteProduct}
                    onClose={() => setConfirmDelete(null)}
                />
            )}

            {reviewFor && (
                <div className={modalOverlay} onClick={() => !reviewSaving && setReviewFor(null)}>
                    <div className={`${modalPanel} w-full max-w-md p-6`} onClick={(e) => e.stopPropagation()}>
                        <h2 className="font-display font-bold uppercase text-sm mb-1">Отзыв о товаре</h2>
                        <p className="text-muted font-semibold text-sm mb-4 line-clamp-1">{reviewFor.product_title}</p>
                        <div className="flex gap-1 mb-4">
                            {[1, 2, 3, 4, 5].map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setReviewRating(n)}
                                    className={`text-3xl leading-none transition ${n <= reviewRating ? 'text-star' : 'text-muted/30 hover:text-muted/60'}`}
                                    aria-label={`Оценка ${n}`}
                                >★</button>
                            ))}
                        </div>
                        <textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="Поделитесь впечатлениями (необязательно)"
                            rows={4}
                            className="w-full rounded-xl border border-border bg-surface-2 text-ink px-3 py-2 font-medium outline-none focus:border-accent transition resize-none mb-4"
                        />
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setReviewFor(null)} disabled={reviewSaving} className={`${btnGhost} !py-2`}>Отмена</button>
                            <button type="button" onClick={submitReview} disabled={reviewSaving} className={`${btnPrimary} !py-2`}>{reviewSaving ? 'Отправка...' : 'Отправить'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyProductsPage;

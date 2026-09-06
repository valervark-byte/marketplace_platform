import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import { Lightbox, useModalBehavior } from '../components/Dialogs';
import { getProductCategoryLabel } from '../lib/constants';
import { inputCls, labelCls, btnPrimary, btnGhost, modalOverlay, modalPanel } from '../lib/styles';

const parseJson = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };

const ProductDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuth } = useAuthStore();
    const toast = useToast();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [activeImg, setActiveImg] = useState(0);
    const [lightbox, setLightbox] = useState(null);
    const [favorited, setFavorited] = useState(false);
    const [reviews, setReviews] = useState([]);
    const [showOrder, setShowOrder] = useState(false);

    const orderRef = useModalBehavior(() => setShowOrder(false));

    // Форма заказа
    const [qty, setQty] = useState(1);
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [comment, setComment] = useState('');
    const [ordering, setOrdering] = useState(false);

    useEffect(() => {
        setLoading(true);
        setNotFound(false);
        api.get(`/products/${id}`)
            .then(res => {
                setProduct(res.data);
                return api.get(`/products/${id}/reviews`);
            })
            .then(res => setReviews(res.data))
            .catch(err => { if (err.response?.status === 404) setNotFound(true); })
            .finally(() => setLoading(false));
    }, [id]);

    const toggleFavorite = async () => {
        if (!isAuth) { toast.error('Войдите, чтобы добавить в избранное'); return; }
        try {
            const res = await api.post(`/products/${id}/favorite`);
            setFavorited(res.data.favorited);
        } catch { toast.error('Ошибка'); }
    };

    const submitOrder = async (e) => {
        e.preventDefault();
        setOrdering(true);
        try {
            await api.post(`/products/${id}/order`, {
                quantity: qty,
                delivery_address: address || null,
                contact_phone: phone || null,
                comment: comment || null,
            });
            toast.success('Заказ оформлен! Продавец скоро свяжется.');
            setShowOrder(false);
            navigate('/products/my?tab=purchases');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Ошибка оформления заказа');
        } finally {
            setOrdering(false);
        }
    };

    if (loading) {
        return <div className="max-w-5xl mx-auto px-4 py-10"><div className="animate-pulse grid md:grid-cols-2 gap-8"><div className="aspect-square bg-surface-2 rounded-2xl" /><div className="space-y-4"><div className="h-8 w-1/3 bg-surface-2 rounded" /><div className="h-6 w-2/3 bg-surface-2 rounded" /></div></div></div>;
    }
    if (notFound) {
        return <div className="max-w-xl mx-auto my-20 text-center px-4"><div className="font-display font-bold uppercase text-3xl">Товар не найден</div><Link to="/products" className={`${btnGhost} mt-6`}>← В каталог</Link></div>;
    }

    const images = parseJson(product.images, []);
    const specs = parseJson(product.specs, []);
    const isSold = product.status === 'sold' || product.stock <= 0;

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
            <Link to="/products" className="text-sm font-bold text-muted hover:text-accent-bright transition">← В каталог</Link>

            <div className="grid md:grid-cols-2 gap-8 mt-4">
                {/* Галерея */}
                <div>
                    <div className="aspect-square bg-surface-2 rounded-2xl overflow-hidden border border-border">
                        {images.length > 0 ? (
                            <img src={images[activeImg]} alt={product.title} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setLightbox({ images, index: activeImg })} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-6xl text-muted/40">📦</div>
                        )}
                    </div>
                    {images.length > 1 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                            {images.map((img, idx) => (
                                <img key={idx} src={img} alt={`${idx + 1}`} onClick={() => setActiveImg(idx)} className={`w-16 h-16 object-cover rounded-lg border cursor-pointer transition ${idx === activeImg ? 'border-accent' : 'border-border hover:border-border-bright'}`} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Инфо */}
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-surface-2 border border-border text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">{getProductCategoryLabel(product.category)}</span>
                        {product.condition === 'used' && <span className="rounded-full bg-surface-2 border border-border text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">Б/У</span>}
                        {isSold && <span className="rounded-full bg-danger/15 text-danger border border-danger/30 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">Продан</span>}
                    </div>

                    <h1 className="font-display font-bold text-2xl md:text-3xl mt-3">{product.title}</h1>
                    <div className="font-display font-extrabold text-3xl mt-3">{product.price.toLocaleString('ru')} ₽</div>

                    {product.city && <div className="text-sm font-semibold text-muted mt-2">📍 {product.city}</div>}
                    {product.stock > 0 && <div className="text-sm font-semibold text-muted mt-1">В наличии: {product.stock} шт.</div>}

                    {/* Продавец */}
                    <Link to={`/user/${product.seller_id}`} className="flex items-center gap-3 mt-5 p-3 rounded-xl border border-border bg-surface-2/60 hover:border-accent/50 transition">
                        {product.seller_avatar ? (
                            <img src={product.seller_avatar} alt="" className="w-11 h-11 rounded-lg object-cover" />
                        ) : (
                            <div className="w-11 h-11 rounded-lg bg-accent text-white font-display font-bold flex items-center justify-center">{(product.seller_name || 'П').charAt(0)}</div>
                        )}
                        <div>
                            <div className="font-bold">{product.seller_name}</div>
                            {product.seller_rating != null ? (
                                <div className="text-xs font-semibold text-muted">⭐ {product.seller_rating} · {product.seller_reviews_count} отзывов</div>
                            ) : (
                                <div className="text-xs font-semibold text-muted">Пока без отзывов</div>
                            )}
                        </div>
                    </Link>

                    <div className="flex gap-3 mt-5">
                        <button onClick={() => isAuth ? setShowOrder(true) : toast.error('Войдите, чтобы заказать')} disabled={isSold} className={`${btnPrimary} flex-1 ${isSold ? 'opacity-40 cursor-not-allowed' : ''}`}>
                            {isSold ? 'Нет в наличии' : 'Заказать'}
                        </button>
                        <button onClick={toggleFavorite} title="В избранное" className={`${btnGhost} px-4`}>{favorited ? '❤️' : '🤍'}</button>
                    </div>
                </div>
            </div>

            {/* Описание */}
            {product.description && (
                <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
                    <h2 className="font-display font-bold uppercase text-sm mb-3">Описание</h2>
                    <p className="text-ink/85 whitespace-pre-wrap break-words font-medium">{product.description}</p>
                </div>
            )}

            {/* Характеристики */}
            {specs.length > 0 && (
                <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
                    <h2 className="font-display font-bold uppercase text-sm mb-3">Характеристики</h2>
                    <div className="grid gap-2">
                        {specs.map((s, idx) => (
                            <div key={idx} className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
                                <span className="text-muted font-semibold">{s.key}</span>
                                <span className="font-bold text-right">{s.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Отзывы */}
            <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
                <h2 className="font-display font-bold uppercase text-sm mb-4">Отзывы ({reviews.length})</h2>
                {reviews.length === 0 ? (
                    <p className="text-muted font-semibold text-sm">Отзывов пока нет.</p>
                ) : (
                    <div className="flex flex-col gap-4">
                        {reviews.map(r => (
                            <div key={r.id} className="rounded-xl border border-border bg-surface-2/60 p-4">
                                <div className="flex justify-between items-center gap-3">
                                    <span className="font-bold">{r.author_name}</span>
                                    <span className="rounded-full bg-star/15 text-star border border-star/30 text-xs font-bold px-2 py-0.5">{'★'.repeat(r.rating)}</span>
                                </div>
                                {r.comment && <p className="text-sm text-ink/85 mt-2 font-medium">{r.comment}</p>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Модалка заказа */}
            {showOrder && (
                <div className={modalOverlay}>
                    <div ref={orderRef} tabIndex={-1} className={`${modalPanel} w-full max-w-md p-6 outline-none focus:ring-2 focus:ring-accent/50`}>
                        <h2 className="font-display font-bold uppercase text-xl">Оформление заказа</h2>
                        <div className="mt-2 text-sm font-semibold text-muted">{product.title}</div>
                        <form onSubmit={submitOrder} className="flex flex-col gap-4 mt-4">
                            <div>
                                <label className={labelCls}>Количество</label>
                                <input type="number" min="1" max={product.stock} value={qty} onChange={e => setQty(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Адрес доставки</label>
                                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Город, улица, дом, квартира" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Телефон для связи</label>
                                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (900) 123-45-67" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Комментарий</label>
                                <textarea rows="2" value={comment} onChange={e => setComment(e.target.value)} placeholder="Пожелания к заказу..." className={inputCls} />
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="font-display font-bold text-lg">Итого: {(product.price * qty).toLocaleString('ru')} ₽</span>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setShowOrder(false)} className={btnGhost}>Отмена</button>
                                <button type="submit" disabled={ordering} className={btnPrimary}>{ordering ? 'Оформление...' : 'Заказать'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {lightbox && (
                <Lightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} onNavigate={(i) => setLightbox({ ...lightbox, index: i })} />
            )}
        </div>
    );
};

export default ProductDetailPage;

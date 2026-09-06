import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import EmptyState from '../ui/EmptyState';
import ProductFormModal from '../components/ProductFormModal';
import {
    PRODUCT_CATEGORIES, PRODUCT_CONDITIONS, CITIES,
    getProductCategoryLabel,
} from '../lib/constants';
import { inputCls, btnPrimary, chipCls } from '../lib/styles';

const parseImages = (raw) => { try { return raw ? JSON.parse(raw) : []; } catch { return []; } };

const ProductCard = ({ product }) => {
    const images = parseImages(product.images);
    const cover = images[0];
    return (
        <Link to={`/products/${product.id}`} className="group rounded-2xl border border-border bg-surface overflow-hidden shadow-card transition hover:border-accent/50 hover:-translate-y-0.5">
            <div className="aspect-square bg-surface-2 overflow-hidden">
                {cover ? (
                    <img src={cover} alt={product.title} className="w-full h-full object-cover transition group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-muted/40">📦</div>
                )}
            </div>
            <div className="p-3">
                <div className="font-display font-bold text-lg">{product.price.toLocaleString('ru')} ₽</div>
                <div className="text-sm font-semibold text-ink/90 line-clamp-2 mt-0.5">{product.title}</div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {product.condition === 'used' && <span className="text-[10px] font-bold uppercase tracking-wider text-muted rounded-full border border-border px-2 py-0.5">Б/У</span>}
                    {product.city && <span className="text-[10px] font-bold text-muted truncate">📍 {product.city}</span>}
                </div>
            </div>
        </Link>
    );
};

const ProductsPage = () => {
    const { isAuth } = useAuthStore();
    const toast = useToast();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [city, setCity] = useState('');
    const [cityInput, setCityInput] = useState('');
    const [condition, setCondition] = useState('');
    const [priceMin, setPriceMin] = useState('');
    const [priceMax, setPriceMax] = useState('');
    const [sort, setSort] = useState('new');
    const [cityOptions, setCityOptions] = useState(CITIES);
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        const t = setTimeout(() => setCity(cityInput.trim()), 400);
        return () => clearTimeout(t);
    }, [cityInput]);

    const fetchProducts = () => {
        setLoading(true);
        const params = {};
        if (category) params.category = category;
        if (search) params.search = search;
        if (city) params.city = city;
        if (condition) params.condition = condition;
        if (priceMin) params.price_min = parseInt(priceMin);
        if (priceMax) params.price_max = parseInt(priceMax);
        if (sort) params.sort = sort;
        api.get('/products', { params })
            .then(res => setProducts(res.data))
            .catch(() => setProducts([]))
            .finally(() => setLoading(false));
    };

    useEffect(fetchProducts, [category, search, city, condition, priceMin, priceMax, sort]);

    useEffect(() => {
        api.get('/products/cities')
            .then(res => {
                const merged = Array.from(new Set([...CITIES, ...(res.data.cities || [])])).sort((a, b) => a.localeCompare(b, 'ru'));
                setCityOptions(merged);
            })
            .catch(() => {});
    }, []);

    return (
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                <h1 className="font-display font-extrabold uppercase text-2xl md:text-3xl">Товары</h1>
                {isAuth && (
                    <div className="flex gap-3">
                        <Link to="/products/my" className="inline-flex items-center gap-2 rounded-xl bg-surface-2 text-ink border border-border px-4 py-2.5 font-display text-xs uppercase tracking-wider transition hover:border-border-bright">
                            Мои товары
                        </Link>
                        <button onClick={() => setShowCreate(true)} className={btnPrimary}>+ Разместить товар</button>
                    </div>
                )}
            </div>

            {/* Категории */}
            <div className="flex gap-2 flex-wrap mb-5">
                <button onClick={() => setCategory('')} className={chipCls(category === '')}>Все</button>
                {PRODUCT_CATEGORIES.map(c => (
                    <button key={c.value} onClick={() => setCategory(c.value)} className={chipCls(category === c.value)}>{c.label}</button>
                ))}
            </div>

            {/* Фильтры */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                <input type="text" placeholder="🔍 Поиск..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className={`${inputCls} col-span-2`} />
                <div className="relative">
                    <input
                        type="text"
                        list="products-city-options"
                        placeholder="Все города"
                        value={cityInput}
                        onChange={e => setCityInput(e.target.value)}
                        className={`${inputCls} pr-8`}
                    />
                    <datalist id="products-city-options">
                        {cityOptions.map(c => <option key={c} value={c} />)}
                    </datalist>
                    {cityInput && (
                        <button
                            type="button"
                            onClick={() => { setCityInput(''); setCity(''); }}
                            title="Сбросить город"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink font-bold text-lg leading-none"
                        >×</button>
                    )}
                </div>
                <select value={condition} onChange={e => setCondition(e.target.value)} className={inputCls}>
                    <option value="">Любое</option>
                    {PRODUCT_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input type="number" placeholder="Цена от" value={priceMin} onChange={e => setPriceMin(e.target.value)} className={inputCls} />
                <input type="number" placeholder="Цена до" value={priceMax} onChange={e => setPriceMax(e.target.value)} className={inputCls} />
            </div>

            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <span className="text-sm font-bold text-muted">{loading ? 'Загрузка...' : `Найдено: ${products.length}`}</span>
                <select value={sort} onChange={e => setSort(e.target.value)} className="rounded-xl border border-border bg-surface-2 text-ink px-3 py-2 font-semibold text-sm outline-none focus:border-accent">
                    <option value="new">Сначала новые</option>
                    <option value="price_asc">Дешевле</option>
                    <option value="price_desc">Дороже</option>
                    <option value="popular">Популярные</option>
                </select>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-border bg-surface overflow-hidden animate-pulse">
                            <div className="aspect-square bg-surface-2" />
                            <div className="p-3"><div className="h-5 w-1/2 bg-surface-2 rounded mb-2" /><div className="h-4 w-3/4 bg-surface-2 rounded" /></div>
                        </div>
                    ))}
                </div>
            ) : products.length === 0 ? (
                <EmptyState icon="📦" title="Товаров не найдено" description="Попробуйте изменить фильтры или разместите первый товар." />
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {products.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
            )}

            {showCreate && (
                <ProductFormModal
                    onClose={() => setShowCreate(false)}
                    onSaved={() => { setShowCreate(false); toast.success('Товар размещён'); fetchProducts(); }}
                />
            )}
        </div>
    );
};

export default ProductsPage;

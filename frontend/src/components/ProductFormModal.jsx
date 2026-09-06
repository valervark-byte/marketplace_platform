import React, { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from './Toast';
import { useModalBehavior } from './Dialogs';
import { CitySelect } from './CitySelect';
import { PRODUCT_CATEGORIES, PRODUCT_CONDITIONS } from '../lib/constants';
import { inputCls, labelCls, btnPrimary, btnGhost, modalOverlay, modalPanel } from '../lib/styles';

const parseJson = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };

// Модалка создания/редактирования товара. Если передан product — режим редактирования.
const ProductFormModal = ({ product, onClose, onSaved }) => {
    const toast = useToast();
    const panelRef = useModalBehavior(onClose);
    const editing = !!product;

    const [title, setTitle] = useState(product?.title || '');
    const [description, setDescription] = useState(product?.description || '');
    const [price, setPrice] = useState(product?.price != null ? String(product.price) : '');
    const [category, setCategory] = useState(product?.category || 'other');
    const [condition, setCondition] = useState(product?.condition || 'new');
    const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : '1');
    const [city, setCity] = useState(product?.city || '');
    const [images, setImages] = useState(parseJson(product?.images, []));
    const [specs, setSpecs] = useState(parseJson(product?.specs, []));
    const [status, setStatus] = useState(product?.status || 'active');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        if (images.length + files.length > 8) {
            toast.error('Максимум 8 фотографий');
            return;
        }
        setUploading(true);
        try {
            const urls = await Promise.all(files.map(async (file) => {
                const fd = new FormData();
                fd.append('file', file);
                const res = await api.post('/upload/task-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                return res.data.url;
            }));
            setImages([...images, ...urls]);
        } catch (err) {
            toast.error('Ошибка загрузки: ' + (err.response?.data?.detail || err.message));
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removeImage = (idx) => setImages(images.filter((_, i) => i !== idx));

    const addSpec = () => setSpecs([...specs, { key: '', value: '' }]);
    const updateSpec = (idx, field, val) => {
        const next = [...specs];
        next[idx][field] = val;
        setSpecs(next);
    };
    const removeSpec = (idx) => setSpecs(specs.filter((_, i) => i !== idx));

    const handleSubmit = async (e, saveAsDraft = false) => {
        e.preventDefault();
        if (!title.trim()) { toast.error('Укажите название'); return; }
        if (price === '' || parseInt(price) < 0) { toast.error('Укажите цену'); return; }
        setSaving(true);
        const cleanSpecs = specs.filter(s => s.key.trim() && s.value.trim());
        const payload = {
            title: title.trim(),
            description: description || null,
            price: parseInt(price),
            category,
            condition,
            stock: parseInt(stock) || 0,
            city: city || null,
            images: images.length ? JSON.stringify(images) : null,
            specs: cleanSpecs.length ? JSON.stringify(cleanSpecs) : null,
            status: saveAsDraft ? 'draft' : (status === 'draft' ? 'active' : status),
        };
        try {
            if (editing) {
                await api.put(`/products/${product.id}`, payload);
            } else {
                await api.post('/products', payload);
            }
            onSaved();
        } catch (err) {
            toast.error('Ошибка сохранения: ' + (err.response?.data?.detail || err.message));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`${modalOverlay} overflow-y-auto`}>
            <div ref={panelRef} tabIndex={-1} className={`${modalPanel} w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto my-4 p-6 md:p-8 outline-none focus:ring-2 focus:ring-accent/50`}>
                <h2 className="font-display font-bold uppercase text-xl md:text-2xl">{editing ? 'Редактировать товар' : 'Новый товар'}</h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
                    <div>
                        <label className={labelCls}>Название *</label>
                        <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="iPhone 15 Pro 256 ГБ" className={inputCls} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Цена (₽) *</label>
                            <input type="number" required min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="50000" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Количество</label>
                            <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className={inputCls} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Категория</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                                {PRODUCT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Состояние</label>
                            <select value={condition} onChange={e => setCondition(e.target.value)} className={inputCls}>
                                {PRODUCT_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Город</label>
                        <CitySelect value={city} onChange={setCity} />
                    </div>

                    <div>
                        <label className={labelCls}>Описание</label>
                        <textarea rows="4" value={description} onChange={e => setDescription(e.target.value)} placeholder="Опишите товар, состояние, комплектацию..." className={inputCls} />
                    </div>

                    {/* Фотографии */}
                    <div>
                        <label className={labelCls}>Фотографии (до 8)</label>
                        {images.length > 0 && (
                            <div className="grid grid-cols-4 gap-3 mb-3">
                                {images.map((url, idx) => (
                                    <div key={idx} className="relative group">
                                        <img src={url} alt={`Фото ${idx + 1}`} className="w-full h-20 object-cover rounded-lg border border-border" />
                                        <button type="button" onClick={() => removeImage(idx)} title="Удалить" className="absolute -top-2 -right-2 bg-danger text-white w-6 h-6 rounded-full font-extrabold text-xs flex items-center justify-center transition hover:scale-110">×</button>
                                        {idx === 0 && <span className="absolute bottom-1 left-1 bg-accent text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">Обложка</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {images.length < 8 && (
                            <label className={`${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'} flex items-center justify-center gap-2 rounded-xl border border-dashed border-border-bright/60 p-4 hover:border-accent/60 transition`}>
                                {uploading ? <span className="font-bold text-muted">⏳ Загрузка...</span> : <><span className="text-2xl">📷</span><span className="font-bold">Добавить фото</span></>}
                                <input type="file" accept="image/*" multiple onChange={handleImageUpload} disabled={uploading} className="hidden" />
                            </label>
                        )}
                    </div>

                    {/* Характеристики */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelCls}>Характеристики</label>
                            <button type="button" onClick={addSpec} className="text-accent-bright font-bold text-xs uppercase tracking-wider hover:underline">+ Добавить</button>
                        </div>
                        {specs.map((s, idx) => (
                            <div key={idx} className="flex gap-2 mb-2">
                                <input type="text" value={s.key} onChange={e => updateSpec(idx, 'key', e.target.value)} placeholder="Параметр" className={`${inputCls} flex-1`} />
                                <input type="text" value={s.value} onChange={e => updateSpec(idx, 'value', e.target.value)} placeholder="Значение" className={`${inputCls} flex-1`} />
                                <button type="button" onClick={() => removeSpec(idx)} className="shrink-0 w-11 rounded-xl border border-border bg-surface-2 text-danger font-extrabold hover:border-danger/60 transition">×</button>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border flex-wrap">
                        <button type="button" onClick={onClose} className={btnGhost}>Отмена</button>
                        {!editing && (
                            <button type="button" onClick={(e) => handleSubmit(e, true)} disabled={saving} className={btnGhost}>В черновики</button>
                        )}
                        <button type="submit" disabled={saving} className={btnPrimary}>
                            {saving ? 'Сохранение...' : editing ? 'Сохранить' : 'Опубликовать'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductFormModal;

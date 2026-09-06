import React, { useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import { useModalBehavior } from '../components/Dialogs';
import { CATEGORIES } from '../lib/constants';
import { CitySelect } from '../components/CitySelect';
import { inputCls, labelCls, btnPrimary, btnGhost, modalOverlay, modalPanel } from '../lib/styles';

const CreateTaskModal = ({ onClose, onTaskCreated }) => {
    const { token } = useAuthStore();
    const toast = useToast();
    const panelRef = useModalBehavior(onClose);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [category, setCategory] = useState('other');
    const [city, setCity] = useState('');
    const [address, setAddress] = useState('');
    const [deadline, setDeadline] = useState('');
    const [isRemote, setIsRemote] = useState(false);
    const [uploadedImages, setUploadedImages] = useState([]);
    const [uploading, setUploading] = useState(false);

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Limit to 5 images
        if (uploadedImages.length + files.length > 5) {
            toast.error('Максимум 5 фотографий для задачи');
            return;
        }

        setUploading(true);
        try {
            const uploadPromises = files.map(async (file) => {
                const formData = new FormData();
                formData.append('file', file);
                const res = await api.post('/upload/task-image', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                return res.data.url;
            });

            const urls = await Promise.all(uploadPromises);
            setUploadedImages([...uploadedImages, ...urls]);
        } catch (err) {
            toast.error('Ошибка загрузки изображений: ' + (err.response?.data?.detail || err.message));
        } finally {
            setUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const removeImage = (index) => {
        setUploadedImages(uploadedImages.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/tasks/',
                {
                    title,
                    description,
                    budget: parseInt(budget) || 0,
                    category,
                    city: city || null,
                    address: address || null,
                    deadline: deadline || null,
                    is_remote: isRemote,
                    images: uploadedImages.length > 0 ? JSON.stringify(uploadedImages) : null
                }
            );
            onTaskCreated();
            onClose();
        } catch (err) {
            toast.error('Ошибка при создании заказа: ' + (err.response?.data?.detail || err.message));
        }
    };

    return (
        <div className={`${modalOverlay} overflow-y-auto`}>
            <div ref={panelRef} tabIndex={-1} className={`${modalPanel} w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto my-4 p-6 md:p-8 outline-none focus:ring-2 focus:ring-accent/50`}>
                <h2 className="font-display font-bold uppercase text-xl md:text-2xl">Новый заказ</h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
                    <div>
                        <label className={labelCls}>Заголовок *</label>
                        <input type="text" placeholder="Например: Создать логотип для стартапа" required value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
                    </div>

                    <div>
                        <label className={labelCls}>Описание *</label>
                        <textarea placeholder="Подробно опишите задачу, требования и желаемый результат..." required rows="4" value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Бюджет (₽) *</label>
                            <input type="number" placeholder="10000" required value={budget} onChange={e => setBudget(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Категория *</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                                {CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <label className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3.5 cursor-pointer select-none transition hover:border-border-bright">
                        <input type="checkbox" id="isRemote" checked={isRemote} onChange={e => setIsRemote(e.target.checked)} className="w-5 h-5 accent-accent" />
                        <span className="text-sm font-bold">Можно выполнить удалённо 🌐</span>
                    </label>

                    {!isRemote && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 dot-grid rounded-xl border border-border bg-surface/60">
                            <div className="md:col-span-2">
                                <h3 className="font-display font-bold uppercase text-sm">📍 Место выполнения</h3>
                            </div>
                            <div>
                                <label className={labelCls}>Город</label>
                                <CitySelect value={city} onChange={setCity} />
                            </div>
                            <div>
                                <label className={labelCls}>Адрес</label>
                                <input type="text" placeholder="ул. Ленина, д. 10" value={address} onChange={e => setAddress(e.target.value)} className={inputCls} />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className={labelCls}>Срок выполнения</label>
                        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
                    </div>

                    {/* Image upload section */}
                    <div className="border-t border-border pt-4">
                        <label className={labelCls}>Фото задачи (до 5 штук)</label>

                        {uploadedImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-3 mb-3 mt-1">
                                {uploadedImages.map((url, idx) => (
                                    <div key={idx} className="relative group">
                                        <img src={url} alt={`Task ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border border-border" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            title="Удалить фото"
                                            className="absolute -top-2 -right-2 bg-danger text-white w-7 h-7 rounded-full font-extrabold text-sm flex items-center justify-center transition hover:scale-110"
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {uploadedImages.length < 5 && (
                            <label className={`${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'} flex items-center justify-center gap-2 rounded-xl border border-dashed border-border-bright/60 p-4 hover:border-accent/60 hover:bg-surface-2/60 transition`}>
                                {uploading ? (
                                    <span className="font-bold text-muted">⏳ Загрузка...</span>
                                ) : (
                                    <>
                                        <span className="text-2xl">📷</span>
                                        <span className="font-bold">Добавить фото</span>
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    disabled={uploading}
                                    className="hidden"
                                />
                            </label>
                        )}
                        <p className="text-xs text-muted mt-1 font-semibold">JPG, PNG, GIF, WebP до 5 МБ каждое</p>
                    </div>

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                        <button type="button" onClick={onClose} className={btnGhost}>Отмена</button>
                        <button type="submit" className={btnPrimary}>Создать заказ</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTaskModal;

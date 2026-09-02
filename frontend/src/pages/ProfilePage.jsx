import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import { useModalBehavior } from '../components/Dialogs';
import { AvatarUploader, PortfolioUploader } from '../components/ImageUploader';
import ProBadge from '../ui/ProBadge';
import { CITIES } from '../lib/constants';
import { inputCls, labelCls, btnPrimary, btnGhost, btnSignal, modalOverlay, modalPanel } from '../lib/styles';

const getInitial = (name, email) => {
    const src = (name && name.trim()) || email || '?';
    return src.trim().charAt(0).toUpperCase();
};

const ProfilePage = () => {
    const { token, role } = useAuthStore();
    const toast = useToast();
    const depositRef = useModalBehavior(() => { if (showDepositModal) setShowDepositModal(false); });
    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [city, setCity] = useState('');
    const [phone, setPhone] = useState('');
    const [skills, setSkills] = useState('');
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState('');
    const [rating, setRating] = useState(null);
    const [balance, setBalance] = useState(0);
    const [completedTasks, setCompletedTasks] = useState(0);
    const [verified, setVerified] = useState(false);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [depositAmount, setDepositAmount] = useState('');
    const [avatar, setAvatar] = useState('');
    const [portfolio, setPortfolio] = useState([]);
    const [paymentsConfigured, setPaymentsConfigured] = useState(false);
    const [responseCredits, setResponseCredits] = useState(0);
    const [isPro, setIsPro] = useState(false);
    const [proUntil, setProUntil] = useState(null);
    const [packages, setPackages] = useState([]);
    const [paymentProcessing, setPaymentProcessing] = useState(false);

    const fetchProfile = () => {
        api.get('/users/me')
            .then(res => {
                setName(res.data.name || '');
                setBio(res.data.bio || '');
                setCity(res.data.city || '');
                setPhone(res.data.phone || '');
                setSkills(res.data.skills || '');
                setEmail(res.data.email);
                setRating(res.data.rating);
                setBalance(res.data.balance || 0);
                setCompletedTasks(res.data.completed_tasks || 0);
                setVerified(res.data.verified || false);
                setAvatar(res.data.avatar || '');
                setPortfolio(res.data.portfolio ? JSON.parse(res.data.portfolio) : []);
                setResponseCredits(res.data.response_credits ?? 0);
                setIsPro(res.data.is_pro || false);
                setProUntil(res.data.pro_until || null);
            })
            .catch(err => console.error("Error fetching profile", err));
    };

    const buyPackage = async (packageId) => {
        try {
            const res = await api.post('/monetization/buy',
                { package_id: packageId }
            );
            toast.success(res.data.message);
            fetchProfile();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Ошибка покупки');
        }
    };

    useEffect(() => {
        fetchProfile();

        // Пакеты монетизации для специалистов
        if (role === 'specialist') {
            api.get('/monetization/packages')
                .then(res => setPackages(res.data.packages))
                .catch(() => {});
        }

        // Check if real payments are configured
        api.get('/payments/status')
            .then(res => setPaymentsConfigured(res.data.configured))
            .catch(() => setPaymentsConfigured(false));

        // Handle return from YooKassa payment
        const params = new URLSearchParams(window.location.search);
        const paymentId = params.get('payment_id');
        if (paymentId) {
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
            api.post(`/payments/confirm?payment_id=${paymentId}`, {}).then(res => {
                if (res.data.credited) {
                    setMsg('Оплата прошла успешно! Баланс пополнен.');
                    fetchProfile();
                } else if (res.data.status === 'succeeded') {
                    setMsg('Этот платёж уже был зачислен.');
                } else {
                    setMsg('Платёж не завершён. Попробуйте ещё раз.');
                }
                setTimeout(() => setMsg(''), 5000);
            }).catch(() => {
                setMsg('Не удалось проверить статус платежа.');
                setTimeout(() => setMsg(''), 5000);
            });
        }
    }, [token]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await api.put('/users/me', { name, bio, city, phone, skills });
            setMsg('Профиль успешно сохранен!');
            setTimeout(() => setMsg(''), 3000);
        } catch (err) {
            setMsg('Ошибка сохранения профиля');
        }
    };

    // Demo top-up (instant, no real payment)
    const handleDemoDeposit = async () => {
        if (!depositAmount || depositAmount <= 0) return;
        try {
            await api.post('/wallet/deposit', { amount: parseInt(depositAmount) });
            toast.success('Баланс успешно пополнен (демо)!');
            setShowDepositModal(false);
            setDepositAmount('');
            fetchProfile();
        } catch (err) {
            toast.error('Ошибка пополнения баланса');
        }
    };

    // Real payment via YooKassa
    const handleRealPayment = async () => {
        if (!depositAmount || depositAmount <= 0) return;
        setPaymentProcessing(true);
        try {
            const res = await api.post('/payments/create', { amount: parseInt(depositAmount) });
            // Redirect user to YooKassa payment page
            window.location.href = res.data.confirmation_url;
        } catch (err) {
            toast.error('Ошибка создания платежа: ' + (err.response?.data?.detail || err.message));
            setPaymentProcessing(false);
        }
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        if (paymentsConfigured) {
            await handleRealPayment();
        } else {
            await handleDemoDeposit();
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
            <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
                {/* Header panel */}
                <div className="border-b border-border p-6 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        {avatar ? (
                            <img src={avatar} alt="Аватар" className="w-20 h-20 object-cover rounded-xl border border-border" />
                        ) : (
                            <div className="w-20 h-20 bg-accent text-white font-display font-bold text-3xl flex items-center justify-center rounded-xl">
                                {getInitial(name, email)}
                            </div>
                        )}
                        <div>
                            <h1 className="font-display font-bold uppercase text-xl md:text-2xl flex items-center gap-2">
                                Мой профиль
                                {verified && <span className="text-accent-bright" title="Проверенный пользователь">✓</span>}
                            </h1>
                            <span className="inline-block mt-2 bg-surface-2 text-ink text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-border">
                                {role === 'specialist' ? '🛠 Специалист' : '🤝 Заказчик'}
                            </span>
                        </div>
                    </div>
                    <div className="bg-surface-2 border border-border rounded-xl px-4 py-2 font-display text-sm flex items-center gap-3">
                        <span>{balance} ₽</span>
                        <button type="button" onClick={() => setShowDepositModal(true)} className="bg-accent text-white w-7 h-7 rounded-full flex items-center justify-center font-extrabold hover:bg-accent-bright transition" title="Пополнить баланс">+</button>
                    </div>
                </div>

                {msg && <div className="m-6 mb-0 rounded-xl border border-border bg-surface-2 p-3 font-bold text-sm">{msg}</div>}

                {role === 'specialist' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 pb-0">
                        {rating !== null && (
                            <div className="rounded-xl border border-border bg-surface-2/60 p-4 flex items-center gap-4">
                                <span className="text-3xl">⭐</span>
                                <div>
                                    <div className="font-display font-bold text-xl">{rating} / 5</div>
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Ваш рейтинг</div>
                                </div>
                            </div>
                        )}
                        <div className="rounded-xl border border-border bg-surface-2/60 p-4 flex items-center gap-4">
                            <span className="text-3xl">📋</span>
                            <div>
                                <div className="font-display font-bold text-xl">{completedTasks}</div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Выполнено заказов</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Avatar Uploader */}
                <div className="p-6 border-b border-border/60">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">Аватар</div>
                    <AvatarUploader
                        token={token}
                        currentAvatar={avatar}
                        onUploadSuccess={(url) => {
                            setAvatar(url);
                            setMsg('Аватар успешно обновлён!');
                            setTimeout(() => setMsg(''), 3000);
                        }}
                    />
                </div>

                {/* Portfolio for specialists */}
                {role === 'specialist' && (
                    <div className="p-6 border-b border-border/60">
                        <PortfolioUploader
                            token={token}
                            portfolio={portfolio}
                            onUploadSuccess={(url) => {
                                setPortfolio([...portfolio, url]);
                                setMsg('Работа добавлена в портфолио!');
                                setTimeout(() => setMsg(''), 3000);
                            }}
                        />
                    </div>
                )}

                {/* Монетизация: пакеты откликов и PRO */}
                {role === 'specialist' && (
                    <div className="p-6 border-b border-border/60 dot-grid">
                        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                            <h3 className="font-display font-bold uppercase text-sm">Отклики и PRO</h3>
                            {isPro ? (
                                <span className="text-xs font-bold"><ProBadge /> <span className="ml-2 text-muted">до {(proUntil || '').slice(0, 10)} · отклики безлимит</span></span>
                            ) : (
                                <span className="text-xs font-bold uppercase tracking-wider text-muted">Осталось откликов: {responseCredits}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {packages.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => buyPackage(p.id)}
                                    className={`rounded-xl border p-4 text-left transition ${p.type === 'pro' ? 'border-star/40 bg-star/10 hover:border-star/70' : 'border-border bg-surface-2/60 hover:border-accent/50'}`}
                                >
                                    <div className="font-bold flex items-center gap-2">{p.type === 'pro' && <ProBadge />}{p.title}</div>
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted mt-1">
                                        {p.type === 'responses' ? `${p.credits} откликов` : 'Безлимит откликов · приоритет в списке · значок PRO'}
                                    </div>
                                    <div className="font-display font-bold text-lg mt-2">{p.price} ₽ <span className="font-sans text-[11px] font-bold text-muted uppercase tracking-wider">с баланса</span></div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSave} className="flex flex-col gap-5 p-6">
                    <div>
                        <label className={labelCls}>Ваш Email (Логин)</label>
                        <input type="text" value={email} disabled className="w-full rounded-xl border border-border bg-surface/80 p-3 text-muted cursor-not-allowed font-semibold" />
                    </div>
                    <div>
                        <label className={labelCls}>Имя / Название компании</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Город</label>
                            <select value={city} onChange={e => setCity(e.target.value)} className={inputCls}>
                                <option value="">Выберите город</option>
                                {CITIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Телефон</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (900) 123-45-67" className={inputCls} />
                        </div>
                    </div>
                    {role === 'specialist' && (
                        <div>
                            <label className={labelCls}>Навыки и специализации</label>
                            <input type="text" value={skills} onChange={e => setSkills(e.target.value)} placeholder="HTML, CSS, JavaScript, React, Node.js" className={inputCls} />
                            <p className="text-xs text-muted mt-1 font-semibold">Перечислите через запятую</p>
                        </div>
                    )}
                    <div>
                        <label className={labelCls}>О себе / Описание услуг</label>
                        <textarea rows="4" value={bio} onChange={e => setBio(e.target.value)} placeholder={role === 'specialist' ? 'Расскажите о своих навыках и опыте...' : 'Расскажите о вашей компании...'} className={inputCls}></textarea>
                    </div>
                    <button type="submit" className={`${btnPrimary} w-full`}>Сохранить изменения</button>
                </form>
            </div>

            {/* Deposit Modal */}
            {showDepositModal && (
                <div className={modalOverlay}>
                    <div ref={depositRef} tabIndex={-1} className={`${modalPanel} w-full max-w-sm p-6 outline-none focus:ring-2 focus:ring-accent/50`}>
                        <h2 className="font-display font-bold uppercase text-xl">💰 Пополнить баланс</h2>

                        <div className="mt-4 mb-4 p-3 rounded-xl border border-border bg-surface-2 text-sm font-bold">
                            {paymentsConfigured
                                ? '💳 Оплата картой через ЮKassa'
                                : '⚙️ Демо-режим: баланс пополнится мгновенно без реальной оплаты'}
                        </div>

                        <form onSubmit={handleDeposit} className="flex flex-col gap-4">
                            <input type="number" placeholder="Сумма (₽)" required min="1" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} disabled={paymentProcessing} className={inputCls} />

                            <div className="flex gap-2 flex-wrap">
                                {[500, 1000, 5000].map(sum => (
                                    <button key={sum} type="button" onClick={() => setDepositAmount(String(sum))} className="px-3 py-1.5 rounded-lg border border-border bg-surface-2 font-bold text-sm transition hover:border-accent/60">
                                        {sum} ₽
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-end gap-3 mt-2">
                                <button type="button" onClick={() => setShowDepositModal(false)} disabled={paymentProcessing} className={btnGhost}>Отмена</button>
                                <button type="submit" disabled={paymentProcessing} className={btnSignal}>
                                    {paymentProcessing ? 'Переход к оплате...' : (paymentsConfigured ? 'Перейти к оплате' : 'Пополнить')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;

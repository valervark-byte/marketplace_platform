import React, { useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import { useModalBehavior } from '../components/Dialogs';
import { inputCls, btnPrimary, modalOverlay, modalPanel } from '../lib/styles';

const AuthModal = ({ onClose }) => {
    const { login } = useAuthStore();
    const toast = useToast();
    const panelRef = useModalBehavior(onClose);
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('customer');
    const [error, setError] = useState('');
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotMsg, setForgotMsg] = useState('');

    const handleForgot = async (e) => {
        e.preventDefault();
        setForgotMsg('');
        try {
            const res = await api.post('/auth/forgot-password', { email: forgotEmail });
            setForgotMsg(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Ошибка отправки');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                const params = new URLSearchParams();
                params.append('username', email);
                params.append('password', password);

                const res = await api.post('/login', params);
                login(res.data.access_token, res.data.role, res.data.roles);
                onClose();
            } else {
                await api.post('/register/', { email, password, role, name: name || null });
                setIsLogin(true);
                setError('Успешная регистрация! Теперь войдите.');
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Ошибка авторизации');
        }
    };

    return (
        <div className={modalOverlay}>
            <div ref={panelRef} tabIndex={-1} className={`${modalPanel} w-full max-w-sm p-6 md:p-8 outline-none focus:ring-2 focus:ring-accent/50`}>
                <h2 className="font-display font-bold uppercase text-xl text-center">{forgotMode ? 'Сброс пароля' : isLogin ? 'Вход' : 'Регистрация'}</h2>
                {error && !forgotMode && <div className="mt-4 rounded-xl border border-danger/40 bg-danger/10 text-danger p-3 font-bold text-sm">{error}</div>}

                {forgotMode ? (
                    <form onSubmit={handleForgot} className="flex flex-col gap-4 mt-6">
                        <p className="text-sm font-semibold text-muted">Введите e-mail - пришлём ссылку для сброса пароля (действует 1 час).</p>
                        <input type="email" placeholder="Email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className={inputCls} />
                        <button type="submit" className={`${btnPrimary} w-full mt-2`}>Отправить ссылку</button>
                        {forgotMsg && <div className="rounded-xl border border-border bg-surface-2 p-3 font-bold text-sm">{forgotMsg}</div>}
                        <button type="button" onClick={() => { setForgotMode(false); setForgotMsg(''); }} className="text-accent-bright font-bold text-xs uppercase tracking-wider hover:underline underline-offset-4">
                            ← Вернуться ко входу
                        </button>
                    </form>
                ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
                    {!isLogin && (
                        <input type="text" placeholder="Имя (как вас называть)" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                    )}
                    <input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                    <input type="password" placeholder="Пароль" required value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />

                    {!isLogin && (
                        <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
                            <option value="customer">Заказчик</option>
                            <option value="specialist">Специалист</option>
                        </select>
                    )}

                    <button type="submit" className={`${btnPrimary} w-full mt-2`}>
                        {isLogin ? 'Войти' : 'Зарегистрироваться'}
                    </button>

                    <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-accent-bright font-bold text-xs uppercase tracking-wider mt-2 hover:underline underline-offset-4">
                        {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
                    </button>

                    {isLogin && (
                        <button type="button" onClick={() => { setForgotMode(true); setError(''); }} className="text-muted hover:text-ink font-bold text-xs underline underline-offset-4 transition">
                            Забыли пароль?
                        </button>
                    )}
                </form>
                )}
                <button onClick={onClose} className="mt-6 text-muted hover:text-ink font-bold text-xs uppercase tracking-widest w-full text-center transition">Закрыть</button>
            </div>
        </div>
    );
};

export default AuthModal;

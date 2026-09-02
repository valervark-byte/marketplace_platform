import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { inputCls, btnPrimary, btnGhost } from '../lib/styles';

const ResetPasswordPage = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const toast = useToast();
    const token = params.get('token');
    const [pw1, setPw1] = useState('');
    const [pw2, setPw2] = useState('');
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (pw1.length < 6) return toast.error('Пароль должен быть не короче 6 символов');
        if (pw1 !== pw2) return toast.error('Пароли не совпадают');
        setBusy(true);
        try {
            await api.post('/auth/reset-password', { token, new_password: pw1 });
            toast.success('Пароль обновлён! Войдите с новым паролем.');
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Ошибка');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="max-w-md mx-auto px-4 py-16">
            <div className="bg-surface border border-border rounded-2xl shadow-pop p-8">
                <h1 className="font-display font-bold uppercase text-xl text-center">Новый пароль</h1>
                {!token ? (
                    <>
                        <p className="mt-4 text-muted font-semibold text-sm text-center">Ссылка недействительна - в ней нет ключа сброса.</p>
                        <Link to="/" className={`${btnGhost} w-full mt-6`}>На главную</Link>
                    </>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
                        <input type="password" placeholder="Новый пароль" required value={pw1} onChange={e => setPw1(e.target.value)} className={inputCls} />
                        <input type="password" placeholder="Повторите пароль" required value={pw2} onChange={e => setPw2(e.target.value)} className={inputCls} />
                        <button type="submit" disabled={busy} className={`${btnPrimary} w-full mt-2 disabled:opacity-50`}>
                            {busy ? 'Сохранение...' : 'Сохранить пароль'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPasswordPage;

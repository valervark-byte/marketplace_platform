import React, { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from './Toast';

const ROLE_META = {
    customer: { label: 'Заказчик', icon: '🤝' },
    specialist: { label: 'Специалист', icon: '🛠' },
};

// Переключатель активной роли в шапке. Позволяет сменить роль и добавить недостающую.
export const RoleSwitcher = () => {
    const { role, roles, setRole } = useAuthStore();
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const availableRoles = roles && roles.length ? roles : [role];
    const missingRole = ['customer', 'specialist'].find(r => !availableRoles.includes(r));

    const doSwitch = async (target) => {
        if (target === role || busy) return;
        setBusy(true);
        try {
            const res = await api.post('/users/me/switch-role', { role: target });
            setRole(res.data.access_token, res.data.role, res.data.roles);
            toast.success(`Режим: ${ROLE_META[target].label}`);
            setOpen(false);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Не удалось переключить роль');
        } finally {
            setBusy(false);
        }
    };

    const doAdd = async (target) => {
        if (busy) return;
        setBusy(true);
        try {
            const res = await api.post('/users/me/add-role', { role: target });
            setRole(res.data.access_token, res.data.role, res.data.roles);
            toast.success(`Роль добавлена: ${ROLE_META[target].label}`);
            setOpen(false);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Не удалось добавить роль');
        } finally {
            setBusy(false);
        }
    };

    const current = ROLE_META[role] || ROLE_META.customer;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 rounded-full bg-surface-2 border border-border text-ink text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 hover:border-accent/60 transition"
            >
                <span>{current.icon} {current.label}</span>
                <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface border border-border shadow-card z-50 overflow-hidden">
                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted border-b border-border">
                        Режим работы
                    </div>
                    {availableRoles.map(r => (
                        <button
                            key={r}
                            onClick={() => doSwitch(r)}
                            disabled={busy}
                            className={`w-full text-left px-3 py-2.5 text-sm font-bold flex items-center gap-2 transition hover:bg-surface-2 ${r === role ? 'text-accent-bright' : 'text-ink'}`}
                        >
                            <span className="w-4">{r === role ? '✓' : ''}</span>
                            <span>{ROLE_META[r].icon} {ROLE_META[r].label}</span>
                        </button>
                    ))}
                    {missingRole && (
                        <>
                            <div className="border-t border-border" />
                            <button
                                onClick={() => doAdd(missingRole)}
                                disabled={busy}
                                className="w-full text-left px-3 py-2.5 text-sm font-bold text-accent-bright flex items-center gap-2 transition hover:bg-surface-2"
                            >
                                <span className="w-4">+</span>
                                <span>Стать: {ROLE_META[missingRole].label}</span>
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default RoleSwitcher;

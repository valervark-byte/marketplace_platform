import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from './Toast';
import { btnPrimary, btnGhost } from '../lib/styles';

export const TelegramSettings = () => {
    const [connected, setConnected] = useState(false);
    const [linkCode, setLinkCode] = useState('');
    const [showCode, setShowCode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({
        new_response: true,
        response_accepted: true,
        new_message: true,
        task_completed: true,
        new_review: true,
    });
    const toast = useToast();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const res = await api.get('/telegram/settings');
            setConnected(res.data.telegram_connected);
            setSettings(res.data.settings);
        } catch (err) {
            toast.error('Не удалось загрузить настройки');
        } finally {
            setLoading(false);
        }
    };

    const generateCode = async () => {
        try {
            const res = await api.post('/telegram/generate-link-code');
            setLinkCode(res.data.code);
            setShowCode(true);
        } catch (err) {
            toast.error('Не удалось сгенерировать код');
        }
    };

    const unlink = async () => {
        if (!confirm('Отключить Telegram-уведомления?')) return;
        try {
            await api.delete('/telegram/unlink');
            setConnected(false);
            toast.success('Telegram отключён');
        } catch (err) {
            toast.error('Ошибка отключения');
        }
    };

    const toggleSetting = async (key) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        try {
            await api.put('/telegram/settings', { [key]: newSettings[key] });
        } catch (err) {
            toast.error('Не удалось сохранить настройку');
            setSettings(settings); // откат
        }
    };

    if (loading) {
        return <div className="text-muted">Загрузка...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-4">
                <div className="text-4xl">💬</div>
                <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">Telegram-уведомления</h3>
                    <p className="text-muted text-sm mb-3">
                        Получайте мгновенные уведомления о новых откликах, сообщениях и отзывах прямо в Telegram
                    </p>

                    {connected ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-green-600 font-semibold">✓ Подключено</span>
                                <button onClick={unlink} className="text-muted hover:text-ink text-xs underline">
                                    Отключить
                                </button>
                            </div>

                            <div className="border border-border rounded-xl p-4 bg-surface-2 space-y-2">
                                <p className="font-semibold text-sm mb-2">Какие уведомления отправлять:</p>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.new_response}
                                        onChange={() => toggleSetting('new_response')}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">Новые отклики на мои заказы</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.response_accepted}
                                        onChange={() => toggleSetting('response_accepted')}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">Мой отклик принят</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.new_message}
                                        onChange={() => toggleSetting('new_message')}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">Новые сообщения в чате</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.task_completed}
                                        onChange={() => toggleSetting('task_completed')}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">Заказ завершён</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.new_review}
                                        onChange={() => toggleSetting('new_review')}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">Новые отзывы</span>
                                </label>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {!showCode ? (
                                <button onClick={generateCode} className={btnPrimary}>
                                    Подключить Telegram
                                </button>
                            ) : (
                                <div className="border border-border rounded-xl p-4 bg-surface-2">
                                    <p className="text-sm mb-2">
                                        <strong>Код привязки:</strong>
                                    </p>
                                    <div className="font-mono text-2xl font-bold text-accent mb-3 tracking-widest">
                                        {linkCode}
                                    </div>
                                    <ol className="text-sm text-muted space-y-1 list-decimal list-inside">
                                        <li>Откройте Telegram-бот: <a href="https://t.me/DelOUvedomleniya_bot" target="_blank" rel="noopener" className="text-accent underline">@DelOUvedomleniya_bot</a></li>
                                        <li>Отправьте команду: <code className="bg-surface px-1 rounded">/link {linkCode}</code></li>
                                        <li>Готово! Уведомления начнут приходить автоматически</li>
                                    </ol>
                                    <p className="text-xs text-muted mt-3">Код действителен 10 минут</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

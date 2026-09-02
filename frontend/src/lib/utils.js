import { jwtDecode } from 'jwt-decode';

// Безопасный разбор JWT: битый/просроченный токен не должен ронять рендер белым экраном.
export const safeUserId = (token) => {
    if (!token) return null;
    try {
        const sub = jwtDecode(token).sub;
        const id = parseInt(sub, 10);
        return Number.isNaN(id) ? null : id;
    } catch {
        return null;
    }
};

// Экранирование пользовательского ввода перед вставкой в сырой HTML (балуны карты и т.п.).
export const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Безопасный парсинг JSON-массива (изображения заказа хранятся строкой).
export const parseImages = (raw) => {
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
};

export const formatDate = (iso) => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('ru-RU');
    } catch {
        return '';
    }
};

export const formatMoney = (amount) => {
    if (amount === null || amount === undefined) return '—';
    return `${Number(amount).toLocaleString('ru-RU')} ₽`;
};

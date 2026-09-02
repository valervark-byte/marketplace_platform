import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// В dev по умолчанию бьём в локальный бэкенд; в проде переменная обязательна,
// иначе приложение молча ходило бы на localhost (mixed-content под HTTPS).
export const API_URL = import.meta.env.VITE_API_URL
    || (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000');

if (!API_URL) {
    console.error('VITE_API_URL не задан для production-сборки — запросы к API работать не будут.');
}

// Единый axios-инстанс: базовый URL + автоподстановка токена + автологаут на 401.
export const api = axios.create({ baseURL: API_URL });

// Токен берём из стора при каждом запросе — не завязываемся на момент создания инстанса.
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Любой 401 => сессия протухла => разлогин.
api.interceptors.response.use(
    (r) => r,
    (error) => {
        if (error?.response?.status === 401 && useAuthStore.getState().isAuth) {
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);

// URL для WebSocket по базовому адресу API (учитывает https => wss).
export const wsUrl = (path) => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = API_URL.replace(/^https?:\/\//, '');
    return `${proto}//${host}${path}`;
};

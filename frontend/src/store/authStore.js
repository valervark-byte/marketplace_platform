import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
    persist(
        (set) => ({
            token: null,
            role: null,        // активная роль
            roles: [],         // все доступные роли пользователя
            isAuth: false,
            login: (t, r, roles) => set({ token: t, role: r, roles: roles || [r], isAuth: true }),
            // Переключение/добавление роли: обновляем токен и активную роль, не разлогинивая
            setRole: (t, r, roles) => set((s) => ({
                token: t || s.token,
                role: r,
                roles: roles || s.roles,
            })),
            logout: () => set({ token: null, role: null, roles: [], isAuth: false }),
        }),
        { name: 'auth' }
    )
);

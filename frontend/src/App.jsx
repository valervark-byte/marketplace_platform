import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { NotificationBell } from './components/NotificationBell';
import { RoleSwitcher } from './components/RoleSwitcher';
import { CATEGORIES } from './lib/constants';
import Feed from './pages/Feed';
import TaskPage from './pages/TaskPage';
import ProfilePage from './pages/ProfilePage';
import PublicProfilePage from './pages/PublicProfilePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import MyProductsPage from './pages/MyProductsPage';
import AuthModal from './components/AuthModal';

export default function App() {
    const { isAuth, logout, token } = useAuthStore();
    const [showAuthModal, setShowAuthModal] = useState(false);

    return (
        <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-base text-ink font-sans">
                <nav className="bg-surface sticky top-0 z-40 border-b border-border shadow-card">
                    <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex justify-between items-center gap-3 md:gap-6">
                        <div className="flex items-center gap-3 md:gap-5 shrink-0">
                            <Link to="/" className="font-display font-extrabold text-base sm:text-lg md:text-xl tracking-tight">
                                ДЕЛО<span className="text-accent">.</span>
                            </Link>
                            <div className="flex items-center gap-1 rounded-full bg-surface-2 border border-border p-1">
                                <NavLink to="/" end className={({ isActive }) => `rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${isActive ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>
                                    🛠 Услуги
                                </NavLink>
                                <NavLink to="/products" className={({ isActive }) => `rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${isActive ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>
                                    🛒 Товары
                                </NavLink>
                            </div>
                        </div>
                        {isAuth ? (
                            <div className="flex gap-3 md:gap-5 items-center">
                                <Link to="/profile" className="font-bold text-xs uppercase tracking-wider text-muted hover:text-accent-bright transition">Профиль</Link>
                                <RoleSwitcher />
                                <NotificationBell token={token} />
                                <button onClick={logout} className="text-accent-bright font-bold text-xs uppercase tracking-wider hover:underline underline-offset-4 transition">Выйти</button>
                            </div>
                        ) : (
                            <button onClick={() => setShowAuthModal(true)} className="rounded-xl bg-accent text-white px-4 md:px-5 py-2 font-display text-[11px] uppercase tracking-wider transition hover:bg-accent-bright shadow-card">
                                Войти
                            </button>
                        )}
                    </div>
                </nav>

                <main className="flex-grow">
                    <Routes>
                        <Route path="/" element={<Feed />} />
                        <Route path="/task/:id" element={<TaskPage />} />
                        <Route path="/user/:id" element={<PublicProfilePage />} />
                        <Route path="/reset" element={<ResetPasswordPage />} />
                        <Route path="/products" element={<ProductsPage />} />
                        <Route path="/products/my" element={isAuth ? <MyProductsPage /> : (
                            <div className="max-w-xl mx-auto my-24 text-center px-4">
                                <div className="font-display font-bold uppercase text-3xl">Только для своих</div>
                                <p className="text-muted mt-3 font-semibold">Войдите, чтобы управлять товарами.</p>
                            </div>
                        )} />
                        <Route path="/products/:id" element={<ProductDetailPage />} />
                        <Route path="/profile" element={isAuth ? <ProfilePage /> : (
                            <div className="max-w-xl mx-auto my-24 text-center px-4">
                                <div className="font-display font-bold uppercase text-3xl">Только для своих</div>
                                <p className="text-muted mt-3 font-semibold">Войдите, чтобы просматривать профиль.</p>
                            </div>
                        )} />
                    </Routes>
                </main>

                <footer className="bg-surface border-t border-border mt-16">
                    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 grid gap-8 md:grid-cols-3">
                        <div>
                            <div className="font-display font-extrabold text-lg">ДЕЛО<span className="text-accent">.</span></div>
                            <p className="text-muted text-sm mt-3 font-medium max-w-xs">Маркетплейс услуг: находите проверенных специалистов для любого дела.</p>
                        </div>
                        <div className="md:col-span-2">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Категории</div>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map(c => (
                                    <span key={c.value} className="rounded-full border border-border text-muted text-[11px] font-bold uppercase tracking-wide px-2.5 py-1">{c.label}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-border/60">
                        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 text-xs text-muted font-medium">© 2026 ДЕЛО - маркетплейс услуг</div>
                    </div>
                </footer>

                {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
            </div>
        </BrowserRouter>
    );
}

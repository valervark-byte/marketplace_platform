import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, size = 'md', footer }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open) return null;

    const widths = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
            <div
                role="dialog"
                aria-modal="true"
                className={
                    `relative w-full ${widths[size]} bg-surface border border-border shadow-pop ` +
                    `rounded-t-card sm:rounded-card max-h-[92vh] flex flex-col animate-pop-in`
                }
            >
                {title && (
                    <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-border shrink-0">
                        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
                        <button
                            onClick={onClose}
                            aria-label="Закрыть"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-surface-2 transition-colors"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>
                    </div>
                )}
                <div className="overflow-y-auto px-5 sm:px-6 py-5">{children}</div>
                {footer && (
                    <div className="px-5 sm:px-6 py-4 border-t border-border shrink-0">{footer}</div>
                )}
            </div>
        </div>
    );
}

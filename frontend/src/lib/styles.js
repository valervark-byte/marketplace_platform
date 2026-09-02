// Общие class-рецепты дизайн-системы (тёмная тема, стекло, свечение).
// Использует токены из index.css (@theme). Держим здесь, чтобы страницы не дублировали строки.

export const inputCls =
    "w-full rounded-xl border border-border bg-surface-2 text-ink placeholder-muted/60 p-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40";

export const labelCls =
    "block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5";

export const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-deep text-white px-5 py-2.5 font-display text-xs uppercase tracking-wider transition duration-200 hover:-translate-y-0.5 hover:glow-accent-sm active:translate-y-0 active:scale-[0.98]";

export const btnGhost =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-surface-2 text-ink border border-border px-5 py-2.5 font-display text-xs uppercase tracking-wider transition duration-200 hover:border-border-bright hover:bg-elevated active:scale-[0.98]";

export const btnSignal =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-spark to-accent text-white px-5 py-2.5 font-display text-xs uppercase tracking-wider transition duration-200 hover:-translate-y-0.5 hover:glow-spark active:translate-y-0 active:scale-[0.98]";

export const modalOverlay =
    "fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in";

export const modalPanel = "glass-strong rounded-2xl shadow-pop animate-pop-in";

export const chipCls = (active) =>
    `rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition duration-200 ${
        active
            ? 'bg-gradient-to-r from-accent to-accent-deep text-white glow-accent-sm'
            : 'bg-surface-2 text-muted border border-border hover:text-ink hover:border-border-bright'
    }`;

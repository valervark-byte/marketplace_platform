const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50 disabled:pointer-events-none select-none';

const sizes = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-sm px-4 py-2.5',
    lg: 'text-base px-6 py-3',
};

const variants = {
    primary:
        'bg-accent text-white shadow-card ' +
        'hover:bg-accent-bright hover:shadow-pop hover:-translate-y-0.5 active:translate-y-0',
    spark:
        'bg-spark text-white shadow-card ' +
        'hover:bg-accent-bright hover:shadow-pop hover:-translate-y-0.5 active:translate-y-0',
    ghost:
        'bg-surface-2 text-ink border border-border ' +
        'hover:border-border-bright hover:bg-elevated',
    outline:
        'bg-transparent text-ink border border-border-bright ' +
        'hover:bg-surface-2 hover:border-accent',
    danger:
        'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
    subtle:
        'bg-transparent text-muted hover:text-ink hover:bg-surface-2',
};

export default function Button({
    variant = 'primary',
    size = 'md',
    className = '',
    as: As = 'button',
    loading = false,
    children,
    ...props
}) {
    return (
        <As
            className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
            {...props}
        >
            {loading && (
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {children}
        </As>
    );
}

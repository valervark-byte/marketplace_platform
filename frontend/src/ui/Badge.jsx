const tones = {
    accent: 'bg-accent/10 text-accent-deep border-accent/20',
    spark: 'bg-spark/10 text-spark border-spark/20',
    success: 'bg-success/10 text-success border-success/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    neutral: 'bg-surface-2 text-muted border-border',
};

export default function Badge({ tone = 'neutral', className = '', children, ...props }) {
    return (
        <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${tones[tone]} ${className}`}
            {...props}
        >
            {children}
        </span>
    );
}

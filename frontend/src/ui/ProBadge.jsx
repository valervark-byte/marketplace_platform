export default function ProBadge({ className = '', size = 'md' }) {
    const dims = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
    return (
        <span
            className={`inline-flex items-center gap-1 font-bold rounded-md text-white bg-accent ${dims} ${className}`}
            title="Проверенный специалист"
        >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 1.5l2.6 1.9 3.2-.2 1 3.05 2.6 1.9-1 3.05 1 3.05-2.6 1.9-1 3.05-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3.05-2.6-1.9 1-3.05-1-3.05 2.6-1.9 1-3.05 3.2.2z" opacity="0.35" />
                <path d="M10.2 14.4l-2.3-2.3-1.4 1.4 3.7 3.7 6.8-6.8-1.4-1.4z" fill="#fff" />
            </svg>
            PRO
        </span>
    );
}

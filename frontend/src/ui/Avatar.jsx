const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl',
};

function initials(name = '') {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export default function Avatar({ name, src, size = 'md', className = '' }) {
    const cls = `${sizeMap[size]} shrink-0 rounded-full flex items-center justify-center font-bold overflow-hidden`;
    if (src) {
        return <img src={src} alt={name || ''} className={`${cls} object-cover ${className}`} />;
    }
    return (
        <div
            className={`${cls} bg-accent text-white ${className}`}
            aria-hidden="true"
        >
            {initials(name)}
        </div>
    );
}

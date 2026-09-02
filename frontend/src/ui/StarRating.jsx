import { useState } from 'react';

function Star({ fill = 1, size = 18 }) {
    // fill: 0..1 fraction
    const id = `star-${Math.random().toString(36).slice(2)}`;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
            <defs>
                <linearGradient id={id}>
                    <stop offset={`${fill * 100}%`} stopColor="var(--color-star)" />
                    <stop offset={`${fill * 100}%`} stopColor="var(--color-border-bright)" />
                </linearGradient>
            </defs>
            <path
                fill={`url(#${id})`}
                d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.3l-5.8 3.06 1.1-6.46-4.69-4.58 6.49-.94z"
            />
        </svg>
    );
}

export default function StarRating({ value = 0, count, size = 18, editable = false, onChange }) {
    const [hover, setHover] = useState(0);
    const display = editable && hover ? hover : value;

    if (editable) {
        return (
            <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        onMouseEnter={() => setHover(n)}
                        onClick={() => onChange?.(n)}
                        aria-label={`${n} из 5`}
                        className="p-0.5 transition-transform hover:scale-110"
                    >
                        <Star fill={display >= n ? 1 : 0} size={size} />
                    </button>
                ))}
            </div>
        );
    }

    return (
        <span className="inline-flex items-center gap-1">
            <span className="inline-flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} fill={Math.max(0, Math.min(1, display - (n - 1)))} size={size} />
                ))}
            </span>
            {typeof count === 'number' && (
                <span className="text-xs text-muted ml-1">
                    {value ? value.toFixed(1) : '—'}
                    {count > 0 && ` (${count})`}
                </span>
            )}
        </span>
    );
}

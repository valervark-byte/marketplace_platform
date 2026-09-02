const fieldCls =
    'w-full rounded-xl bg-surface border border-border text-ink placeholder:text-faint ' +
    'px-4 py-2.5 text-sm transition-all duration-200 ' +
    'focus:outline-none focus:border-accent focus:glow-accent-sm';

export function Label({ children, className = '', ...props }) {
    return (
        <label className={`block text-sm font-medium text-muted mb-1.5 ${className}`} {...props}>
            {children}
        </label>
    );
}

export function Input({ className = '', invalid = false, ...props }) {
    return (
        <input
            className={`${fieldCls} ${invalid ? 'border-danger focus:border-danger focus:glow-spark' : ''} ${className}`}
            {...props}
        />
    );
}

export function Textarea({ className = '', invalid = false, ...props }) {
    return (
        <textarea
            className={`${fieldCls} resize-y min-h-24 ${invalid ? 'border-danger focus:border-danger focus:glow-spark' : ''} ${className}`}
            {...props}
        />
    );
}

export function Select({ className = '', children, ...props }) {
    return (
        <select className={`${fieldCls} appearance-none cursor-pointer ${className}`} {...props}>
            {children}
        </select>
    );
}

export function Field({ label, htmlFor, children, hint, error }) {
    return (
        <div>
            {label && <Label htmlFor={htmlFor}>{label}</Label>}
            {children}
            {error ? (
                <p className="mt-1 text-xs text-danger">{error}</p>
            ) : hint ? (
                <p className="mt-1 text-xs text-faint">{hint}</p>
            ) : null}
        </div>
    );
}

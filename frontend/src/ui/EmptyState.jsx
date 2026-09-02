export default function EmptyState({ icon, title, description, action }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            {icon && (
                <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-3xl mb-4">
                    {icon}
                </div>
            )}
            <h3 className="font-display text-lg font-bold text-ink mb-1">{title}</h3>
            {description && <p className="text-sm text-muted max-w-sm mb-5">{description}</p>}
            {action}
        </div>
    );
}

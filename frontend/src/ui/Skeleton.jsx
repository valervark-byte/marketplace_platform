export default function Skeleton({ className = '', rounded = 'rounded-lg' }) {
    return <div className={`skeleton ${rounded} ${className}`} />;
}

export function SkeletonCard() {
    return (
        <div className="rounded-card bg-surface border border-border p-5">
            <div className="flex items-center gap-3 mb-4">
                <Skeleton className="w-10 h-10" rounded="rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-2.5 w-1/4" />
                </div>
            </div>
            <Skeleton className="h-4 w-3/4 mb-3" />
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-5/6 mb-4" />
            <div className="flex gap-2">
                <Skeleton className="h-6 w-20" rounded="rounded-full" />
                <Skeleton className="h-6 w-16" rounded="rounded-full" />
            </div>
        </div>
    );
}
